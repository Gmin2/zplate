// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {FHE, euint32, externalEuint32, ebool} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

/// @title FHE Simple Vault
/// @author ZCraft Examples
/// @notice A basic encrypted vault demonstrating FHE balance management and access control
/// @dev This example shows encrypted deposits, withdrawals, and balance queries with proper permission handling
contract FHESimpleVault is ZamaEthereumConfig {
    /// @notice Mapping of user addresses to their encrypted balances
    mapping(address => euint32) private balances;

    /// @notice Emitted when a user deposits funds
    /// @param user The address of the depositor
    event Deposit(address indexed user);

    /// @notice Emitted when a user withdraws funds
    /// @param user The address of the withdrawer
    event Withdrawal(address indexed user);

    /// @notice Deposits an encrypted amount into the caller's vault balance
    /// @param inputAmount The encrypted amount to deposit
    /// @param inputProof The proof for the encrypted input
    /// @dev The encrypted amount is added to the caller's existing balance
    /// @dev Permissions are granted for both the contract and the caller to access the updated balance
    function deposit(externalEuint32 inputAmount, bytes calldata inputProof) external {
        // Convert external encrypted input to internal encrypted type
        euint32 amount = FHE.fromExternal(inputAmount, inputProof);

        // Add the deposited amount to the user's balance
        balances[msg.sender] = FHE.add(balances[msg.sender], amount);

        // Grant permissions: contract and user can access the balance
        FHE.allowThis(balances[msg.sender]);
        FHE.allow(balances[msg.sender], msg.sender);

        emit Deposit(msg.sender);
    }

    /// @notice Withdraws an encrypted amount from the caller's vault balance
    /// @param inputAmount The encrypted amount to withdraw
    /// @param inputProof The proof for the encrypted input
    /// @dev The function checks if the user has sufficient balance before allowing withdrawal
    /// @dev Permissions are granted for both the contract and the caller to access the updated balance
    function withdraw(externalEuint32 inputAmount, bytes calldata inputProof) external {
        // Convert external encrypted input to internal encrypted type
        euint32 amount = FHE.fromExternal(inputAmount, inputProof);

        // Check if balance >= amount (encrypted comparison)
        ebool hasSufficientBalance = FHE.ge(balances[msg.sender], amount);

        // Only subtract if user has sufficient balance
        // If insufficient, balance remains unchanged
        euint32 amountToSubtract = FHE.select(hasSufficientBalance, amount, FHE.asEuint32(0));
        balances[msg.sender] = FHE.sub(balances[msg.sender], amountToSubtract);

        // Grant permissions: contract and user can access the balance
        FHE.allowThis(balances[msg.sender]);
        FHE.allow(balances[msg.sender], msg.sender);

        emit Withdrawal(msg.sender);
    }

    /// @notice Returns the caller's encrypted vault balance
    /// @return The encrypted balance handle that can be decrypted by the caller
    /// @dev The caller must have permission to decrypt this value
    function getBalance() external view returns (euint32) {
        return balances[msg.sender];
    }

    /// @notice Returns the encrypted vault balance for a specific user
    /// @param user The address to query
    /// @return The encrypted balance handle for the specified user
    /// @dev Only the contract owner or authorized parties should call this
    /// @dev The user whose balance is queried must have granted permission to the caller
    function getBalanceOf(address user) external view returns (euint32) {
        return balances[user];
    }
}
