// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/**
 * @title MockUSDC
 * @dev Mock USDC token for testing purposes
 */
contract MockUSDC is ERC20 {
    uint8 private _decimals = 6; // USDC has 6 decimals

    constructor() ERC20("Mock USD Coin", "USDC") {
        // Mint initial supply to deployer for testing
        _mint(msg.sender, 1000000 * 10 ** _decimals); // 1M USDC
    }

    function decimals() public view virtual override returns (uint8) {
        return _decimals;
    }

    /**
     * @dev Mint tokens for testing purposes
     * @param to Address to mint tokens to
     * @param amount Amount to mint (in USDC units with 6 decimals)
     */
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    /**
     * @dev Faucet function for easy testing - gives 1000 USDC to caller
     */
    function faucet() external {
        _mint(msg.sender, 1000 * 10 ** _decimals);
    }
}
