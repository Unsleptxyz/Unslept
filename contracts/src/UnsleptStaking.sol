// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {SafeCast} from "@openzeppelin/contracts/utils/math/SafeCast.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IDepositGate, IStakingBalance} from "./interfaces/IUnslept.sol";

/// @title UnsleptStaking
/// @notice Stake $UNSLEPT for fee discounts and access to the staker buffer tier.
///         Staking pays no rewards. Unstaking has a cooldown so access cannot be borrowed for one block.
contract UnsleptStaking is IStakingBalance, IDepositGate, ReentrancyGuard {
    using SafeERC20 for IERC20;

    IERC20 public immutable token;
    uint256 public immutable cooldown; // seconds
    uint256 public immutable minStakeForTier; // $UNSLEPT units required for the staker buffer tier

    struct Pending {
        uint128 amount;
        uint64 unlockAt;
    }

    mapping(address => uint256) public stakedOf;
    mapping(address => Pending) public pendingOf;

    event Staked(address indexed account, uint256 amount);
    event UnstakeRequested(address indexed account, uint256 amount, uint256 unlockAt);
    event Unstaked(address indexed account, uint256 amount);

    error ZeroAmount();
    error InsufficientStake(uint256 requested, uint256 staked);
    error CoolingDown(uint256 unlockAt);

    constructor(address token_, uint256 cooldown_, uint256 minStakeForTier_) {
        token = IERC20(token_);
        cooldown = cooldown_;
        minStakeForTier = minStakeForTier_;
    }

    function stake(uint256 amount) external nonReentrant {
        if (amount == 0) revert ZeroAmount();
        token.safeTransferFrom(msg.sender, address(this), amount);
        stakedOf[msg.sender] += amount;
        emit Staked(msg.sender, amount);
    }

    function requestUnstake(uint256 amount) external {
        uint256 s = stakedOf[msg.sender];
        if (amount == 0) revert ZeroAmount();
        if (amount > s) revert InsufficientStake(amount, s);
        stakedOf[msg.sender] = s - amount;
        Pending storage p = pendingOf[msg.sender];
        p.amount += SafeCast.toUint128(amount);
        p.unlockAt = SafeCast.toUint64(block.timestamp + cooldown);
        emit UnstakeRequested(msg.sender, amount, p.unlockAt);
    }

    function unstake() external nonReentrant {
        Pending memory p = pendingOf[msg.sender];
        if (p.amount == 0) revert ZeroAmount();
        if (block.timestamp < p.unlockAt) revert CoolingDown(p.unlockAt);
        delete pendingOf[msg.sender];
        token.safeTransfer(msg.sender, p.amount);
        emit Unstaked(msg.sender, p.amount);
    }

    /// @inheritdoc IDepositGate
    function canDeposit(address account) external view returns (bool) {
        return stakedOf[account] >= minStakeForTier;
    }
}
