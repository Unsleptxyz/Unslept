// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.28;

import {Base} from "./Base.t.sol";
import {UnsleptBuffer} from "../src/UnsleptBuffer.sol";
import {Allocator} from "../src/Allocator.sol";
import {AgentAccount} from "../src/AgentAccount.sol";
import {UnsleptStaking} from "../src/UnsleptStaking.sol";
import {FeeModule} from "../src/FeeModule.sol";
import {ERC4626Adapter} from "../src/adapters/ERC4626Adapter.sol";
import {MockAssetAdapter} from "../src/adapters/MockAssetAdapter.sol";
import {MockToken, MockTokenizedVault, MockFeed} from "./mocks/Mocks.sol";

contract BufferTest is Base {
    function test_depositWithdraw() public {
        uint256 shares = buffer.balanceOf(depositor);
        vm.prank(depositor);
        buffer.redeem(shares / 2, depositor, depositor);
        assertEq(usdg.balanceOf(depositor), 50_000 * ONE);
    }

    function test_depositCap() public {
        vm.prank(admin);
        buffer.setParams(100_500 * ONE, 8_000, address(0));
        assertEq(buffer.maxDeposit(depositor), 500 * ONE);
        usdg.mint(depositor, 1_000 * ONE);
        vm.prank(depositor);
        vm.expectRevert();
        buffer.deposit(1_000 * ONE, depositor);
    }

    function test_queueWhenUtilizationHigh() public {
        // Agent borrows most of the buffer against a large parked position
        AgentAccount big = _newAgent(operator, signer, 90_000 * ONE, 90_000 * ONE);
        _fund(big, 1_000_000 * ONE);
        vm.prank(admin);
        allocator.setAdapter(address(adapter), true, 10_000_000 * ONE);
        _park(big, 1_000_000 * ONE);
        vm.prank(signer);
        big.requestPayment(_req(merchant, 85_000 * ONE, "big"));
        assertGt(buffer.utilizationBps(), 8_000);

        assertEq(buffer.maxWithdraw(depositor), 0);
        vm.prank(depositor);
        vm.expectRevert(abi.encodeWithSelector(UnsleptBuffer.UseWithdrawQueue.selector, 1_000 * ONE, 0));
        buffer.withdraw(1_000 * ONE, depositor, depositor);

        uint256 shares = buffer.balanceOf(depositor) / 2;
        vm.prank(depositor);
        uint256 id = buffer.requestWithdraw(shares, depositor, depositor);
        assertFalse(buffer.ticket(id).funded, "15k cash cannot fund 50k");

        // Background refill repays the buffer and funds the queue
        allocator.settleDebt(address(big));
        buffer.processQueue(10);
        assertTrue(buffer.ticket(id).funded);
        vm.prank(depositor);
        uint256 got = buffer.claimWithdraw(id);
        assertApproxEqAbs(got, 50_000 * ONE, 1);
        assertEq(usdg.balanceOf(depositor), got);
    }

    function test_queuedAssetsHavePriorityOverAdvances() public {
        AgentAccount big = _newAgent(operator, signer, 90_000 * ONE, 200_000 * ONE);
        vm.prank(admin);
        allocator.setAdapter(address(adapter), true, 10_000_000 * ONE);
        _fund(big, 1_000_000 * ONE);
        _park(big, 1_000_000 * ONE);
        vm.prank(signer);
        big.requestPayment(_req(merchant, 85_000 * ONE, "a"));
        uint256 tenth = buffer.balanceOf(depositor) / 10;
        vm.prank(depositor);
        buffer.requestWithdraw(tenth, depositor, depositor); // ~10k, funded from 15k cash
        uint256 avail = buffer.available();
        assertLt(avail, 6_000 * ONE);
        vm.prank(signer);
        vm.expectRevert();
        big.requestPayment(_req(merchant, avail + 1, "b"));
    }

    function test_pauseStopsDepositsAndWithdrawals() public {
        vm.prank(pauser);
        buffer.pause();
        vm.prank(depositor);
        vm.expectRevert();
        buffer.withdraw(1, depositor, depositor);
        assertEq(buffer.maxDeposit(depositor), 0);
        vm.prank(makeAddr("x"));
        vm.expectRevert();
        buffer.pause();
    }

    function test_onlyRouterCanAdvance() public {
        vm.expectRevert();
        buffer.advance(address(agent), address(this), ONE, 0);
    }

    function test_bufferAllocationRespectsTarget() public {
        vm.prank(keeper);
        vm.expectRevert();
        allocator.allocateBuffer(address(buffer), address(adapter), 90_000 * ONE); // would leave 10% < 20% target
        vm.prank(keeper);
        allocator.allocateBuffer(address(buffer), address(adapter), 70_000 * ONE);
        assertEq(buffer.totalAssets(), 100_000 * ONE);
        // Yield on the buffer's own parked liquidity accrues to depositors
        usdg.mint(address(this), 700 * ONE);
        usdg.approve(address(adapter), 700 * ONE);
        adapter.simulateYield(700 * ONE);
        assertEq(buffer.totalAssets(), 100_700 * ONE);
    }

    function test_refillBufferWhenBelowTarget() public {
        vm.prank(keeper);
        allocator.allocateBuffer(address(buffer), address(adapter), 80_000 * ONE);
        vm.prank(depositor);
        buffer.withdraw(10_000 * ONE, depositor, depositor); // 10k cash left, target is 18k
        uint256 got = allocator.refillBuffer(address(buffer), address(adapter));
        assertGt(got, 0);
        assertGe(buffer.available(), (buffer.totalAssets() * 2_000) / 10_000 - 1);
    }

    function test_perAssetCap() public {
        vm.prank(admin);
        allocator.setAdapter(address(adapter), true, 50 * ONE);
        _fund(agent, 100 * ONE);
        vm.prank(keeper);
        vm.expectRevert(abi.encodeWithSelector(Allocator.CapExceeded.selector, address(adapter), 60 * ONE, 50 * ONE));
        allocator.allocateAgent(address(agent), address(adapter), 60 * ONE);
    }

    function test_staleOracleBlocksAllocation() public {
        _fund(agent, 100 * ONE);
        vm.warp(block.timestamp + 2 days);
        vm.prank(keeper);
        vm.expectRevert();
        allocator.allocateAgent(address(agent), address(adapter), 10 * ONE);
    }

    function test_stakerTierGate() public {
        MockToken tok = new MockToken();
        UnsleptStaking staking = new UnsleptStaking(address(tok), 7 days, 1_000 ether);
        UnsleptBuffer tier = new UnsleptBuffer(usdg, "Unslept Staker Buffer", "usSTK", admin, pauser, 1_000_000 * ONE, 8_000);
        vm.prank(admin);
        tier.setParams(1_000_000 * ONE, 8_000, address(staking));
        usdg.mint(depositor, 100 * ONE);
        vm.startPrank(depositor);
        usdg.approve(address(tier), type(uint256).max);
        vm.expectRevert(UnsleptBuffer.DepositNotAllowed.selector);
        tier.deposit(100 * ONE, depositor);
        tok.mint(depositor, 1_000 ether);
        tok.approve(address(staking), type(uint256).max);
        staking.stake(1_000 ether);
        tier.deposit(100 * ONE, depositor);
        vm.stopPrank();
        assertEq(tier.totalAssets(), 100 * ONE);
    }

    function test_stakerTierUsedFirst() public {
        MockToken tok = new MockToken();
        UnsleptStaking staking = new UnsleptStaking(address(tok), 7 days, 0);
        UnsleptBuffer tier = new UnsleptBuffer(usdg, "Unslept Staker Buffer", "usSTK", admin, pauser, 1_000_000 * ONE, 8_000);
        vm.startPrank(admin);
        tier.setParams(1_000_000 * ONE, 8_000, address(staking));
        tier.grantRole(tier.ROUTER_ROLE(), address(router));
        router.setConfig(address(fees), address(buffer), address(tier));
        vm.stopPrank();
        usdg.mint(depositor, 1_000 * ONE);
        vm.prank(depositor);
        usdg.approve(address(tier), type(uint256).max);
        vm.prank(depositor);
        tier.deposit(1_000 * ONE, depositor);

        _fund(agent, 100 * ONE);
        _park(agent, 100 * ONE);
        _pay(agent, 10 * ONE, "p1");
        assertGt(tier.debtOf(address(agent)), 0, "staker tier lent first");
        assertEq(buffer.debtOf(address(agent)), 0);
        allocator.settleDebt(address(agent));
        assertEq(tier.debtOf(address(agent)), 0);
        assertGt(tier.totalAssets(), 1_000 * ONE, "fee went to the staker tier");
    }

    function test_feeModuleBoundsAndTiers() public {
        vm.prank(admin);
        vm.expectRevert(abi.encodeWithSelector(FeeModule.FeeOutOfBounds.selector, 101, 0, 100));
        fees.setFee(101);

        MockToken tok = new MockToken();
        FeeModule.Tier[] memory t = new FeeModule.Tier[](2);
        t[0] = FeeModule.Tier({minHolding: 100 ether, discountBps: 2_000});
        t[1] = FeeModule.Tier({minHolding: 1_000 ether, discountBps: 5_000});
        vm.startPrank(admin);
        fees.setToken(address(tok), address(0));
        fees.setTiers(t);
        vm.stopPrank();
        assertEq(fees.feeFor(operator, 1_000 * ONE), 1 * ONE);
        tok.mint(operator, 150 ether);
        assertEq(fees.feeFor(operator, 1_000 * ONE), 800_000);
        tok.mint(operator, 900 ether);
        assertEq(fees.feeFor(operator, 1_000 * ONE), 500_000);
    }

    function test_erc4626AdapterWithFeed() public {
        MockTokenizedVault vault = new MockTokenizedVault(usdg);
        MockFeed feed = new MockFeed();
        ERC4626Adapter ref = new ERC4626Adapter(admin, address(usdg), address(vault), address(feed), 1 days, 1_000_000 * ONE);
        usdg.mint(address(this), 1_000 * ONE);
        usdg.approve(address(ref), type(uint256).max);
        ref.deposit(1_000 * ONE);
        assertApproxEqAbs(ref.valueOf(address(this)), 1_000 * ONE, 1);
        usdg.mint(address(vault), 50 * ONE); // asset yield
        assertApproxEqAbs(ref.valueOf(address(this)), 1_050 * ONE, 2);
        uint256 got = ref.withdraw(type(uint256).max, address(this));
        assertApproxEqAbs(got, 1_050 * ONE, 2);

        vm.warp(block.timestamp + 2 days);
        vm.expectRevert();
        ref.valueOf(address(this));
        feed.set(0, block.timestamp);
        vm.expectRevert(ERC4626Adapter.BadPrice.selector);
        ref.valueOf(address(this));
    }

    function test_writeOffOnlyAdmin() public {
        vm.expectRevert();
        buffer.writeOff(address(agent));
    }

    /* fuzz: depositing then redeeming never returns more than deposited */
    function testFuzz_noFreeShares(uint96 amount) public {
        uint256 a = bound(amount, 1, 1_000_000 * ONE);
        address u = makeAddr("u");
        usdg.mint(u, a);
        vm.startPrank(u);
        usdg.approve(address(buffer), a);
        uint256 s = buffer.deposit(a, u);
        uint256 back = buffer.redeem(s, u, u);
        vm.stopPrank();
        assertLe(back, a);
    }

    function testFuzz_mockAdapterRoundTrip(uint96 amount) public {
        uint256 a = bound(amount, 1, 1_000_000 * ONE);
        MockAssetAdapter m = new MockAssetAdapter(address(usdg), address(this), type(uint256).max, 1 days);
        usdg.mint(address(this), a);
        usdg.approve(address(m), a);
        m.deposit(a);
        uint256 got = m.withdraw(type(uint256).max, address(this));
        assertEq(got, a);
    }
}
