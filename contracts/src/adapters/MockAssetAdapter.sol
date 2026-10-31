// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {IAssetAdapter} from "../interfaces/IUnslept.sol";

/// @title MockAssetAdapter
/// @notice Test and staging adapter. Holds USDG and lets an operator simulate yield, loss and stale prices.
///         Never register it on a deployment that holds real user funds.
contract MockAssetAdapter is IAssetAdapter {
    using SafeERC20 for IERC20;

    IERC20 public immutable usdg;
    address public immutable operator;
    uint256 public cap;
    uint256 public maxStaleness;
    uint256 public priceUpdatedAt;

    mapping(address => uint256) public sharesOf;
    uint256 public totalShares;

    error StalePrice(uint256 updatedAt, uint256 maxStaleness);
    error NotOperator();
    error CapExceeded();
    error ZeroAmount();

    constructor(address usdg_, address operator_, uint256 cap_, uint256 maxStaleness_) {
        usdg = IERC20(usdg_);
        operator = operator_;
        cap = cap_;
        maxStaleness = maxStaleness_;
        priceUpdatedAt = block.timestamp;
    }

    modifier onlyOperator() {
        if (msg.sender != operator) revert NotOperator();
        _;
    }

    function asset() external view returns (address) {
        return address(usdg);
    }

    function position() external view returns (address) {
        return address(this);
    }

    function lastPriceUpdate() external view returns (uint256) {
        return priceUpdatedAt;
    }

    function _checkFresh() internal view {
        if (block.timestamp > priceUpdatedAt + maxStaleness) revert StalePrice(priceUpdatedAt, maxStaleness);
    }

    function _assets() internal view returns (uint256) {
        return usdg.balanceOf(address(this));
    }

    function totalValue() external view returns (uint256) {
        _checkFresh();
        return _assets();
    }

    function valueOf(address holder) public view returns (uint256) {
        _checkFresh();
        if (totalShares == 0) return 0;
        return Math.mulDiv(sharesOf[holder], _assets(), totalShares);
    }

    function maxDeposit() public view returns (uint256) {
        uint256 a = _assets();
        return cap > a ? cap - a : 0;
    }

    function deposit(uint256 assets) external returns (uint256 shares) {
        if (assets == 0) revert ZeroAmount();
        _checkFresh();
        if (assets > maxDeposit()) revert CapExceeded();
        uint256 a = _assets();
        shares = totalShares == 0 || a == 0 ? assets : Math.mulDiv(assets, totalShares, a);
        usdg.safeTransferFrom(msg.sender, address(this), assets);
        sharesOf[msg.sender] += shares;
        totalShares += shares;
    }

    function withdraw(uint256 assets, address to) external returns (uint256) {
        if (assets == 0) revert ZeroAmount();
        uint256 have = sharesOf[msg.sender];
        uint256 a = _assets();
        uint256 maxAssets = totalShares == 0 ? 0 : Math.mulDiv(have, a, totalShares);
        if (assets > maxAssets) assets = maxAssets;
        if (assets == 0) return 0;
        uint256 shares = Math.mulDiv(assets, totalShares, a, Math.Rounding.Ceil);
        if (shares > have) shares = have;
        sharesOf[msg.sender] = have - shares;
        totalShares -= shares;
        usdg.safeTransfer(to, assets);
        return assets;
    }

    /* Simulation controls */

    function simulateYield(uint256 amount) external onlyOperator {
        usdg.safeTransferFrom(msg.sender, address(this), amount);
        priceUpdatedAt = block.timestamp;
    }

    function simulateLoss(uint256 amount, address sink) external onlyOperator {
        usdg.safeTransfer(sink, amount);
        priceUpdatedAt = block.timestamp;
    }

    function touchPrice() external onlyOperator {
        priceUpdatedAt = block.timestamp;
    }

    function setPriceUpdatedAt(uint256 t) external onlyOperator {
        priceUpdatedAt = t;
    }
}
