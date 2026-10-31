// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.28;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC4626, IERC20} from "@openzeppelin/contracts/token/ERC20/extensions/ERC4626.sol";

contract MockUSDG is ERC20 {
    constructor() ERC20("Global Dollar (mock)", "USDG") {}

    function decimals() public pure override returns (uint8) {
        return 6;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

contract MockToken is ERC20 {
    constructor() ERC20("Unslept (mock)", "UNSLEPT") {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

/// @notice Tokenized-asset stand-in with an ERC-4626 interface over USDG.
contract MockTokenizedVault is ERC4626 {
    constructor(IERC20 usdg) ERC20("Tokenized T-bill (mock)", "mTBILL") ERC4626(usdg) {}
}

contract MockFeed {
    int256 public answer = 1e8;
    uint256 public updatedAt;

    constructor() {
        updatedAt = block.timestamp;
    }

    function set(int256 a, uint256 t) external {
        answer = a;
        updatedAt = t;
    }

    function latestRoundData() external view returns (uint80, int256, uint256, uint256, uint80) {
        return (1, answer, updatedAt, updatedAt, 1);
    }
}
