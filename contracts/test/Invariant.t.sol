// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {Base} from "./Base.t.sol";
import {UnsleptBuffer} from "../src/UnsleptBuffer.sol";
import {AgentAccount, ISettlementRouter} from "../src/AgentAccount.sol";
import {Allocator} from "../src/Allocator.sol";
import {MockAssetAdapter} from "../src/adapters/MockAssetAdapter.sol";
import {MockUSDG} from "./mocks/Mocks.sol";

contract Handler is Test {
    uint256 constant ONE = 1e6;
    UnsleptBuffer buffer;
    Allocator allocator;
    MockAssetAdapter adapter;
    MockUSDG usdg;
    address keeper;
    address merchant;
    address signer;
    address operator;
    address[] public depositors;
    AgentAccount[] public agents;
    uint256[] public ticketIds;

    uint256 public ghostPaid;
    uint256 public calls;

    constructor(
        UnsleptBuffer b,
        Allocator a,
        MockAssetAdapter ad,
        MockUSDG u,
        address keeper_,
        address merchant_,
        address signer_,
        address operator_,
        AgentAccount[] memory agents_
    ) {
        buffer = b;
        allocator = a;
        adapter = ad;
        usdg = u;
        keeper = keeper_;
        merchant = merchant_;
        signer = signer_;
        operator = operator_;
        for (uint256 i; i < agents_.length; ++i) agents.push(agents_[i]);
        for (uint256 i; i < 3; ++i) {
            address d = makeAddr(string(abi.encode("dep", i)));
            depositors.push(d);
            vm.prank(d);
            usdg.approve(address(buffer), type(uint256).max);
        }
    }

    function agentCount() external view returns (uint256) {
        return agents.length;
    }

    function ticketCount() external view returns (uint256) {
        return ticketIds.length;
    }

    function deposit(uint256 i, uint256 amt) external {
        address d = depositors[i % depositors.length];
        amt = bound(amt, 1, 50_000 * ONE);
        usdg.mint(d, amt);
        vm.prank(d);
        try buffer.deposit(amt, d) {} catch {}
        calls++;
    }

    function withdraw(uint256 i, uint256 amt) external {
        address d = depositors[i % depositors.length];
        amt = bound(amt, 0, buffer.maxWithdraw(d));
        if (amt == 0) return;
        vm.prank(d);
        buffer.withdraw(amt, d, d);
        calls++;
    }

    function requestWithdraw(uint256 i, uint256 shares) external {
        address d = depositors[i % depositors.length];
        uint256 bal = buffer.balanceOf(d);
        if (bal == 0) return;
        shares = bound(shares, 1, bal);
        vm.prank(d);
        try buffer.requestWithdraw(shares, d, d) returns (uint256 id) {
            ticketIds.push(id);
        } catch {}
        calls++;
    }

    function processQueue() external {
        buffer.processQueue(20);
    }

    function claim(uint256 k) external {
        if (ticketIds.length == 0) return;
        uint256 id = ticketIds[k % ticketIds.length];
        UnsleptBuffer.Ticket memory t = buffer.ticket(id);
        if (!t.funded || t.claimed) return;
        vm.prank(t.owner);
        buffer.claimWithdraw(id);
        calls++;
    }

    function fundAgent(uint256 j, uint256 amt) external {
        usdg.mint(address(agents[j % agents.length]), bound(amt, 1, 20_000 * ONE));
    }

    function park(uint256 j, uint256 amt) external {
        AgentAccount a = agents[j % agents.length];
        uint256 l = a.liquid();
        if (l == 0) return;
        amt = bound(amt, 1, l);
        vm.prank(keeper);
        try allocator.allocateAgent(address(a), address(adapter), amt) {} catch {}
    }

    function pay(uint256 j, uint256 amt, bytes32 id) external {
        AgentAccount a = agents[j % agents.length];
        amt = bound(amt, 1, 1_000 * ONE);
        vm.prank(signer);
        try a.requestPayment(
            AgentAccount.PaymentRequest({
                payee: merchant,
                amount: amt,
                paymentId: keccak256(abi.encode(id, calls)),
                domain: "",
                endpoint: "e",
                mode: ISettlementRouter.Mode.Direct
            })
        ) {
            ghostPaid += amt;
        } catch {}
        calls++;
    }

    function settleDebt(uint256 j) external {
        try allocator.settleDebt(address(agents[j % agents.length])) {} catch {}
    }

    function ownerWithdraw(uint256 j, uint256 amt) external {
        AgentAccount a = agents[j % agents.length];
        uint256 l = a.liquid();
        if (l == 0) return;
        amt = bound(amt, 1, l);
        vm.prank(operator);
        try a.withdraw(operator, amt) {} catch {}
    }

    function ownerUnwind(uint256 j, uint256 amt) external {
        AgentAccount a = agents[j % agents.length];
        vm.prank(operator);
        try a.ownerUnwind(address(adapter), bound(amt, 1, 50_000 * ONE)) {} catch {}
    }

    function allocateBuffer(uint256 amt) external {
        vm.prank(keeper);
        try allocator.allocateBuffer(address(buffer), address(adapter), bound(amt, 1, 100_000 * ONE)) {} catch {}
    }

    function unwindBuffer(uint256 amt) external {
        vm.prank(keeper);
        try allocator.unwindBuffer(address(buffer), address(adapter), bound(amt, 1, 100_000 * ONE)) {} catch {}
    }

    function yieldAccrues(uint256 amt) external {
        amt = bound(amt, 1, 500 * ONE);
        usdg.mint(address(adapter), amt); // asset appreciation
    }

    function nextDay() external {
        vm.warp(block.timestamp + 1 days);
    }
}

