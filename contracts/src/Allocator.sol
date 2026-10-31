// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.28;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {IAdapterRegistry, IAgentAccount, IAgentRegistry, IAssetAdapter} from "./interfaces/IUnslept.sol";

interface IBufferAlloc {
    function allocate(address adapter, uint256 amount) external;
    function unwind(address adapter, uint256 amount) external returns (uint256);
    function available() external view returns (uint256);
    function totalAssets() external view returns (uint256);
    function debtOf(address agent) external view returns (uint256);
}

interface IAccountPositions {
    function positions() external view returns (address[] memory);
    function totalDebt() external view returns (uint256);
}

/// @title Allocator
/// @notice Moves idle balances from AgentAccounts and the buffer into tokenized assets through registered
///         adapters, and unwinds them when debts are due or the buffer drops below its target ratio.
///         Per-asset caps bound exposure to any single tokenized asset.
contract Allocator is IAdapterRegistry, AccessControl, Pausable {
    bytes32 public constant KEEPER_ROLE = keccak256("KEEPER_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
    uint16 internal constant BPS = 10_000;

    IAgentRegistry public immutable registry;

    mapping(address => bool) public isAdapter;
    mapping(address => uint256) public capOf; // max total value per adapter, in USDG
    address[] internal _adapterList;

    mapping(address => bool) public isBuffer;
    uint16 public bufferTargetBps; // share of buffer assets kept liquid

    event AdapterSet(address indexed adapter, bool enabled, uint256 cap);
    event BufferSet(address indexed buffer, bool enabled);
    event TargetSet(uint16 bufferTargetBps);
    event DebtSettled(address indexed account, uint256 unwound);

    error NotAdapter(address adapter);
    error NotBuffer(address buffer);
    error NotAccount(address account);
    error CapExceeded(address adapter, uint256 valueAfter, uint256 cap);
    error AboveTarget(uint256 liquidAfter, uint256 target);
    error BufferAboveTarget();
    error InvalidParam();

    constructor(address admin, address pauser, address registry_, uint16 bufferTargetBps_) {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(PAUSER_ROLE, pauser);
        registry = IAgentRegistry(registry_);
        _setTarget(bufferTargetBps_);
    }

    /* Admin (timelock) */

    function setAdapter(address adapter, bool enabled, uint256 cap) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (enabled && !isAdapter[adapter] && capOf[adapter] == 0) _adapterList.push(adapter);
        isAdapter[adapter] = enabled;
        capOf[adapter] = cap;
        emit AdapterSet(adapter, enabled, cap);
    }

    function setBuffer(address buffer, bool enabled) external onlyRole(DEFAULT_ADMIN_ROLE) {
        isBuffer[buffer] = enabled;
        emit BufferSet(buffer, enabled);
    }

    function setTarget(uint16 bps) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _setTarget(bps);
    }

    function _setTarget(uint16 bps) internal {
        if (bps > BPS) revert InvalidParam();
        bufferTargetBps = bps;
        emit TargetSet(bps);
    }

    function adapterList() external view returns (address[] memory) {
        return _adapterList;
    }

    /* Keeper: park idle funds */

    function allocateAgent(address account, address adapter, uint256 amount) external onlyRole(KEEPER_ROLE) whenNotPaused {
        if (!registry.isAccount(account)) revert NotAccount(account);
        _checkAdapter(adapter, amount);
        IAgentAccount(account).repayBuffer(); // idle cash pays debts before it is parked
        IAgentAccount(account).allocateTo(adapter, amount);
    }

    function allocateBuffer(address buffer, address adapter, uint256 amount) external onlyRole(KEEPER_ROLE) whenNotPaused {
        if (!isBuffer[buffer]) revert NotBuffer(buffer);
        _checkAdapter(adapter, amount);
        IBufferAlloc b = IBufferAlloc(buffer);
        uint256 target = Math.mulDiv(b.totalAssets(), bufferTargetBps, BPS);
        uint256 avail = b.available();
        uint256 liquidAfter = avail > amount ? avail - amount : 0;
        if (liquidAfter < target) revert AboveTarget(liquidAfter, target);
        b.allocate(adapter, amount);
    }

    function unwindAgent(address account, address adapter, uint256 amount) external onlyRole(KEEPER_ROLE) {
        if (!registry.isAccount(account)) revert NotAccount(account);
        IAgentAccount(account).unwindFrom(adapter, amount);
    }

    function unwindBuffer(address buffer, address adapter, uint256 amount) external onlyRole(KEEPER_ROLE) {
        if (!isBuffer[buffer]) revert NotBuffer(buffer);
        IBufferAlloc(buffer).unwind(adapter, amount);
    }

    /* Permissionless safety valves */

    /// @notice Unwinds an account's parked positions until its buffer debt is repaid. Anyone can call it,
    ///         works while paused, and can only move the account's funds to repay the account's own debt.
    function settleDebt(address account) external returns (uint256 unwound) {
        if (!registry.isAccount(account)) revert NotAccount(account);
        IAgentAccount acct = IAgentAccount(account);
        acct.repayBuffer();
        uint256 debt = IAccountPositions(account).totalDebt();
        address[] memory pos = IAccountPositions(account).positions();
        for (uint256 i; i < pos.length && debt > 0; ++i) {
            uint256 v = IAssetAdapter(pos[i]).valueOf(account);
            uint256 take = Math.min(v, debt);
            if (take == 0) continue;
            uint256 got = acct.unwindFrom(pos[i], take);
            unwound += got;
            debt = IAccountPositions(account).totalDebt();
        }
        emit DebtSettled(account, unwound);
    }

    /// @notice Refills a buffer from its own parked position when it is below target. Anyone can call it.
    function refillBuffer(address buffer, address adapter) external returns (uint256 got) {
        if (!isBuffer[buffer]) revert NotBuffer(buffer);
        IBufferAlloc b = IBufferAlloc(buffer);
        uint256 target = Math.mulDiv(b.totalAssets(), bufferTargetBps, BPS);
        uint256 avail = b.available();
        if (avail >= target) revert BufferAboveTarget();
        uint256 need = Math.min(target - avail, IAssetAdapter(adapter).valueOf(buffer));
        if (need == 0) return 0;
        got = b.unwind(adapter, need);
    }

    function _checkAdapter(address adapter, uint256 amount) internal view {
        if (!isAdapter[adapter]) revert NotAdapter(adapter);
        uint256 valueAfter = IAssetAdapter(adapter).totalValue() + amount;
        uint256 cap = capOf[adapter];
        if (valueAfter > cap) revert CapExceeded(adapter, valueAfter, cap);
    }

    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(PAUSER_ROLE) {
        _unpause();
    }
}
