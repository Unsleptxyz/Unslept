// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Initializable} from "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {MessageHashUtils} from "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
import {IAgentAccount, IAssetAdapter, IUnsleptBuffer, IAdapterRegistry} from "./interfaces/IUnslept.sol";
import {IAccount, PackedUserOperation} from "./interfaces/IERC4337.sol";

interface IAccountConfig {
    function usdg() external view returns (address);
    function router() external view returns (address);
    function allocator() external view returns (address);
    function entryPoint() external view returns (address);
    function buffers() external view returns (address[] memory);
}

interface ISettlementRouter {
    enum Mode {
        Direct, // buffer pays the payee directly
        Exact // buffer funds the agent signer just in time for an x402 "exact" EIP-3009 authorization
    }

    function settle(address payee, uint256 amount, bytes32 paymentId, Mode mode, string calldata endpoint)
        external
        returns (uint256 fee, address buffer);
}

/// @title AgentAccount
/// @notice One smart account per agent (or per project treasury, with no agent signer).
///         Spending policy is enforced here, on-chain: per-call cap, daily cap, payee allowlist, pause, revoke.
///         The owner keeps withdrawal rights at all times. Unslept contracts can only move funds between this
///         account, registered adapters and the buffer debt this account itself incurred. ERC-4337 compatible:
///         the agent signer may only sign user operations that call `requestPayment`.
contract AgentAccount is IAgentAccount, IAccount, Initializable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    uint256 internal constant SIG_VALIDATION_FAILED = 1;
    uint8 public constant MAX_POSITIONS = 8;

    IAccountConfig public config; // the factory
    address public owner;
    address public agentSigner;
    bool public paused;
    bool public revoked;
    bool public autoAllocate; // owner opt-in for the allocator to park idle funds

    Policy public policy;
    uint64 public spendDay;
    uint128 public spentToday;

    mapping(address => bool) public allowedPayee;
    mapping(bytes32 => bool) public allowedDomain; // keccak256 of a lowercase host, e.g. "api.example.com"
    mapping(bytes32 => bool) public usedPaymentId;

    address[] internal _positions;
    mapping(address => bool) public hasPosition;

    struct PaymentRequest {
        address payee;
        uint256 amount;
        bytes32 paymentId;
        string domain;
        string endpoint;
        ISettlementRouter.Mode mode;
    }

    event PaymentRequested(
        bytes32 indexed paymentId, address indexed payee, uint256 amount, uint256 fee, address buffer, string endpoint
    );
    event PolicySet(uint128 perCallCap, uint128 dailyCap);
    event PayeeSet(address indexed payee, bool allowed);
    event DomainSet(bytes32 indexed domainHash, string domain, bool allowed);
    event SignerSet(address indexed signer);
    event Paused(bool paused);
    event Revoked();
    event AutoAllocateSet(bool enabled);
    event Withdrawn(address indexed to, uint256 amount);
    event PositionChanged(address indexed adapter, int256 delta);

    error NotOwner();
    error NotSigner();
    error NotAllocator();
    error AgentPaused();
    error AgentRevoked();
    error PerCallCapExceeded(uint256 amount, uint256 cap);
    error DailyCapExceeded(uint256 spentToday, uint256 amount, uint256 cap);
    error PayeeNotAllowed(address payee);
    error PaymentIdUsed(bytes32 paymentId);
    error ZeroAmount();
    error AdapterNotRegistered(address adapter);
    error TooManyPositions();
    error InsufficientLiquid(uint256 requested, uint256 liquid);
    error WouldLeaveDebtUncovered(uint256 debt, uint256 valueAfter);
    error AutoAllocateOff();

    modifier onlyOwnerOrEntryPoint() {
        if (msg.sender != owner && msg.sender != config.entryPoint()) revert NotOwner();
        _;
    }

    modifier onlyAllocator() {
        if (msg.sender != config.allocator()) revert NotAllocator();
        _;
    }

    constructor() {
        _disableInitializers();
    }

    function initialize(address config_, address owner_, address signer_, Policy calldata policy_)
        external
        initializer
    {
        config = IAccountConfig(config_);
        owner = owner_;
        agentSigner = signer_;
        policy = policy_;
        autoAllocate = true;
        emit SignerSet(signer_);
        emit PolicySet(policy_.perCallCap, policy_.dailyCap);
    }

    receive() external payable {}

    /* ------------------------------------------------------------------ */
    /* Views                                                               */
    /* ------------------------------------------------------------------ */

    function _usdg() internal view returns (IERC20) {
        return IERC20(config.usdg());
    }

    function liquid() public view returns (uint256) {
        return _usdg().balanceOf(address(this));
    }

    function positions() external view returns (address[] memory) {
        return _positions;
    }

    function parkedValue() public view returns (uint256 v) {
        for (uint256 i; i < _positions.length; ++i) {
            v += IAssetAdapter(_positions[i]).valueOf(address(this));
        }
    }

    function totalValue() public view returns (uint256) {
        return liquid() + parkedValue();
    }

    function totalDebt() public view returns (uint256 d) {
        address[] memory bufs = config.buffers();
        for (uint256 i; i < bufs.length; ++i) {
            d += IUnsleptBuffer(bufs[i]).debtOf(address(this));
        }
    }

    function remainingToday() external view returns (uint256) {
        uint64 today = uint64(block.timestamp / 1 days);
        uint256 spent = today == spendDay ? spentToday : 0;
        return policy.dailyCap > spent ? policy.dailyCap - spent : 0;
    }

    function isPayeeAllowed(address payee, string calldata domain) public view returns (bool) {
        return allowedPayee[payee] || (bytes(domain).length > 0 && allowedDomain[keccak256(bytes(domain))]);
    }

    /* ------------------------------------------------------------------ */
    /* Paying                                                              */
    /* ------------------------------------------------------------------ */

    /// @notice Called by the agent signer (directly or through the EntryPoint) when an x402 payment is due.
    function requestPayment(PaymentRequest calldata r) external nonReentrant returns (uint256 fee) {
        address ep = config.entryPoint();
        if (msg.sender != agentSigner && msg.sender != owner && (ep == address(0) || msg.sender != ep)) {
            revert NotSigner();
        }
        if (revoked) revert AgentRevoked();
        if (paused) revert AgentPaused();
        if (r.amount == 0) revert ZeroAmount();
        if (usedPaymentId[r.paymentId]) revert PaymentIdUsed(r.paymentId);
        Policy memory p = policy;
        if (r.amount > p.perCallCap) revert PerCallCapExceeded(r.amount, p.perCallCap);

        uint64 today = uint64(block.timestamp / 1 days);
        uint256 spent = today == spendDay ? spentToday : 0;
        if (spent + r.amount > p.dailyCap) revert DailyCapExceeded(spent, r.amount, p.dailyCap);
        if (!isPayeeAllowed(r.payee, r.domain)) revert PayeeNotAllowed(r.payee);

        spendDay = today;
        spentToday = uint128(spent + r.amount);
        usedPaymentId[r.paymentId] = true;

        address buffer;
        (fee, buffer) = ISettlementRouter(config.router()).settle(r.payee, r.amount, r.paymentId, r.mode, r.endpoint);
        emit PaymentRequested(r.paymentId, r.payee, r.amount, fee, buffer, r.endpoint);
        _repay();
    }

    /// @notice Repays buffer debt from liquid USDG. Anyone can trigger it; it only ever pays this account's own debt.
    function repayBuffer() external nonReentrant returns (uint256) {
        return _repay();
    }

    function _repay() internal returns (uint256 paid) {
        address[] memory bufs = config.buffers();
        IERC20 usdg = _usdg();
        for (uint256 i; i < bufs.length; ++i) {
            IUnsleptBuffer b = IUnsleptBuffer(bufs[i]);
            uint256 debt = b.debtOf(address(this));
            if (debt == 0) continue;
            uint256 amt = debt < usdg.balanceOf(address(this)) ? debt : usdg.balanceOf(address(this));
            if (amt == 0) break;
            usdg.forceApprove(address(b), amt);
            paid += b.repay(address(this), amt);
        }
    }

    /* ------------------------------------------------------------------ */
    /* Allocation (allocator only, between this account and registered adapters) */
    /* ------------------------------------------------------------------ */

    function allocateTo(address adapter, uint256 amount) external onlyAllocator nonReentrant {
        if (!autoAllocate) revert AutoAllocateOff();
        if (revoked) revert AgentRevoked();
        _allocate(adapter, amount);
    }

    function unwindFrom(address adapter, uint256 amount) external onlyAllocator nonReentrant returns (uint256 got) {
        got = _unwind(adapter, amount);
        _repay();
    }

    function _allocate(address adapter, uint256 amount) internal {
        if (amount == 0) revert ZeroAmount();
        if (!IAdapterRegistry(config.allocator()).isAdapter(adapter)) revert AdapterNotRegistered(adapter);
        uint256 l = liquid();
        if (amount > l) revert InsufficientLiquid(amount, l);
        if (!hasPosition[adapter]) {
            if (_positions.length >= MAX_POSITIONS) revert TooManyPositions();
            hasPosition[adapter] = true;
            _positions.push(adapter);
        }
        _usdg().forceApprove(adapter, amount);
        IAssetAdapter(adapter).deposit(amount);
        emit PositionChanged(adapter, int256(amount));
    }

    function _unwind(address adapter, uint256 amount) internal returns (uint256 got) {
        if (amount == 0) revert ZeroAmount();
        got = IAssetAdapter(adapter).withdraw(amount, address(this));
        emit PositionChanged(adapter, -int256(got));
    }

    /* ------------------------------------------------------------------ */
    /* Owner controls                                                      */
    /* ------------------------------------------------------------------ */

    function setPolicy(Policy calldata p) external onlyOwnerOrEntryPoint {
        policy = p;
        emit PolicySet(p.perCallCap, p.dailyCap);
    }

    function setPayee(address payee, bool allowed) external onlyOwnerOrEntryPoint {
        allowedPayee[payee] = allowed;
        emit PayeeSet(payee, allowed);
    }

    /// @param domain lowercase host, for example "api.example.com". Domain matching trusts the host the SDK
    ///        reports; payee addresses are the strict control.
    function setDomain(string calldata domain, bool allowed) external onlyOwnerOrEntryPoint {
        bytes32 h = keccak256(bytes(domain));
        allowedDomain[h] = allowed;
        emit DomainSet(h, domain, allowed);
    }

    function setSigner(address signer_) external onlyOwnerOrEntryPoint {
        if (revoked) revert AgentRevoked();
        agentSigner = signer_;
        emit SignerSet(signer_);
    }

    function setPaused(bool p) external onlyOwnerOrEntryPoint {
        paused = p;
        emit Paused(p);
    }

    /// @notice Permanently removes the agent signer. The owner keeps every other right.
    function revoke() external onlyOwnerOrEntryPoint {
        revoked = true;
        agentSigner = address(0);
        emit Revoked();
    }

    function setAutoAllocate(bool enabled) external onlyOwnerOrEntryPoint {
        autoAllocate = enabled;
        emit AutoAllocateSet(enabled);
    }

    /// @notice Owner can always unwind its own positions, whatever the allocator does.
    function ownerUnwind(address adapter, uint256 amount) external onlyOwnerOrEntryPoint nonReentrant returns (uint256 got) {
        got = _unwind(adapter, amount);
        _repay();
    }

    function ownerAllocate(address adapter, uint256 amount) external onlyOwnerOrEntryPoint nonReentrant {
        _allocate(adapter, amount);
    }

    /// @notice Withdraws liquid USDG to `to`. Outstanding buffer debt is repaid first; the account must stay
    ///         able to cover any debt that remains.
    function withdraw(address to, uint256 amount) external onlyOwnerOrEntryPoint nonReentrant {
        if (amount == 0) revert ZeroAmount();
        _repay();
        uint256 l = liquid();
        if (amount > l) revert InsufficientLiquid(amount, l);
        uint256 debt = totalDebt();
        if (debt > 0) {
            uint256 valueAfter = totalValue() - amount;
            if (valueAfter < debt) revert WouldLeaveDebtUncovered(debt, valueAfter);
        }
        _usdg().safeTransfer(to, amount);
        emit Withdrawn(to, amount);
    }

    /// @notice Rescue for tokens other than USDG sent here by mistake. Owner only.
    function sweep(address token, address to, uint256 amount) external onlyOwnerOrEntryPoint {
        if (token == address(_usdg())) revert NotOwner();
        IERC20(token).safeTransfer(to, amount);
    }

    /* ------------------------------------------------------------------ */
    /* ERC-4337                                                            */
    /* ------------------------------------------------------------------ */

    function validateUserOp(PackedUserOperation calldata userOp, bytes32 userOpHash, uint256 missingAccountFunds)
        external
        returns (uint256 validationData)
    {
        address ep = config.entryPoint();
        if (ep == address(0) || msg.sender != ep) revert NotSigner();
        (address signer, ECDSA.RecoverError err,) =
            ECDSA.tryRecover(MessageHashUtils.toEthSignedMessageHash(userOpHash), userOp.signature);
        if (err != ECDSA.RecoverError.NoError) {
            validationData = SIG_VALIDATION_FAILED;
        } else if (signer == owner) {
            validationData = 0;
        } else if (
            signer == agentSigner && !revoked && userOp.callData.length >= 4
                && bytes4(userOp.callData[:4]) == this.requestPayment.selector
        ) {
            validationData = 0;
        } else {
            validationData = SIG_VALIDATION_FAILED;
        }
        if (missingAccountFunds > 0) {
            (bool ok,) = payable(msg.sender).call{value: missingAccountFunds}("");
            ok; // the EntryPoint verifies the prefund itself
        }
    }
}
