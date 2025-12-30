// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {FHE, euint64, externalEuint64} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

/**
 * @title ConfidentialBank
 * @notice Multi-user bank with encrypted balances, deposits, withdrawals, and transfers
 * @dev Demonstrates essential DeFi patterns with fully homomorphic encryption
 *
 * KEY CONCEPTS:
 * - Multi-user encrypted balance management
 * - Encrypted transfers between users
 * - Permission management for sender and recipient
 * - Cannot validate encrypted balances on-chain (important limitation!)
 *
 * IMPORTANT LIMITATION:
 * You CANNOT do: require(balance >= amount) with encrypted values
 * Solutions: Use FHESafeMath patterns or verify actual transferred amount
 */
contract ConfidentialBank is ZamaEthereumConfig {
    // Encrypted balances for each user
    mapping(address => euint64) private _balances;

    event Deposited(address indexed user, bytes32 encryptedAmount);
    event Withdrawn(address indexed user, bytes32 encryptedAmount);
    event Transferred(address indexed from, address indexed to, bytes32 encryptedAmount);

    /**
     * @notice Deposit encrypted amount to caller's balance
     * @dev User sends encrypted amount with proof
     *
     * @param inputEuint64 External encrypted amount handle
     * @param inputProof Zero-knowledge proof binding input to caller
     */
    function deposit(externalEuint64 inputEuint64, bytes calldata inputProof) external {
        euint64 amount = FHE.fromExternal(inputEuint64, inputProof);

        // Add to user's balance
        _balances[msg.sender] = FHE.add(_balances[msg.sender], amount);

        // Grant permissions
        FHE.allowThis(_balances[msg.sender]);
        FHE.allow(_balances[msg.sender], msg.sender);

        emit Deposited(msg.sender, FHE.toBytes32(amount));
    }

    /**
     * @notice Withdraw encrypted amount from caller's balance
     * @dev IMPORTANT: Cannot validate balance on-chain!
     *
     * @param inputEuint64 External encrypted amount handle
     * @param inputProof Zero-knowledge proof
     *
     * CRITICAL NOTE:
     * ❌ CANNOT DO: require(balance >= amount) - balance is encrypted!
     *
     * In production, consider:
     * - FHESafeMath.tryDecrease() pattern (returns success boolean)
     * - Client-side balance checks before submitting
     * - Accept that underflow results in very large encrypted number
     */
    function withdraw(externalEuint64 inputEuint64, bytes calldata inputProof) external {
        euint64 amount = FHE.fromExternal(inputEuint64, inputProof);

        // Subtract from balance (no on-chain validation possible!)
        _balances[msg.sender] = FHE.sub(_balances[msg.sender], amount);

        // Grant permissions
        FHE.allowThis(_balances[msg.sender]);
        FHE.allow(_balances[msg.sender], msg.sender);

        emit Withdrawn(msg.sender, FHE.toBytes32(amount));
    }

    /**
     * @notice Transfer encrypted amount to another user
     * @dev Demonstrates multi-user encrypted state management
     *
     * @param to Recipient address
     * @param inputEuint64 External encrypted amount
     * @param inputProof Proof binding to sender
     *
     * PATTERN: Must grant permissions to BOTH sender AND recipient!
     */
    function transfer(
        address to,
        externalEuint64 inputEuint64,
        bytes calldata inputProof
    ) external {
        require(to != address(0), "Transfer to zero address");
        require(to != msg.sender, "Cannot transfer to self");

        euint64 amount = FHE.fromExternal(inputEuint64, inputProof);

        // Decrease sender balance
        _balances[msg.sender] = FHE.sub(_balances[msg.sender], amount);

        // Increase recipient balance
        _balances[to] = FHE.add(_balances[to], amount);

        // CRITICAL: Grant permissions to BOTH users
        FHE.allowThis(_balances[msg.sender]);
        FHE.allow(_balances[msg.sender], msg.sender);

        FHE.allowThis(_balances[to]);
        FHE.allow(_balances[to], to);

        emit Transferred(msg.sender, to, FHE.toBytes32(amount));
    }

    /**
     * @notice Get caller's encrypted balance
     * @dev User can decrypt this client-side
     *
     * CLIENT-SIDE USAGE:
     * ```typescript
     * const encryptedBalance = await contract.getBalance();
     * const balance = await fhevm.userDecryptEuint(
     *   FhevmType.euint64,
     *   encryptedBalance,
     *   contractAddress,
     *   signer
     * );
     * ```
     */
    function getBalance() external view returns (euint64) {
        return _balances[msg.sender];
    }

    /**
     * @notice Get balance of specific account
     * @dev Only works if you have permission to decrypt that balance
     *
     * @param account Address to query
     * @return Encrypted balance (decryption requires permission)
     */
    function getBalanceOf(address account) external view returns (euint64) {
        return _balances[account];
    }

    /**
     * @notice Grant balance decryption permission to another address
     * @dev Useful for sharing balance info with third parties (e.g., auditors)
     *
     * @param grantee Address to grant permission to
     */
    function grantPermission(address grantee) external {
        require(grantee != address(0), "Cannot grant to zero address");
        FHE.allow(_balances[msg.sender], grantee);
    }

    /**
     * @notice Initialize balance from plaintext (for testing/setup)
     * @dev In production, users would only deposit encrypted amounts
     */
    function initializeBalance(uint64 amount) external {
        _balances[msg.sender] = FHE.asEuint64(amount);

        FHE.allowThis(_balances[msg.sender]);
        FHE.allow(_balances[msg.sender], msg.sender);
    }
}