contract InvariantTest is Base {
    Handler handler;

    function _staleness() internal pure override returns (uint256) {
        return 3650 days;
    }

    function setUp() public override {
        super.setUp();
        AgentAccount[] memory list = new AgentAccount[](3);
        list[0] = agent;
        list[1] = _newAgent(operator, signer, 1_000 * ONE, 5_000 * ONE);
        list[2] = _newAgent(operator, signer, 500 * ONE, 100_000 * ONE);
        handler = new Handler(buffer, allocator, adapter, usdg, keeper, merchant, signer, operator, list);
        vm.label(address(handler), "handler");
        targetContract(address(handler));
    }

    /// The buffer can never be drained below what it owes queued and funded withdrawals.
    function invariant_cashCoversReserved() public view {
        assertGe(usdg.balanceOf(address(buffer)), buffer.reserved());
    }

    function invariant_debtsSumToOutstanding() public view {
        uint256 p;
        uint256 f;
        for (uint256 i; i < handler.agentCount(); ++i) {
            (uint256 pi, uint256 fi) = buffer.debtDetail(address(handler.agents(i)));
            p += pi;
            f += fi;
        }
        assertEq(p, buffer.outstandingPrincipal());
        assertEq(f, buffer.outstandingFees());
    }

    function invariant_queueAccounting() public view {
        uint256 funded;
        uint256 unfunded;
        for (uint256 id; id < buffer.ticketCount(); ++id) {
            UnsleptBuffer.Ticket memory t = buffer.ticket(id);
            if (t.funded && !t.claimed) funded += t.assets;
            if (!t.funded) unfunded += t.assets;
        }
        assertEq(funded, buffer.reserved());
        assertEq(unfunded, buffer.queuedAssets());
    }

    function invariant_everyAgentDebtIsCovered() public view {
        for (uint256 i; i < handler.agentCount(); ++i) {
            AgentAccount a = handler.agents(i);
            assertLe(buffer.debtOf(address(a)), a.totalValue() + 2);
        }
    }

    function invariant_accountingIdentity() public view {
        uint256 lhs = buffer.totalAssets() + buffer.reserved() + buffer.queuedAssets();
        uint256 rhs = usdg.balanceOf(address(buffer)) + buffer.outstandingPrincipal() + buffer.adapterValue();
        assertEq(lhs, rhs);
    }

    /// Guards against a handler that silently reverts everywhere.
    function test_handlerPathsSucceed() public {
        handler.fundAgent(0, 1_000e6);
        handler.park(0, 500e6);
        handler.pay(0, 40e6, "a");
        handler.deposit(0, 10_000e6);
        handler.requestWithdraw(0, type(uint256).max);
        assertGt(handler.ghostPaid(), 0, "payments succeed");
        assertGt(handler.ticketCount(), 0, "tickets created");
    }

    function invariant_merchantPaidExactly() public view {
        assertEq(usdg.balanceOf(merchant), handler.ghostPaid());
    }
}
