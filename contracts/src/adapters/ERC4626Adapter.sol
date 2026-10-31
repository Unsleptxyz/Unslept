// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC4626} from "@openzeppelin/contracts/interfaces/IERC4626.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable2Step, Ownable} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {IAssetAdapter} from "../interfaces/IUnslept.sol";

/// @notice Chainlink-style feed used only as a freshness and health signal for the asset's NAV.
interface IAggregatorV3 {
    function latestRoundData()
        external
        view
        returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound);
}

/// @title ERC4626Adapter
/// @notice Reference adapter for a tokenized asset that exposes an ERC-4626 interface with USDG as its asset
///         (the common shape for tokenized money-market and short-duration treasury vaults).
///         The vault address, NAV feed and staleness limit are constructor arguments read from configuration.
///         Assets with an asynchronous redemption process need their own adapter.
contract ERC4626Adapter is IAssetAdapter, Ownable2Step, ReentrancyGuard {
    using SafeERC20 for IERC20;

    IERC20 public immutable usdg;
    IERC4626 public immutable vault;
    IAggregatorV3 public navFeed; // optional
    uint256 public maxStaleness; // seconds
    uint256 public cap; // adapter-level limit in USDG

    mapping(address holder => uint256 vaultShares) public sharesOf;
    uint256 public totalShares;

    event Deposited(address indexed holder, uint256 assets, uint256 shares);
    event Withdrawn(address indexed holder, address indexed to, uint256 assets, uint256 shares);
    event FeedSet(address feed, uint256 maxStaleness);
    event CapSet(uint256 cap);

    error WrongAsset();
    error StalePrice(uint256 updatedAt, uint256 maxStaleness);
    error BadPrice();
    error InsufficientPosition(uint256 needShares, uint256 haveShares);
    error CapExceeded();
    error ZeroAmount();

    constructor(address owner_, address usdg_, address vault_, address navFeed_, uint256 maxStaleness_, uint256 cap_)
        Ownable(owner_)
    {
        if (IERC4626(vault_).asset() != usdg_) revert WrongAsset();
        usdg = IERC20(usdg_);
        vault = IERC4626(vault_);
        navFeed = IAggregatorV3(navFeed_);
        maxStaleness = maxStaleness_;
        cap = cap_;
    }

    function setFeed(address feed, uint256 maxStaleness_) external onlyOwner {
        navFeed = IAggregatorV3(feed);
        maxStaleness = maxStaleness_;
        emit FeedSet(feed, maxStaleness_);
    }

    function setCap(uint256 cap_) external onlyOwner {
        cap = cap_;
        emit CapSet(cap_);
    }

    function asset() external view returns (address) {
        return address(usdg);
    }

    function position() external view returns (address) {
        return address(vault);
    }

    function lastPriceUpdate() public view returns (uint256) {
        if (address(navFeed) == address(0)) return block.timestamp;
        (, int256 answer,, uint256 updatedAt,) = navFeed.latestRoundData();
        if (answer <= 0) revert BadPrice();
        return updatedAt;
    }

    function _checkFresh() internal view {
        uint256 t = lastPriceUpdate();
        if (block.timestamp > t + maxStaleness && address(navFeed) != address(0)) revert StalePrice(t, maxStaleness);
    }

    function totalValue() public view returns (uint256) {
        _checkFresh();
        return vault.convertToAssets(totalShares);
    }

    function valueOf(address holder) external view returns (uint256) {
        _checkFresh();
        return vault.convertToAssets(sharesOf[holder]);
    }

    function maxDeposit() public view returns (uint256) {
        uint256 tv = vault.convertToAssets(totalShares);
        uint256 room = cap > tv ? cap - tv : 0;
        return Math.min(room, vault.maxDeposit(address(this)));
    }

    function deposit(uint256 assets) external nonReentrant returns (uint256 shares) {
        if (assets == 0) revert ZeroAmount();
        _checkFresh();
        if (assets > maxDeposit()) revert CapExceeded();
        usdg.safeTransferFrom(msg.sender, address(this), assets);
        usdg.forceApprove(address(vault), assets);
        shares = vault.deposit(assets, address(this));
        sharesOf[msg.sender] += shares;
        totalShares += shares;
        emit Deposited(msg.sender, assets, shares);
    }

    function withdraw(uint256 assets, address to) external nonReentrant returns (uint256) {
        if (assets == 0) revert ZeroAmount();
        uint256 have = sharesOf[msg.sender];
        uint256 maxAssets = vault.convertToAssets(have);
        if (assets > maxAssets) assets = maxAssets; // withdraw what is there
        uint256 shares = vault.previewWithdraw(assets);
        if (shares > have) revert InsufficientPosition(shares, have);
        sharesOf[msg.sender] = have - shares;
        totalShares -= shares;
        vault.withdraw(assets, to, address(this));
        emit Withdrawn(msg.sender, to, assets, shares);
        return assets;
    }
}
