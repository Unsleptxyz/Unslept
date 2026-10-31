// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {UnsleptBuffer} from "../src/UnsleptBuffer.sol";
import {AgentAccount, ISettlementRouter} from "../src/AgentAccount.sol";
import {AgentAccountFactory} from "../src/AgentAccountFactory.sol";
import {SettlementRouter} from "../src/SettlementRouter.sol";
import {Allocator} from "../src/Allocator.sol";
import {FeeModule} from "../src/FeeModule.sol";
import {MockAssetAdapter} from "../src/adapters/MockAssetAdapter.sol";
import {IAgentAccount} from "../src/interfaces/IUnslept.sol";
import {MockUSDG} from "./mocks/Mocks.sol";

abstract contract Base is Test {
    uint256 internal constant ONE = 1e6; // 1 USDG

    MockUSDG usdg;
    UnsleptBuffer buffer;
    AgentAccountFactory factory;
    SettlementRouter router;
    Allocator allocator;
    FeeModule fees;
    MockAssetAdapter adapter;

    address admin = makeAddr("timelock");
    address pauser = makeAddr("multisig");
    address keeper = makeAddr("keeper");
    address depositor = makeAddr("depositor");
    address operator = makeAddr("operator"); // agent owner
    uint256 signerKey = 0xA11CE;
    address signer;
    address merchant = makeAddr("merchant");

    AgentAccount agent;

    function setUp() public virtual {
        signer = vm.addr(signerKey);
        usdg = new MockUSDG();
        fees = new FeeModule(admin, 10); // 0.10%
        factory = new AgentAccountFactory(admin, address(usdg));
        buffer = new UnsleptBuffer(usdg, "Unslept Buffer", "usBUF", admin, pauser, 10_000_000 * ONE, 8_000);
        router = new SettlementRouter(admin, pauser, address(factory), address(fees), address(buffer));
        allocator = new Allocator(admin, pauser, address(factory), 2_000);
        adapter = new MockAssetAdapter(address(usdg), address(this), 5_000_000 * ONE, _staleness());

        vm.startPrank(admin);
        factory.setConfig(address(router), address(allocator), address(0));
        buffer.grantRole(buffer.ROUTER_ROLE(), address(router));
        buffer.grantRole(buffer.ALLOCATOR_ROLE(), address(allocator));
        allocator.grantRole(allocator.KEEPER_ROLE(), keeper);
        allocator.setAdapter(address(adapter), true, 5_000_000 * ONE);
        allocator.setBuffer(address(buffer), true);
        vm.stopPrank();

        agent = _newAgent(operator, signer, 50 * ONE, 200 * ONE);

        // Depositor funds the buffer
        usdg.mint(depositor, 100_000 * ONE);
        vm.startPrank(depositor);
        usdg.approve(address(buffer), type(uint256).max);
        buffer.deposit(100_000 * ONE, depositor);
        vm.stopPrank();
    }

    function _staleness() internal pure virtual returns (uint256) {
        return 1 days;
    }

    function _newAgent(address owner_, address signer_, uint256 perCall, uint256 daily) internal returns (AgentAccount a) {
        vm.prank(owner_);
        a = AgentAccount(
            payable(
                factory.createAccount(
                    signer_,
                    IAgentAccount.Policy({perCallCap: uint128(perCall), dailyCap: uint128(daily)}),
                    keccak256(abi.encode(owner_, signer_, perCall))
                )
            )
        );
        vm.prank(owner_);
        a.setPayee(merchant, true);
    }

    function _fund(AgentAccount a, uint256 amount) internal {
        usdg.mint(address(a), amount);
    }

    function _park(AgentAccount a, uint256 amount) internal {
        vm.prank(keeper);
        allocator.allocateAgent(address(a), address(adapter), amount);
    }

    function _req(address payee, uint256 amount, bytes32 id) internal pure returns (AgentAccount.PaymentRequest memory) {
        return AgentAccount.PaymentRequest({
            payee: payee,
            amount: amount,
            paymentId: id,
            domain: "",
            endpoint: "https://api.example.com/data",
            mode: ISettlementRouter.Mode.Direct
        });
    }

    function _pay(AgentAccount a, uint256 amount, bytes32 id) internal returns (uint256 fee) {
        vm.prank(signer);
        fee = a.requestPayment(_req(merchant, amount, id));
    }
}
