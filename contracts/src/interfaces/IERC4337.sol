// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.28;

/// @notice ERC-4337 v0.7 packed user operation, as defined by the EntryPoint v0.7 contracts.
struct PackedUserOperation {
    address sender;
    uint256 nonce;
    bytes initCode;
    bytes callData;
    bytes32 accountGasLimits;
    uint256 preVerificationGas;
    bytes32 gasFees;
    bytes paymasterAndData;
    bytes signature;
}

interface IAccount {
    /// @return validationData 0 for a valid signature, 1 (SIG_VALIDATION_FAILED) otherwise.
    function validateUserOp(PackedUserOperation calldata userOp, bytes32 userOpHash, uint256 missingAccountFunds)
        external
        returns (uint256 validationData);
}
