// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.28;

/// @notice One adapter per supported tokenized asset. The adapter keeps per-holder accounting,
///         so a holder (an AgentAccount or the buffer) only ever withdraws what it put in, plus or
///         minus the asset's performance. Asset addresses come from configuration, never from code.
interface IAssetAdapter {
    /// @return The underlying the adapter accepts and returns (USDG).
    function asset() external view returns (address);
    /// @return The tokenized asset this adapter holds.
    function position() external view returns (address);
    /// @notice Pulls `assets` USDG from msg.sender and allocates it. Credits msg.sender.
    function deposit(uint256 assets) external returns (uint256 units);
    /// @notice Withdraws `assets` USDG worth of msg.sender's position to `to`.
    function withdraw(uint256 assets, address to) external returns (uint256 withdrawn);
    /// @notice Value of `holder`'s position in USDG, valued with a non-stale price.
    function valueOf(address holder) external view returns (uint256);
    /// @notice Total value held by the adapter in USDG.
    function totalValue() external view returns (uint256);
    /// @notice Most recent price update time. Valuation reverts when it is older than the limit.
    function lastPriceUpdate() external view returns (uint256);
    /// @notice Remaining room under the adapter's own limits, in USDG.
    function maxDeposit() external view returns (uint256);
}

interface IFeeModule {
    function feeFor(address agentOwner, uint256 amount) external view returns (uint256);
}

interface IStakingBalance {
    function stakedOf(address account) external view returns (uint256);
}

interface IDepositGate {
    function canDeposit(address account) external view returns (bool);
}

interface IAgentAccount {
    struct Policy {
        uint128 perCallCap;
        uint128 dailyCap;
    }

    function owner() external view returns (address);
    function agentSigner() external view returns (address);
    function paused() external view returns (bool);
    function revoked() external view returns (bool);
    function totalValue() external view returns (uint256);
    function liquid() external view returns (uint256);
    function allocateTo(address adapter, uint256 amount) external;
    function unwindFrom(address adapter, uint256 amount) external returns (uint256);
    function repayBuffer() external returns (uint256);
}

interface IAgentRegistry {
    function isAccount(address account) external view returns (bool);
}

interface IUnsleptBuffer {
    function advance(address agent, address to, uint256 amount, uint256 fee) external;
    function repay(address agent, uint256 amount) external returns (uint256 applied);
    function debtOf(address agent) external view returns (uint256);
    function available() external view returns (uint256);
}

interface IAdapterRegistry {
    function isAdapter(address adapter) external view returns (bool);
}
