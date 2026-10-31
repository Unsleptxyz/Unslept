// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.28;

import {ERC4626, ERC20, IERC20} from "@openzeppelin/contracts/token/ERC20/extensions/ERC4626.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {SafeCast} from "@openzeppelin/contracts/utils/math/SafeCast.sol";
import {IAssetAdapter, IDepositGate, IUnsleptBuffer} from "./interfaces/IUnslept.sol";

/// @title UnsleptBuffer
/// @notice ERC-4626 USDG vault holding instant-settlement liquidity for x402 payments.
///         The SettlementRouter advances USDG to payees and records a debt against the agent account.
///         Debts are repaid from the agent's parked position. Fees count toward assets only once repaid,
///         so the share price never runs ahead of cash actually received.
///         When utilization is above the queue threshold, or liquidity is short, withdrawals go through a FIFO queue.
contract UnsleptBuffer is IUnsleptBuffer, ERC4626, AccessControl, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;
    using Math for uint256;

    bytes32 public constant ROUTER_ROLE = keccak256("ROUTER_ROLE");
    bytes32 public constant ALLOCATOR_ROLE = keccak256("ALLOCATOR_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");

    uint16 internal constant BPS = 10_000;
    uint8 public constant MAX_ADAPTERS = 16;

    struct Debt {
        uint128 principal;
        uint128 fee;
    }

    struct Ticket {
        address owner;
        address receiver;
        uint128 assets;
        bool funded;
        bool claimed;
    }

    // Accounting
    mapping(address agent => Debt) internal _debt;
    uint256 public outstandingPrincipal; // sum of all principal debts
    uint256 public outstandingFees; // sum of all unpaid fees (not counted in totalAssets)
    uint256 public reserved; // USDG set aside for funded withdrawal tickets
    uint256 public queuedAssets; // assets owed to unfunded tickets

    // Withdrawal queue
    Ticket[] internal _tickets;
    uint256 public queueHead;

    // Buffer's own allocation of idle liquidity into tokenized assets
    address[] internal _adapters;
    mapping(address => bool) public hasAdapter;

    // Parameters (changed by the timelock)
    uint256 public depositCap; // max totalAssets after a deposit; guarded-launch limit
    uint16 public queueThresholdBps; // above this utilization, instant withdrawals stop
    IDepositGate public gate; // optional, e.g. the staker tier

    event Advanced(address indexed agent, address indexed to, uint256 amount, uint256 fee);
    event Repaid(address indexed agent, address indexed payer, uint256 principal, uint256 fee);
    event WrittenOff(address indexed agent, uint256 principal, uint256 fee);
    event WithdrawRequested(uint256 indexed ticket, address indexed owner, address receiver, uint256 shares, uint256 assets);
    event WithdrawFunded(uint256 indexed ticket, uint256 assets);
    event WithdrawClaimed(uint256 indexed ticket, address indexed receiver, uint256 assets);
    event Allocated(address indexed adapter, uint256 amount);
    event Unwound(address indexed adapter, uint256 amount);
    event ParamsSet(uint256 depositCap, uint16 queueThresholdBps, address gate);

    error InsufficientLiquidity(uint256 requested, uint256 available);
    error UseWithdrawQueue(uint256 requested, uint256 instantMax);
    error ZeroAmount();
    error NotTicketOwner();
    error TicketNotFunded();
    error TicketClaimed();
    error InvalidParam();
    error AdapterLimit();
    error DepositNotAllowed();

    constructor(
        IERC20 usdg,
        string memory name_,
        string memory symbol_,
        address admin,
        address pauser,
        uint256 depositCap_,
        uint16 queueThresholdBps_
    ) ERC20(name_, symbol_) ERC4626(usdg) {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(PAUSER_ROLE, pauser);
        _setParams(depositCap_, queueThresholdBps_, address(0));
    }

    /* ------------------------------------------------------------------ */
    /* Views                                                               */
    /* ------------------------------------------------------------------ */

    function _cash() internal view returns (uint256) {
        return IERC20(asset()).balanceOf(address(this));
    }

    function adapterValue() public view returns (uint256 v) {
        for (uint256 i; i < _adapters.length; ++i) {
            v += IAssetAdapter(_adapters[i]).valueOf(address(this));
        }
    }

    /// @notice Cash plus principal receivables plus parked value, minus withdrawal liabilities.
    function totalAssets() public view override returns (uint256) {
        uint256 gross = _cash() + outstandingPrincipal + adapterValue();
        uint256 liabilities = reserved + queuedAssets;
        return gross > liabilities ? gross - liabilities : 0;
    }

    /// @notice USDG free for advances and instant withdrawals. Queued withdrawals have priority.
    function available() public view returns (uint256) {
        uint256 cash = _cash();
        uint256 owed = reserved + queuedAssets;
        return cash > owed ? cash - owed : 0;
    }

    function utilizationBps() public view returns (uint256) {
        uint256 ta = totalAssets();
        if (ta == 0) return 0;
        return outstandingPrincipal.mulDiv(BPS, ta);
    }

    function debtOf(address agent) external view returns (uint256) {
        Debt memory d = _debt[agent];
        return uint256(d.principal) + d.fee;
    }

    function debtDetail(address agent) external view returns (uint256 principal, uint256 fee) {
        Debt memory d = _debt[agent];
        return (d.principal, d.fee);
    }

    function adapters() external view returns (address[] memory) {
        return _adapters;
    }

    function ticket(uint256 id) external view returns (Ticket memory) {
        return _tickets[id];
    }

    function ticketCount() external view returns (uint256) {
        return _tickets.length;
    }

    /* ------------------------------------------------------------------ */
    /* ERC-4626 limits                                                     */
    /* ------------------------------------------------------------------ */

    function _decimalsOffset() internal pure override returns (uint8) {
        return 6; // inflation-attack protection
    }

    function maxDeposit(address receiver) public view override returns (uint256) {
        if (paused()) return 0;
        if (address(gate) != address(0) && !gate.canDeposit(receiver)) return 0;
        uint256 ta = totalAssets();
        return depositCap > ta ? depositCap - ta : 0;
    }

    function maxMint(address receiver) public view override returns (uint256) {
        uint256 assets = maxDeposit(receiver);
        return assets == 0 ? 0 : _convertToShares(assets, Math.Rounding.Floor);
    }

    function _instantMax() internal view returns (uint256) {
        if (paused() || utilizationBps() > queueThresholdBps) return 0;
        return available();
    }

    function maxWithdraw(address owner_) public view override returns (uint256) {
        return Math.min(super.maxWithdraw(owner_), _instantMax());
    }

    function maxRedeem(address owner_) public view override returns (uint256) {
        uint256 assets = maxWithdraw(owner_);
        return Math.min(balanceOf(owner_), _convertToShares(assets, Math.Rounding.Floor));
    }

    function deposit(uint256 assets, address receiver) public override nonReentrant whenNotPaused returns (uint256) {
        _checkGate(receiver);
        return super.deposit(assets, receiver);
    }

    function mint(uint256 shares, address receiver) public override nonReentrant whenNotPaused returns (uint256) {
        _checkGate(receiver);
        return super.mint(shares, receiver);
    }

    function withdraw(uint256 assets, address receiver, address owner_)
        public
        override
        nonReentrant
        whenNotPaused
        returns (uint256)
    {
        uint256 m = maxWithdraw(owner_);
        if (assets > m) revert UseWithdrawQueue(assets, m);
        return super.withdraw(assets, receiver, owner_);
    }

    function redeem(uint256 shares, address receiver, address owner_)
        public
        override
        nonReentrant
        whenNotPaused
        returns (uint256)
    {
        uint256 m = maxRedeem(owner_);
        if (shares > m) revert UseWithdrawQueue(previewRedeem(shares), maxWithdraw(owner_));
        return super.redeem(shares, receiver, owner_);
    }

    function _checkGate(address receiver) internal view {
        if (address(gate) != address(0) && !gate.canDeposit(receiver)) revert DepositNotAllowed();
    }

    /* ------------------------------------------------------------------ */
    /* Withdrawal queue                                                    */
    /* ------------------------------------------------------------------ */

    /// @notice Burns `shares` now and fixes the assets owed at the current share price.
    function requestWithdraw(uint256 shares, address receiver, address owner_)
        external
        nonReentrant
        returns (uint256 id)
    {
        if (shares == 0) revert ZeroAmount();
        if (msg.sender != owner_) _spendAllowance(owner_, msg.sender, shares);
        uint256 assets = previewRedeem(shares);
        if (assets == 0) revert ZeroAmount();
        _burn(owner_, shares);
        queuedAssets += assets;
        id = _tickets.length;
        _tickets.push(Ticket({owner: owner_, receiver: receiver, assets: SafeCast.toUint128(assets), funded: false, claimed: false}));
        emit WithdrawRequested(id, owner_, receiver, shares, assets);
        _processQueue(8);
    }

    /// @notice Funds queued tickets in order while cash allows. Anyone can call it.
    function processQueue(uint256 maxTickets) external nonReentrant returns (uint256) {
        return _processQueue(maxTickets);
    }

    function _processQueue(uint256 maxTickets) internal returns (uint256 funded) {
        uint256 head = queueHead;
        uint256 end = _tickets.length;
        uint256 cash = _cash();
        while (head < end && funded < maxTickets) {
            Ticket storage t = _tickets[head];
            if (cash < reserved + t.assets) break;
            t.funded = true;
            reserved += t.assets;
            queuedAssets -= t.assets;
            emit WithdrawFunded(head, t.assets);
            unchecked {
                ++head;
                ++funded;
            }
        }
        queueHead = head;
    }

    function claimWithdraw(uint256 id) external nonReentrant returns (uint256 assets) {
        Ticket storage t = _tickets[id];
        if (msg.sender != t.owner && msg.sender != t.receiver) revert NotTicketOwner();
        if (!t.funded) revert TicketNotFunded();
        if (t.claimed) revert TicketClaimed();
        t.claimed = true;
        assets = t.assets;
        reserved -= assets;
        IERC20(asset()).safeTransfer(t.receiver, assets);
        emit WithdrawClaimed(id, t.receiver, assets);
    }

    /* ------------------------------------------------------------------ */
    /* Settlement                                                          */
    /* ------------------------------------------------------------------ */

    /// @notice Pays `amount` to `to` on behalf of `agent`. Router only. Never touches reserved or queued cash.
    function advance(address agent, address to, uint256 amount, uint256 fee)
        external
        onlyRole(ROUTER_ROLE)
        whenNotPaused
        nonReentrant
    {
        if (amount == 0) revert ZeroAmount();
        uint256 avail = available();
        if (amount > avail) revert InsufficientLiquidity(amount, avail);
        Debt storage d = _debt[agent];
        d.principal += SafeCast.toUint128(amount);
        d.fee += SafeCast.toUint128(fee);
        outstandingPrincipal += amount;
        outstandingFees += fee;
        IERC20(asset()).safeTransfer(to, amount);
        emit Advanced(agent, to, amount, fee);
    }

    /// @notice Repays up to `amount` of `agent`'s debt, principal first. Pulls USDG from msg.sender.
    ///         Works while paused so debts can always be cleared.
    function repay(address agent, uint256 amount) external nonReentrant returns (uint256 applied) {
        Debt storage d = _debt[agent];
        uint256 p = Math.min(amount, d.principal);
        uint256 f = Math.min(amount - p, d.fee);
        applied = p + f;
        if (applied == 0) return 0;
        d.principal -= SafeCast.toUint128(p);
        d.fee -= SafeCast.toUint128(f);
        outstandingPrincipal -= p;
        outstandingFees -= f;
        IERC20(asset()).safeTransferFrom(msg.sender, address(this), applied);
        emit Repaid(agent, msg.sender, p, f);
        if (queueHead < _tickets.length) _processQueue(8);
    }

    /// @notice Recognizes an unrecoverable debt as a loss shared by depositors. Admin (timelock) only.
    function writeOff(address agent) external onlyRole(DEFAULT_ADMIN_ROLE) {
        Debt memory d = _debt[agent];
        delete _debt[agent];
        outstandingPrincipal -= d.principal;
        outstandingFees -= d.fee;
        emit WrittenOff(agent, d.principal, d.fee);
    }

    /* ------------------------------------------------------------------ */
    /* Allocation of the buffer's own idle liquidity                       */
    /* ------------------------------------------------------------------ */

    function allocate(address adapter, uint256 amount) external onlyRole(ALLOCATOR_ROLE) whenNotPaused nonReentrant {
        if (amount == 0) revert ZeroAmount();
        uint256 avail = available();
        if (amount > avail) revert InsufficientLiquidity(amount, avail);
        if (!hasAdapter[adapter]) {
            if (_adapters.length >= MAX_ADAPTERS) revert AdapterLimit();
            hasAdapter[adapter] = true;
            _adapters.push(adapter);
        }
        IERC20(asset()).forceApprove(adapter, amount);
        IAssetAdapter(adapter).deposit(amount);
        emit Allocated(adapter, amount);
    }

    function unwind(address adapter, uint256 amount) external onlyRole(ALLOCATOR_ROLE) nonReentrant returns (uint256 got) {
        got = IAssetAdapter(adapter).withdraw(amount, address(this));
        emit Unwound(adapter, got);
        if (queueHead < _tickets.length) _processQueue(8);
    }

    /* ------------------------------------------------------------------ */
    /* Admin                                                               */
    /* ------------------------------------------------------------------ */

    function setParams(uint256 depositCap_, uint16 queueThresholdBps_, address gate_)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        _setParams(depositCap_, queueThresholdBps_, gate_);
    }

    function _setParams(uint256 depositCap_, uint16 queueThresholdBps_, address gate_) internal {
        if (queueThresholdBps_ > BPS) revert InvalidParam();
        depositCap = depositCap_;
        queueThresholdBps = queueThresholdBps_;
        gate = IDepositGate(gate_);
        emit ParamsSet(depositCap_, queueThresholdBps_, gate_);
    }

    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(PAUSER_ROLE) {
        _unpause();
    }
}
