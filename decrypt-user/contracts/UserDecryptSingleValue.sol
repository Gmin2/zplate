// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {FHE, euint32} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

/**
 * @title UserDecryptSingleValue
 * @notice Demonstrates user decryption pattern with CORRECT and WRONG implementations
 * @dev This is a critical educational contract showing the most common permission mistake
 *
 * CRITICAL RULE: FHE.allowThis() MUST come BEFORE FHE.allow()
 *
 * This contract intentionally includes both correct and wrong patterns for learning purposes.
 */
contract UserDecryptSingleValue is ZamaEthereumConfig {
    euint32 private _valueCorrect;
    euint32 private _valueWrong;

    event ValueInitialized(address indexed user, bool isCorrect);

    /**
     * @notice CORRECT PATTERN - User can decrypt this value
     * @dev This is the RIGHT way to grant permissions for user decryption
     *
     * @param value Plaintext value to encrypt and store
     *
     * CORRECT PERMISSION ORDER:
     * 1. FHE.allowThis(_value)  ← Contract gets permission FIRST
     * 2. FHE.allow(_value, msg.sender) ← Then user gets permission
     *
     * WHY THIS ORDER MATTERS:
     * - Contract needs permission to manage the encrypted value
     * - Without allowThis, the contract can't grant permissions to users
     * - This is the ONLY way user decryption will work
     */
    function initializeValueCorrect(uint32 value) external {
        _valueCorrect = FHE.asEuint32(value);

        // ✅ STEP 1: Grant permission to contract FIRST
        FHE.allowThis(_valueCorrect);

        // ✅ STEP 2: Grant permission to user SECOND
        FHE.allow(_valueCorrect, msg.sender);

        emit ValueInitialized(msg.sender, true);
    }

    /**
     * @notice WRONG PATTERN - User CANNOT decrypt this value!
     * @dev This demonstrates the most common mistake in FHEVM development
     *
     * @param value Plaintext value to encrypt and store
     *
     * ❌ MISSING: FHE.allowThis()
     * Result: User decryption will FAIL with permission error
     *
     * COMMON ERROR MESSAGES:
     * - "reencryption error"
     * - "permission denied"
     * - "ACL check failed"
     *
     * This function is intentionally broken for educational purposes!
     */
    function initializeValueWrong(uint32 value) external {
        _valueWrong = FHE.asEuint32(value);

        // ❌ WRONG: Missing FHE.allowThis()!
        // Only calling FHE.allow() is NOT ENOUGH

        FHE.allow(_valueWrong, msg.sender);

        emit ValueInitialized(msg.sender, false);
    }

    /**
     * @notice Get the correctly initialized value
     * @dev User CAN decrypt this value in client code
     *
     * CLIENT-SIDE DECRYPTION (will succeed):
     * ```typescript
     * const handle = await contract.getValueCorrect();
     * const decrypted = await fhevm.userDecryptEuint(
     *   FhevmType.euint32,
     *   handle,
     *   contractAddress,
     *   signer
     * );
     * console.log("Decrypted value:", decrypted); // ✅ Works!
     * ```
     */
    function getValueCorrect() external view returns (euint32) {
        return _valueCorrect;
    }

    /**
     * @notice Get the wrongly initialized value
     * @dev User CANNOT decrypt this value in client code - will throw error!
     *
     * CLIENT-SIDE DECRYPTION (will fail):
     * ```typescript
     * const handle = await contract.getValueWrong();
     * const decrypted = await fhevm.userDecryptEuint(
     *   FhevmType.euint32,
     *   handle,
     *   contractAddress,
     *   signer
     * );
     * // ❌ Throws: "reencryption error" or "permission denied"
     * ```
     */
    function getValueWrong() external view returns (euint32) {
        return _valueWrong;
    }

    /**
     * @notice Example showing permission grant to another user
     * @dev Shows how to grant decryption permission to a third party
     */
    function grantPermissionToUser(address user) external {
        // Contract must have permission first (from initializeValueCorrect)
        FHE.allow(_valueCorrect, user);
    }

    /**
     * @notice Example of temporary permission (for same transaction only)
     * @dev Shows FHE.allowTransient for single-transaction access
     *
     * @param value Value to compute with
     * @return result The result of computation (user can decrypt in same tx)
     */
    function computeAndReturnTemporary(uint32 value) external returns (euint32 result) {
        euint32 input = FHE.asEuint32(value);
        result = FHE.mul(_valueCorrect, input);

        // Transient permission - only valid within this transaction
        FHE.allowTransient(result, msg.sender);

        // User can decrypt 'result' only within this transaction
        // After transaction completes, permission is revoked
    }

    /**
     * @notice DEBUGGING HELPER - Check if value was initialized correctly
     * @dev In production, you'd check if operations succeed
     */
    function isCorrectValueSet() external view returns (bool) {
        return FHE.isInitialized(_valueCorrect);
    }

    function isWrongValueSet() external view returns (bool) {
        return FHE.isInitialized(_valueWrong);
    }
}
