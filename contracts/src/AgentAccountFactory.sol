// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.28;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {Clones} from "@openzeppelin/contracts/proxy/Clones.sol";
import {AgentAccount} from "./AgentAccount.sol";
import {IAgentAccount, IAgentRegistry} from "./interfaces/IUnslept.sol";

interface IRouterBuffers {
    function buffers() external view returns (address[] memory);
}

/// @title AgentAccountFactory
/// @notice Deploys AgentAccounts as minimal clones, keeps the registry the router trusts, and serves the
///         shared configuration every account reads (USDG, router, allocator, EntryPoint).
contract AgentAccountFactory is IAgentRegistry, AccessControl {
    address public immutable implementation;
    address public immutable usdg;
    address public router;
    address public allocator;
    address public entryPoint; // optional, zero disables ERC-4337 entry

    mapping(address => bool) public isAccount;
    mapping(address owner => address[]) internal _accountsOf;

    event AccountCreated(address indexed account, address indexed owner, address indexed signer, bool treasury);
    event ConfigSet(address router, address allocator, address entryPoint);

    error ZeroAddress();

    constructor(address admin, address usdg_) {
        if (admin == address(0) || usdg_ == address(0)) revert ZeroAddress();
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        usdg = usdg_;
        implementation = address(new AgentAccount());
    }

    function setConfig(address router_, address allocator_, address entryPoint_) external onlyRole(DEFAULT_ADMIN_ROLE) {
        router = router_;
        allocator = allocator_;
        entryPoint = entryPoint_;
        emit ConfigSet(router_, allocator_, entryPoint_);
    }

    function buffers() external view returns (address[] memory) {
        return IRouterBuffers(router).buffers();
    }

    /// @notice Creates an agent account owned by msg.sender. Pass signer = address(0) for a project treasury.
    function createAccount(address signer, IAgentAccount.Policy calldata policy, bytes32 salt)
        external
        returns (address account)
    {
        account = Clones.cloneDeterministic(implementation, _salt(msg.sender, salt));
        AgentAccount(payable(account)).initialize(address(this), msg.sender, signer, policy);
        isAccount[account] = true;
        _accountsOf[msg.sender].push(account);
        emit AccountCreated(account, msg.sender, signer, signer == address(0));
    }

    function predictAddress(address owner, bytes32 salt) external view returns (address) {
        return Clones.predictDeterministicAddress(implementation, _salt(owner, salt));
    }

    function accountsOf(address owner) external view returns (address[] memory) {
        return _accountsOf[owner];
    }

    function _salt(address owner, bytes32 salt) internal pure returns (bytes32) {
        return keccak256(abi.encode(owner, salt));
    }
}
