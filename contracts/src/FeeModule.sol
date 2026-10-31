// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.28;

import {Ownable2Step, Ownable} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IFeeModule, IStakingBalance} from "./interfaces/IUnslept.sol";

/// @title FeeModule
/// @notice Instant-settlement fee in basis points, configurable only inside hard-coded bounds.
///         Discount tiers for $UNSLEPT holders read the agent owner's wallet balance plus staked balance.
///         The owner is expected to be the TimelockController.
contract FeeModule is IFeeModule, Ownable2Step {
    uint16 public constant MIN_FEE_BPS = 0;
    uint16 public constant MAX_FEE_BPS = 100; // 1.00%
    uint16 public constant MAX_DISCOUNT_BPS = 5_000; // at most half the fee
    uint8 public constant MAX_TIERS = 8;
    uint16 internal constant BPS = 10_000;

    struct Tier {
        uint128 minHolding; // $UNSLEPT units, held + staked
        uint16 discountBps; // share of the fee waived
    }

    uint16 public feeBps;
    IERC20 public token; // $UNSLEPT, zero until launched
    IStakingBalance public staking; // optional
    Tier[] internal _tiers;

    event FeeSet(uint16 feeBps);
    event TokenSet(address token, address staking);
    event TiersSet(Tier[] tiers);

    error FeeOutOfBounds(uint16 feeBps, uint16 min, uint16 max);
    error InvalidTiers();

    constructor(address owner_, uint16 feeBps_) Ownable(owner_) {
        _setFee(feeBps_);
    }

    function setFee(uint16 feeBps_) external onlyOwner {
        _setFee(feeBps_);
    }

    function setToken(address token_, address staking_) external onlyOwner {
        token = IERC20(token_);
        staking = IStakingBalance(staking_);
        emit TokenSet(token_, staking_);
    }

    /// @notice Tiers must be strictly increasing in both minHolding and discountBps.
    function setTiers(Tier[] calldata tiers_) external onlyOwner {
        if (tiers_.length > MAX_TIERS) revert InvalidTiers();
        delete _tiers;
        for (uint256 i; i < tiers_.length; ++i) {
            Tier calldata t = tiers_[i];
            if (t.discountBps == 0 || t.discountBps > MAX_DISCOUNT_BPS) revert InvalidTiers();
            if (i > 0 && (t.minHolding <= tiers_[i - 1].minHolding || t.discountBps <= tiers_[i - 1].discountBps)) {
                revert InvalidTiers();
            }
            _tiers.push(t);
        }
        emit TiersSet(tiers_);
    }

    function tiers() external view returns (Tier[] memory) {
        return _tiers;
    }

    function holdingOf(address account) public view returns (uint256 h) {
        if (address(token) != address(0)) h = token.balanceOf(account);
        if (address(staking) != address(0)) h += staking.stakedOf(account);
    }

    function discountFor(address account) public view returns (uint16 d) {
        uint256 len = _tiers.length;
        if (len == 0) return 0;
        uint256 h = holdingOf(account);
        for (uint256 i = len; i > 0; --i) {
            if (h >= _tiers[i - 1].minHolding) return _tiers[i - 1].discountBps;
        }
    }

    /// @inheritdoc IFeeModule
    function feeFor(address agentOwner, uint256 amount) external view returns (uint256) {
        uint256 base = (amount * feeBps) / BPS;
        uint16 d = discountFor(agentOwner);
        return base - (base * d) / BPS;
    }

    function _setFee(uint16 feeBps_) internal {
        if (feeBps_ < MIN_FEE_BPS || feeBps_ > MAX_FEE_BPS) revert FeeOutOfBounds(feeBps_, MIN_FEE_BPS, MAX_FEE_BPS);
        feeBps = feeBps_;
        emit FeeSet(feeBps_);
    }
}
