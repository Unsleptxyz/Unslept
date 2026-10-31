// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.28;

import {Test, Vm} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC4626} from "@openzeppelin/contracts/interfaces/IERC4626.sol";
import {UnsleptBuffer} from "../../src/UnsleptBuffer.sol";
import {AgentAccount, ISettlementRouter} from "../../src/AgentAccount.sol";
import {AgentAccountFactory} from "../../src/AgentAccountFactory.sol";
import {Allocator} from "../../src/Allocator.sol";
import {ERC4626Adapter} from "../../src/adapters/ERC4626Adapter.sol";
import {IAgentAccount} from "../../src/interfaces/IUnslept.sol";

/// @notice Runs the full Unslept flow against the contracts deployed on Robinhood Chain mainnet, on a fork.
///         No real funds move. Run with: FORK_RPC=<rpc> forge test --match-path test/fork/* -vv
///         Without FORK_RPC every test returns early, so the normal suite is unaffected.
contract MainnetForkTest is Test {
    uint256 constant ONE = 1e6;
    // keccak256("Settled(bytes32,address,address,address,address,uint256,uint256,uint8,string)"), as used by the web demo and SDK
    bytes32 constant SETTLED_TOPIC = 0x840ee00c8bdf0b51f6780c66e0c32236366088094b9ca1154d600bb59517ec95;

    bool live;
    IERC20 usdg;
    IERC4626 spUsdg;
    UnsleptBuffer buffer;
    AgentAccountFactory factory;
    Allocator allocator;
    ERC4626Adapter adapter;
    address router;
    address keeper = 0xc1FC86EbC84A11B78A5Ae08D6Ad60CD5748394Ac;

    address depositor = makeAddr("depositor");
    address owner_ = makeAddr("owner");
    uint256 signerKey = 0xB0B;
    address signer;
    address merchant = makeAddr("merchant");

    function setUp() public {
        string memory rpc = vm.envOr("FORK_RPC", string(""));
        if (bytes(rpc).length == 0) return;
        vm.createSelectFork(rpc);
        live = true;

        string memory j = vm.readFile("deployments/4663.json");
        usdg = IERC20(vm.parseJsonAddress(j, ".usdg"));
        buffer = UnsleptBuffer(vm.parseJsonAddress(j, ".buffer"));
        factory = AgentAccountFactory(vm.parseJsonAddress(j, ".agentAccountFactory"));
        allocator = Allocator(vm.parseJsonAddress(j, ".allocator"));
        adapter = ERC4626Adapter(vm.parseJsonAddress(j, ".adapter"));
        router = vm.parseJsonAddress(j, ".settlementRouter");
        spUsdg = IERC4626(adapter.position());
        signer = vm.addr(signerKey);

        assertTrue(allocator.hasRole(allocator.KEEPER_ROLE(), keeper), "keeper role");
        assertEq(spUsdg.asset(), address(usdg), "spUSDG asset is USDG");
    }

    function _newAgent(uint256 perCall, uint256 daily) internal returns (AgentAccount a) {
        vm.prank(owner_);
        a = AgentAccount(
            payable(
                factory.createAccount(
                    signer, IAgentAccount.Policy({perCallCap: uint128(perCall), dailyCap: uint128(daily)}), keccak256("fork-test")
                )
            )
        );
        vm.prank(owner_);
        a.setPayee(merchant, true);
    }

    function _req(uint256 amount, bytes32 id, ISettlementRouter.Mode mode) internal view returns (AgentAccount.PaymentRequest memory) {
        return AgentAccount.PaymentRequest({
            payee: merchant,
            amount: amount,
            paymentId: id,
            domain: "",
            endpoint: "https://unslept-o29g.vercel.app/api/demo/x402",
            mode: mode
        });
    }

    function _fundBuffer(uint256 amount) internal {
        deal(address(usdg), depositor, amount);
        vm.startPrank(depositor);
        usdg.approve(address(buffer), amount);
        buffer.deposit(amount, depositor);
        vm.stopPrank();
    }

    function test_fork_fullAgentFlow() public {
        if (!live) return;
        _fundBuffer(1_000 * ONE);
        AgentAccount agent = _newAgent(100 * ONE, 500 * ONE);
        deal(address(usdg), address(agent), 100 * ONE);
        assertEq(usdg.balanceOf(address(agent)), 100 * ONE, "deal works on real USDG");

        // 1. Pay from liquid cash. The Settled event must match what the demo endpoint decodes.
        vm.recordLogs();
        vm.prank(signer);
        uint256 fee1 = agent.requestPayment(_req(1 * ONE, keccak256("p1"), ISettlementRouter.Mode.Direct));
        assertEq(usdg.balanceOf(merchant), 1 * ONE, "merchant paid");
        assertEq(buffer.debtOf(address(agent)), 0, "liquid repays at once");
        Vm.Log[] memory logs = vm.getRecordedLogs();
        bool found;
        for (uint256 i; i < logs.length; ++i) {
            if (logs[i].emitter == router && logs[i].topics[0] == SETTLED_TOPIC) {
                assertEq(logs[i].topics[1], keccak256("p1"), "paymentId topic");
                assertEq(address(uint160(uint256(logs[i].topics[2]))), address(agent), "agent topic");
                assertEq(address(uint160(uint256(logs[i].topics[3]))), merchant, "payee topic");
                (, address recipient, uint256 amount,, uint8 mode,) =
                    abi.decode(logs[i].data, (address, address, uint256, uint256, uint8, string));
                assertEq(recipient, merchant);
                assertEq(amount, 1 * ONE);
                assertEq(mode, 0);
                found = true;
            }
        }
        assertTrue(found, "Settled event with the documented topic");

        // 2. Keeper parks idle cash in spUSDG through the real adapter.
        vm.prank(keeper);
        allocator.allocateAgent(address(agent), address(adapter), 50 * ONE);
        assertApproxEqAbs(adapter.valueOf(address(agent)), 50 * ONE, 2, "parked in spUSDG");

        // 3. Pay more than liquid: the buffer fronts it, the agent carries debt.
        uint256 liquidBefore = agent.liquid();
        vm.prank(signer);
        uint256 fee2 = agent.requestPayment(_req(liquidBefore + 10 * ONE, keccak256("p2"), ISettlementRouter.Mode.Direct));
        assertEq(usdg.balanceOf(merchant), 1 * ONE + liquidBefore + 10 * ONE, "agent never waits");
        assertGt(buffer.debtOf(address(agent)), 0, "debt recorded");

        // 4. Anyone settles the debt from the parked spUSDG position.
        uint256 pps = buffer.convertToAssets(1e18);
        allocator.settleDebt(address(agent));
        assertEq(buffer.debtOf(address(agent)), 0, "debt settled from spUSDG");
        assertGe(buffer.convertToAssets(1e18), pps, "fees never lower the share price");

        // 5. Time passes; the parked position does not lose value.
        uint256 parked = adapter.valueOf(address(agent));
        vm.warp(block.timestamp + 30 days);
        vm.roll(block.number + 1);
        assertGe(adapter.valueOf(address(agent)) + 1, parked, "spUSDG value non-decreasing");

        // 6. Owner exits completely.
        vm.startPrank(owner_);
        agent.ownerUnwind(address(adapter), type(uint256).max);
        uint256 l = agent.liquid();
        agent.withdraw(owner_, l);
        vm.stopPrank();
        assertEq(adapter.valueOf(address(agent)), 0, "position fully unwound");
        uint256 expected = 100 * ONE - (1 * ONE + liquidBefore + 10 * ONE) - fee1 - fee2;
        uint256 received = usdg.balanceOf(owner_);
        assertGe(received + 3, expected, "owner gets back at least principal minus payments and fees");
        assertLe(received, expected + parked / 50, "no more than plausible yield (2% of parked in 30 days)");
        emit log_named_uint("owner received (atomic USDG)", received);
        emit log_named_uint("spUSDG yield over 30 days (atomic USDG)", received > expected ? received - expected : 0);
        emit log_named_uint("fees paid (atomic USDG)", fee1 + fee2);
    }

    function test_fork_exactModeFundsSigner() public {
        if (!live) return;
        _fundBuffer(100 * ONE);
        AgentAccount agent = _newAgent(10 * ONE, 50 * ONE);
        deal(address(usdg), address(agent), 20 * ONE);
        vm.prank(signer);
        agent.requestPayment(_req(2 * ONE, keccak256("e1"), ISettlementRouter.Mode.Exact));
        assertEq(usdg.balanceOf(signer), 2 * ONE, "signer funded for EIP-3009");
    }

    function test_fork_policyEnforcedOnMainnet() public {
        if (!live) return;
        _fundBuffer(100 * ONE);
        AgentAccount agent = _newAgent(5 * ONE, 8 * ONE);
        deal(address(usdg), address(agent), 50 * ONE);
        vm.prank(signer);
        vm.expectRevert();
        agent.requestPayment(_req(6 * ONE, keccak256("x1"), ISettlementRouter.Mode.Direct)); // over per-call cap
        vm.prank(signer);
        agent.requestPayment(_req(5 * ONE, keccak256("x2"), ISettlementRouter.Mode.Direct));
        vm.prank(signer);
        vm.expectRevert();
        agent.requestPayment(_req(4 * ONE, keccak256("x3"), ISettlementRouter.Mode.Direct)); // over daily cap
        vm.prank(signer);
        vm.expectRevert();
        agent.requestPayment(_req(1 * ONE, keccak256("x2"), ISettlementRouter.Mode.Direct)); // replayed paymentId
        AgentAccount.PaymentRequest memory r = _req(1 * ONE, keccak256("x4"), ISettlementRouter.Mode.Direct);
        r.payee = makeAddr("stranger");
        vm.prank(signer);
        vm.expectRevert();
        agent.requestPayment(r); // payee not on allowlist
    }

    function test_fork_bufferParksAndRefills() public {
        if (!live) return;
        _fundBuffer(1_000 * ONE);
        uint256 total = buffer.totalAssets();
        uint256 target = total * allocator.bufferTargetBps() / 10_000;
        uint256 amount = buffer.available() - target;
        vm.prank(keeper);
        allocator.allocateBuffer(address(buffer), address(adapter), amount);
        assertApproxEqAbs(buffer.totalAssets(), total, 2, "parking does not change buffer value");

        // A large instant payment drains liquidity below target; anyone can refill from spUSDG.
        // The agent's collateral sits in spUSDG; the buffer fronts the payment and drops below target.
        AgentAccount agent = _newAgent(500 * ONE, 1_000 * ONE);
        deal(address(usdg), address(agent), 400 * ONE);
        vm.prank(keeper);
        allocator.allocateAgent(address(agent), address(adapter), 399 * ONE);
        uint256 pay = buffer.available() - 1 * ONE;
        if (pay > 300 * ONE) pay = 300 * ONE;
        vm.prank(signer);
        agent.requestPayment(_req(pay, keccak256("b1"), ISettlementRouter.Mode.Direct));
        assertLt(buffer.available(), buffer.totalAssets() * allocator.bufferTargetBps() / 10_000, "below target");
        uint256 got = allocator.refillBuffer(address(buffer), address(adapter));
        assertGt(got, 0, "refilled from spUSDG");
        allocator.settleDebt(address(agent));
        assertEq(buffer.debtOf(address(agent)), 0, "agent debt settled");

        // Depositor can still get the value back (instantly or through the queue).
        uint256 shares = buffer.balanceOf(depositor);
        uint256 maxR = buffer.maxRedeem(depositor);
        emit log_named_uint("depositor shares", shares);
        emit log_named_uint("instantly redeemable shares", maxR);
        if (maxR > 0) {
            vm.prank(depositor);
            buffer.redeem(maxR, depositor, depositor);
            assertGt(usdg.balanceOf(depositor), 0, "redeemed USDG");
        }
    }
}
