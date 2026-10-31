// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.28;

import {Script, console2} from "forge-std/Script.sol";
import {TimelockController} from "@openzeppelin/contracts/governance/TimelockController.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {UnsleptBuffer} from "../src/UnsleptBuffer.sol";
import {AgentAccountFactory} from "../src/AgentAccountFactory.sol";
import {SettlementRouter} from "../src/SettlementRouter.sol";
import {Allocator} from "../src/Allocator.sol";
import {FeeModule} from "../src/FeeModule.sol";
import {UnsleptStaking} from "../src/UnsleptStaking.sol";
import {ERC4626Adapter} from "../src/adapters/ERC4626Adapter.sol";
import {MockAssetAdapter} from "../src/adapters/MockAssetAdapter.sol";

/// @notice Deploys the full protocol. Every address and parameter is read from the environment.
///
/// Mainnet guard: contracts that hold user funds are not deployed to a live network without an audit.
/// Without AUDIT_REPORT_URL, the script refuses to run on any chain other than a local one, unless the
/// deployer sets UNAUDITED_LAUNCH_ACK to the exact acknowledgement below. In that case the deposit cap and
/// per-asset cap are forced under GUARDED_MAX_USDG.
///
/// Ownership: a TimelockController (proposer and executor: the multisig) becomes admin of every contract.
/// The multisig holds the pause role directly so it can stop the protocol without waiting for the delay.
/// The deployer renounces every role at the end.
contract Deploy is Script {
    string internal constant ACK = "I accept that unaudited contracts will hold user funds";
    uint256 internal constant GUARDED_MAX_USDG = 50_000e6;
    uint256 internal constant LOCAL_CHAIN = 31337;

    struct Cfg {
        address usdg;
        address multisig;
        address keeper;
        address entryPoint;
        uint256 timelockDelay;
        uint16 feeBps;
        uint256 depositCap;
        uint16 queueThresholdBps;
        uint16 bufferTargetBps;
        address assetVault;
        address assetFeed;
        uint256 assetStaleness;
        uint256 assetCap;
        address token;
        uint256 stakingCooldown;
        uint256 stakerTierMin;
        string auditReport;
    }

    struct Out {
        address timelock;
        address fees;
        address factory;
        address buffer;
        address router;
        address allocator;
        address adapter;
        address staking;
        address stakerBuffer;
    }

    function run() external returns (Out memory o) {
        Cfg memory c = _load();
        _guard(c);

        uint256 pk = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address deployer = vm.addr(pk);
        vm.startBroadcast(pk);

        if (block.chainid == LOCAL_CHAIN && c.usdg == address(0)) c.usdg = _localUsdg();

        // Timelock: multisig proposes and executes, nobody else. No admin.
        address[] memory ms = new address[](1);
        ms[0] = c.multisig;
        o.timelock = address(new TimelockController(c.timelockDelay, ms, ms, address(0)));

        o.fees = address(new FeeModule(o.timelock, c.feeBps));
        AgentAccountFactory factory = new AgentAccountFactory(deployer, c.usdg);
        UnsleptBuffer buffer = new UnsleptBuffer(
            IERC20(c.usdg), "Unslept Buffer", "usBUF", deployer, c.multisig, c.depositCap, c.queueThresholdBps
        );
        SettlementRouter router = new SettlementRouter(deployer, c.multisig, address(factory), o.fees, address(buffer));
        Allocator allocator = new Allocator(deployer, c.multisig, address(factory), c.bufferTargetBps);
        o.factory = address(factory);
        o.buffer = address(buffer);
        o.router = address(router);
        o.allocator = address(allocator);

        factory.setConfig(o.router, o.allocator, c.entryPoint);
        buffer.grantRole(buffer.ROUTER_ROLE(), o.router);
        buffer.grantRole(buffer.ALLOCATOR_ROLE(), o.allocator);
        allocator.setBuffer(o.buffer, true);
        if (c.keeper != address(0)) allocator.grantRole(allocator.KEEPER_ROLE(), c.keeper);

        if (c.assetVault != address(0)) {
            o.adapter = address(
                new ERC4626Adapter(o.timelock, c.usdg, c.assetVault, c.assetFeed, c.assetStaleness, c.assetCap)
            );
            allocator.setAdapter(o.adapter, true, c.assetCap);
        } else if (block.chainid == LOCAL_CHAIN) {
            o.adapter = address(new MockAssetAdapter(c.usdg, deployer, c.assetCap, 3650 days));
            allocator.setAdapter(o.adapter, true, c.assetCap);
        }

        if (c.token != address(0)) {
            UnsleptStaking staking = new UnsleptStaking(c.token, c.stakingCooldown, c.stakerTierMin);
            o.staking = address(staking);
            UnsleptBuffer tier = new UnsleptBuffer(
                IERC20(c.usdg), "Unslept Staker Buffer", "usSTK", deployer, c.multisig, c.depositCap, c.queueThresholdBps
            );
            tier.setParams(c.depositCap, c.queueThresholdBps, o.staking);
            tier.grantRole(tier.ROUTER_ROLE(), o.router);
            tier.grantRole(tier.ALLOCATOR_ROLE(), o.allocator);
            allocator.setBuffer(address(tier), true);
            router.setConfig(o.fees, o.buffer, address(tier));
            o.stakerBuffer = address(tier);
            _handOver(address(tier), o.timelock, deployer);
            // FeeModule is owned by the timelock: setToken(token, staking) must be proposed by the multisig.
        }

        _handOver(o.factory, o.timelock, deployer);
        _handOver(o.buffer, o.timelock, deployer);
        _handOver(o.router, o.timelock, deployer);
        _handOver(o.allocator, o.timelock, deployer);

        vm.stopBroadcast();
        _write(o, c);
    }

    function _handOver(address target, address timelock, address deployer) internal {
        bytes32 admin = 0x00; // DEFAULT_ADMIN_ROLE
        IAC(target).grantRole(admin, timelock);
        IAC(target).renounceRole(admin, deployer);
    }

    function _guard(Cfg memory c) internal view {
        require(c.multisig != address(0), "PAUSER_MULTISIG_ADDRESS is required");
        require(c.timelockDelay >= 1 days || block.chainid == LOCAL_CHAIN, "TIMELOCK_DELAY_SECONDS must be at least 1 day");
        if (block.chainid == LOCAL_CHAIN) return;
        require(c.usdg != address(0), "NEXT_PUBLIC_USDG_ADDRESS is required");
        uint256 expected = vm.envOr("NEXT_PUBLIC_CHAIN_ID", uint256(0));
        require(expected != 0 && expected == block.chainid, "RPC chain id does not match NEXT_PUBLIC_CHAIN_ID");
        if (bytes(c.auditReport).length > 0) return;

        string memory ack = vm.envOr("UNAUDITED_LAUNCH_ACK", string(""));
        require(
            keccak256(bytes(ack)) == keccak256(bytes(ACK)),
            "No audit: set AUDIT_REPORT_URL, or set UNAUDITED_LAUNCH_ACK to the exact acknowledgement in Deploy.s.sol"
        );
        require(c.depositCap <= GUARDED_MAX_USDG, "Unaudited launch: BUFFER_DEPOSIT_CAP must be <= 50,000 USDG");
        require(c.assetCap <= GUARDED_MAX_USDG, "Unaudited launch: ASSET_CAP must be <= 50,000 USDG");
        console2.log("WARNING: deploying unaudited contracts with guarded caps");
    }

    function _load() internal view returns (Cfg memory c) {
        c.usdg = vm.envOr("NEXT_PUBLIC_USDG_ADDRESS", address(0));
        c.multisig = vm.envOr("PAUSER_MULTISIG_ADDRESS", address(0));
        c.keeper = vm.envOr("KEEPER_ADDRESS", address(0));
        c.entryPoint = vm.envOr("ENTRY_POINT_ADDRESS", address(0));
        c.timelockDelay = vm.envOr("TIMELOCK_DELAY_SECONDS", uint256(0));
        c.feeBps = uint16(vm.envUint("SETTLEMENT_FEE_BPS"));
        c.depositCap = vm.envUint("BUFFER_DEPOSIT_CAP");
        c.queueThresholdBps = uint16(vm.envUint("WITHDRAW_QUEUE_THRESHOLD_BPS"));
        c.bufferTargetBps = uint16(vm.envUint("BUFFER_TARGET_BPS"));
        c.assetVault = vm.envOr("REFERENCE_ASSET_ADDRESS", address(0));
        c.assetFeed = vm.envOr("REFERENCE_ASSET_ORACLE", address(0));
        c.assetStaleness = vm.envOr("ORACLE_MAX_STALENESS_SECONDS", uint256(0));
        c.assetCap = vm.envOr("ASSET_CAP", uint256(0));
        c.token = vm.envOr("NEXT_PUBLIC_UNSLEPT_TOKEN_ADDRESS", address(0));
        c.stakingCooldown = vm.envOr("STAKING_COOLDOWN_SECONDS", uint256(7 days));
        c.stakerTierMin = vm.envOr("STAKER_TIER_MIN_STAKE", uint256(0));
        c.auditReport = vm.envOr("AUDIT_REPORT_URL", string(""));
    }

    function _localUsdg() internal returns (address) {
        return address(new LocalUSDG());
    }

    function _write(Out memory o, Cfg memory c) internal {
        string memory k = "deployment";
        vm.serializeUint(k, "chainId", block.chainid);
        vm.serializeAddress(k, "usdg", c.usdg);
        vm.serializeAddress(k, "timelock", o.timelock);
        vm.serializeAddress(k, "feeModule", o.fees);
        vm.serializeAddress(k, "agentAccountFactory", o.factory);
        vm.serializeAddress(k, "buffer", o.buffer);
        vm.serializeAddress(k, "settlementRouter", o.router);
        vm.serializeAddress(k, "allocator", o.allocator);
        vm.serializeAddress(k, "adapter", o.adapter);
        vm.serializeAddress(k, "staking", o.staking);
        string memory json = vm.serializeAddress(k, "stakerBuffer", o.stakerBuffer);
        string memory path = string.concat("deployments/", vm.toString(block.chainid), ".json");
        vm.writeJson(json, path);
        console2.log("Wrote", path);
    }
}

interface IAC {
    function grantRole(bytes32 role, address account) external;
    function renounceRole(bytes32 role, address account) external;
}

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @dev Local chain only. Mints to anyone; never deployed elsewhere.
contract LocalUSDG is ERC20 {
    constructor() ERC20("Local USDG", "USDG") {}

    function decimals() public pure override returns (uint8) {
        return 6;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}
