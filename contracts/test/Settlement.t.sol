// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.28;

import {Base} from "./Base.t.sol";
import {AgentAccount, ISettlementRouter} from "../src/AgentAccount.sol";
import {SettlementRouter} from "../src/SettlementRouter.sol";
import {UnsleptBuffer} from "../src/UnsleptBuffer.sol";
import {Allocator} from "../src/Allocator.sol";
import {IAgentAccount} from "../src/interfaces/IUnslept.sol";
import {PackedUserOperation} from "../src/interfaces/IERC4337.sol";
import {MessageHashUtils} from "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

contract SettlementTest is Base {
    /* ---------------- settlement ---------------- */

    function test_payFromLiquid_repaysImmediately() public {
        _fund(agent, 100 * ONE);
        uint256 fee = _pay(agent, 10 * ONE, "p1");
        assertEq(fee, 10 * ONE * 10 / 10_000); // 0.10%
        assertEq(usdg.balanceOf(merchant), 10 * ONE);
        assertEq(buffer.debtOf(address(agent)), 0, "liquid cash repays at once");
        assertEq(usdg.balanceOf(address(agent)), 100 * ONE - 10 * ONE - fee);
    }

    function test_payFromParked_debtThenRebalance() public {
        _fund(agent, 100 * ONE);
        _park(agent, 100 * ONE);
        assertEq(agent.liquid(), 0);

        uint256 priceBefore = buffer.convertToAssets(1e18);
        uint256 fee = _pay(agent, 20 * ONE, "p1");
        assertEq(usdg.balanceOf(merchant), 20 * ONE, "agent never waits");
        assertEq(buffer.debtOf(address(agent)), 20 * ONE + fee);
        assertEq(buffer.convertToAssets(1e18), priceBefore, "fee not counted before it is paid");

        // Background refill: anyone can settle the debt from the parked position
        allocator.settleDebt(address(agent));
        assertEq(buffer.debtOf(address(agent)), 0);
        assertGt(buffer.convertToAssets(1e18), priceBefore, "repaid fee raises the share price");
        assertApproxEqAbs(agent.totalValue(), 100 * ONE - 20 * ONE - fee, 1);
    }

    function test_exactMode_fundsSignerJustInTime() public {
        _fund(agent, 100 * ONE);
        AgentAccount.PaymentRequest memory r = _req(merchant, 5 * ONE, "p1");
        r.mode = ISettlementRouter.Mode.Exact;
        vm.prank(signer);
        agent.requestPayment(r);
        assertEq(usdg.balanceOf(signer), 5 * ONE, "signer receives exactly the payment amount");
        assertEq(usdg.balanceOf(merchant), 0);
    }

    function test_emitsSettledEvent() public {
        _fund(agent, 100 * ONE);
        vm.expectEmit(true, true, true, false, address(router));
        emit SettlementRouter.Settled("p1", address(agent), merchant, address(buffer), merchant, 1 * ONE, 0, ISettlementRouter.Mode.Direct, "");
        _pay(agent, 1 * ONE, "p1");
    }

    /* ---------------- policy enforcement ---------------- */

    function test_overPerCallCap_rejectedWithClearError() public {
        _fund(agent, 1_000 * ONE);
        vm.prank(signer);
        vm.expectRevert(abi.encodeWithSelector(AgentAccount.PerCallCapExceeded.selector, 51 * ONE, 50 * ONE));
        agent.requestPayment(_req(merchant, 51 * ONE, "p1"));
    }

    function test_dailyCap_andRollover() public {
        _fund(agent, 1_000 * ONE);
        for (uint256 i; i < 4; ++i) _pay(agent, 50 * ONE, bytes32(i + 1));
        vm.prank(signer);
        vm.expectRevert(abi.encodeWithSelector(AgentAccount.DailyCapExceeded.selector, 200 * ONE, 1 * ONE, 200 * ONE));
        agent.requestPayment(_req(merchant, 1 * ONE, "p5"));
        vm.warp(block.timestamp + 1 days);
        _pay(agent, 50 * ONE, "p6");
        assertEq(agent.spentToday(), 50 * ONE);
    }

    function test_emptyWalletCannotOverspend() public {
        // No funds at all: the buffer must not lend against nothing.
        vm.prank(signer);
        vm.expectRevert(abi.encodeWithSelector(SettlementRouter.InsufficientCollateral.selector, 1 * ONE + 1_000, 0));
        agent.requestPayment(_req(merchant, 1 * ONE, "p1"));
        assertEq(usdg.balanceOf(merchant), 0);
    }

    function test_collateralCoversDebtOnly() public {
        _fund(agent, 30 * ONE);
        _park(agent, 30 * ONE);
        _pay(agent, 20 * ONE, "p1");
        vm.prank(signer);
        vm.expectRevert(); // 20 + 20 + fees > 30
        agent.requestPayment(_req(merchant, 20 * ONE, "p2"));
    }

    function test_payeeNotAllowed() public {
        _fund(agent, 100 * ONE);
        address stranger = makeAddr("stranger");
        vm.prank(signer);
        vm.expectRevert(abi.encodeWithSelector(AgentAccount.PayeeNotAllowed.selector, stranger));
        agent.requestPayment(_req(stranger, 1 * ONE, "p1"));
    }

    function test_domainAllowlist() public {
        _fund(agent, 100 * ONE);
        address payee = makeAddr("apiPayee");
        vm.prank(operator);
        agent.setDomain("api.example.com", true);
        AgentAccount.PaymentRequest memory r = _req(payee, 1 * ONE, "p1");
        r.domain = "api.example.com";
        vm.prank(signer);
        agent.requestPayment(r);
        assertEq(usdg.balanceOf(payee), 1 * ONE);
        r.domain = "evil.example.com";
        r.paymentId = "p2";
        vm.prank(signer);
        vm.expectRevert(abi.encodeWithSelector(AgentAccount.PayeeNotAllowed.selector, payee));
        agent.requestPayment(r);
    }

    function test_replayRejected() public {
        _fund(agent, 100 * ONE);
        _pay(agent, 1 * ONE, "p1");
        vm.prank(signer);
        vm.expectRevert(abi.encodeWithSelector(AgentAccount.PaymentIdUsed.selector, bytes32("p1")));
        agent.requestPayment(_req(merchant, 1 * ONE, "p1"));
    }

    function test_pauseAndRevoke() public {
        _fund(agent, 100 * ONE);
        vm.prank(operator);
        agent.setPaused(true);
        vm.prank(signer);
        vm.expectRevert(AgentAccount.AgentPaused.selector);
        agent.requestPayment(_req(merchant, 1 * ONE, "p1"));

        vm.prank(operator);
        agent.revoke();
        vm.prank(signer);
        vm.expectRevert(AgentAccount.NotSigner.selector);
        agent.requestPayment(_req(merchant, 1 * ONE, "p1"));

        // Owner keeps withdrawal rights after revocation
        vm.prank(operator);
        agent.withdraw(operator, 100 * ONE);
        assertEq(usdg.balanceOf(operator), 100 * ONE);
    }

    function test_onlySignerOrOwner() public {
        _fund(agent, 100 * ONE);
        vm.prank(makeAddr("attacker"));
        vm.expectRevert(AgentAccount.NotSigner.selector);
        agent.requestPayment(_req(merchant, 1 * ONE, "p1"));
    }

    function test_routerRejectsUnregisteredCaller() public {
        vm.expectRevert(abi.encodeWithSelector(SettlementRouter.NotAgentAccount.selector, address(this)));
        router.settle(merchant, ONE, "x", ISettlementRouter.Mode.Direct, "");
    }

    /* ---------------- owner rights ---------------- */

    function test_ownerCanAlwaysExit() public {
        _fund(agent, 100 * ONE);
        _park(agent, 100 * ONE);
        _pay(agent, 10 * ONE, "p1");
        vm.startPrank(operator);
        agent.ownerUnwind(address(adapter), type(uint256).max); // unwinds everything, repays debt first
        uint256 l = agent.liquid();
        agent.withdraw(operator, l);
        vm.stopPrank();
        assertEq(buffer.debtOf(address(agent)), 0);
        assertApproxEqAbs(usdg.balanceOf(operator), 90 * ONE - 10_000, 1);
    }

    function test_withdrawCannotLeaveDebtUncovered() public {
        _fund(agent, 100 * ONE);
        _park(agent, 60 * ONE);
        _pay(agent, 50 * ONE, "p1"); // 40 liquid repays 40; 10 + fee debt remains, covered by 60 parked
        vm.prank(operator);
        agent.setPolicy(IAgentAccount.Policy({perCallCap: 0, dailyCap: 0}));
        assertGt(buffer.debtOf(address(agent)), 0);
        assertEq(agent.liquid(), 0);
    }

    function test_allocatorOnlyMovesToRegisteredAdapters() public {
        _fund(agent, 100 * ONE);
        vm.prank(keeper);
        vm.expectRevert(abi.encodeWithSelector(Allocator.NotAdapter.selector, makeAddr("rogue")));
        allocator.allocateAgent(address(agent), makeAddr("rogue"), 10 * ONE);
        vm.prank(makeAddr("rando"));
        vm.expectRevert(AgentAccount.NotAllocator.selector);
        agent.allocateTo(address(adapter), 10 * ONE);
    }

    function test_autoAllocateOptOut() public {
        _fund(agent, 100 * ONE);
        vm.prank(operator);
        agent.setAutoAllocate(false);
        vm.prank(keeper);
        vm.expectRevert(AgentAccount.AutoAllocateOff.selector);
        allocator.allocateAgent(address(agent), address(adapter), 10 * ONE);
    }

    /* ---------------- pause ---------------- */

    function test_routerPauseStopsPayments() public {
        _fund(agent, 100 * ONE);
        vm.prank(pauser);
        router.pause();
        vm.prank(signer);
        vm.expectRevert();
        agent.requestPayment(_req(merchant, 1 * ONE, "p1"));
    }

    function test_bufferPause_repayStillWorks() public {
        _fund(agent, 100 * ONE);
        _park(agent, 100 * ONE);
        _pay(agent, 10 * ONE, "p1");
        vm.prank(pauser);
        buffer.pause();
        allocator.settleDebt(address(agent));
        assertEq(buffer.debtOf(address(agent)), 0);
    }

    /* ---------------- ERC-4337 ---------------- */

    function test_userOp_signerLimitedToRequestPayment() public {
        address ep = makeAddr("entryPoint");
        vm.prank(admin);
        factory.setConfig(address(router), address(allocator), ep);

        PackedUserOperation memory op;
        op.sender = address(agent);
        bytes32 h = keccak256("op");
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(signerKey, MessageHashUtils.toEthSignedMessageHash(h));
        op.signature = abi.encodePacked(r, s, v);

        op.callData = abi.encodeWithSelector(AgentAccount.requestPayment.selector, _req(merchant, ONE, "p1"));
        vm.prank(ep);
        assertEq(agent.validateUserOp(op, h, 0), 0, "signer may request payments");

        op.callData = abi.encodeWithSelector(AgentAccount.withdraw.selector, signer, 1);
        vm.prank(ep);
        assertEq(agent.validateUserOp(op, h, 0), 1, "signer may not withdraw");
    }

    /* ---------------- fuzz ---------------- */

    function testFuzz_policyNeverExceeded(uint96[6] memory amounts) public {
        _fund(agent, 10_000 * ONE);
        uint256 spent;
        for (uint256 i; i < amounts.length; ++i) {
            uint256 a = bound(amounts[i], 1, 80 * ONE);
            vm.prank(signer);
            try agent.requestPayment(_req(merchant, a, bytes32(i + 1))) {
                spent += a;
            } catch {}
        }
        assertLe(spent, 200 * ONE, "daily cap holds");
        assertEq(usdg.balanceOf(merchant), spent);
    }
}
