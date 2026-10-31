// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.28;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IAgentAccount, IAgentRegistry, IFeeModule, IUnsleptBuffer} from "./interfaces/IUnslept.sol";
import {ISettlementRouter} from "./AgentAccount.sol";

/// @title SettlementRouter
/// @notice Pays x402 merchants from the buffer on behalf of a registered AgentAccount, records the debit,
///         and emits the event the indexer and dashboard consume.
///         The staker-tier buffer, when configured, is used first so its depositors earn a larger share of fees.
contract SettlementRouter is ISettlementRouter, AccessControl, Pausable, ReentrancyGuard {
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");

    IAgentRegistry public immutable registry;
    IFeeModule public feeModule;
    IUnsleptBuffer public buffer;
    IUnsleptBuffer public stakerBuffer; // optional

    event Settled(
        bytes32 indexed paymentId,
        address indexed agent,
        address indexed payee,
        address buffer,
        address recipient,
        uint256 amount,
        uint256 fee,
        Mode mode,
        string endpoint
    );
    event ConfigSet(address feeModule, address buffer, address stakerBuffer);

    error NotAgentAccount(address caller);
    error InsufficientCollateral(uint256 debtAfter, uint256 accountValue);
    error InsufficientBufferLiquidity(uint256 amount, uint256 available);
    error NoSigner();

    constructor(address admin, address pauser, address registry_, address feeModule_, address buffer_) {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(PAUSER_ROLE, pauser);
        registry = IAgentRegistry(registry_);
        _setConfig(feeModule_, buffer_, address(0));
    }

    function setConfig(address feeModule_, address buffer_, address stakerBuffer_) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _setConfig(feeModule_, buffer_, stakerBuffer_);
    }

    function _setConfig(address feeModule_, address buffer_, address stakerBuffer_) internal {
        feeModule = IFeeModule(feeModule_);
        buffer = IUnsleptBuffer(buffer_);
        stakerBuffer = IUnsleptBuffer(stakerBuffer_);
        emit ConfigSet(feeModule_, buffer_, stakerBuffer_);
    }

    function buffers() external view returns (address[] memory list) {
        bool hasStaker = address(stakerBuffer) != address(0);
        list = new address[](hasStaker ? 2 : 1);
        list[0] = address(buffer);
        if (hasStaker) list[1] = address(stakerBuffer);
    }

    /// @inheritdoc ISettlementRouter
    function settle(address payee, uint256 amount, bytes32 paymentId, Mode mode, string calldata endpoint)
        external
        nonReentrant
        whenNotPaused
        returns (uint256 fee, address used)
    {
        address agent = msg.sender;
        if (!registry.isAccount(agent)) revert NotAgentAccount(agent);
        fee = feeModule.feeFor(IAgentAccount(agent).owner(), amount);
        _checkCollateral(agent, amount + fee);
        used = _pickBuffer(amount);
        address recipient = mode == Mode.Exact ? _signerOf(agent) : payee;
        IUnsleptBuffer(used).advance(agent, recipient, amount, fee);
        emit Settled(paymentId, agent, payee, used, recipient, amount, fee, mode, endpoint);
    }

    /// @dev Every debt the account carries must stay covered by what it holds.
    function _checkCollateral(address agent, uint256 newDebt) internal view {
        uint256 debtAfter = newDebt + buffer.debtOf(agent);
        if (address(stakerBuffer) != address(0)) debtAfter += stakerBuffer.debtOf(agent);
        uint256 value = IAgentAccount(agent).totalValue();
        if (debtAfter > value) revert InsufficientCollateral(debtAfter, value);
    }

    function _pickBuffer(uint256 amount) internal view returns (address) {
        IUnsleptBuffer b = buffer;
        if (address(stakerBuffer) != address(0) && stakerBuffer.available() >= amount) b = stakerBuffer;
        uint256 avail = b.available();
        if (avail < amount) revert InsufficientBufferLiquidity(amount, avail);
        return address(b);
    }

    function _signerOf(address agent) internal view returns (address s) {
        s = IAgentAccount(agent).agentSigner();
        if (s == address(0)) revert NoSigner();
    }

    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(PAUSER_ROLE) {
        _unpause();
    }
}
