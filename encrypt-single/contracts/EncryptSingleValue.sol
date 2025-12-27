// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {FHE, euint32, externalEuint32} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

/**
 * @title EncryptSingleValue
 * @notice Demonstrates accepting a single encrypted user input with proof validation
 * @dev This contract shows the essential pattern for handling encrypted inputs from users
 *
 * KEY LEARNING POINTS:
 * 1. FHE.fromExternal validates the input proof and creates an encrypted value
 * 2. Input proof must bind to BOTH contract address AND user address
 * 3. Wrong signer cannot send encrypted data for another user
 * 4. Missing or invalid proof causes transaction to revert
 */
contract EncryptSingleValue is ZamaEthereumConfig {
    // Mapping to store each user's encrypted value
    mapping(address => euint32) private _values;

    /**
     * @notice Event emitted when a user stores an encrypted value
     * @param user The address that stored the value
     */
    event ValueStored(address indexed user);

    /**
     * @notice Store an encrypted value for the caller
     * @dev This is the ESSENTIAL PATTERN for accepting encrypted user inputs
     *
     * @param inputProof The zero-knowledge proof binding the input to this contract and user
     * @param inputEuint32 The encrypted handle for the euint32 value
     *
     * CRITICAL SECURITY:
     * - inputProof MUST be generated for this specific contract address
     * - inputProof MUST be generated for the msg.sender address
     * - FHE.fromExternal will REVERT if proof validation fails
     *
     * CLIENT-SIDE PATTERN (using fhevmjs):
     * ```typescript
     * const encryptedInput = await fhevm
     *   .createEncryptedInput(contractAddress, signerAddress)
     *   .add32(42)  // The plaintext value to encrypt
     *   .encrypt();
     *
     * await contract.storeEncryptedValue(
     *   encryptedInput.inputProof,
     *   encryptedInput.handles[0]
     * );
     * ```
     */
    function storeEncryptedValue(externalEuint32 inputEuint32, bytes calldata inputProof) external {
        // STEP 1: Validate proof and convert handle to encrypted value
        // This will REVERT if:
        // - Proof is invalid
        // - Proof was created for different contract address
        // - Proof was created for different user address
        euint32 encryptedValue = FHE.fromExternal(inputEuint32, inputProof);

        // STEP 2: Store the encrypted value
        _values[msg.sender] = encryptedValue;

        // STEP 3: Grant permissions
        // Contract needs permission to use this value
        FHE.allowThis(encryptedValue);

        // User needs permission to decrypt their own value
        FHE.allow(encryptedValue, msg.sender);

        emit ValueStored(msg.sender);
    }

    /**
     * @notice Get the encrypted value for the caller
     * @dev The returned value can only be decrypted by authorized addresses
     * @return The encrypted euint32 value
     *
     * DECRYPTION (client-side):
     * ```typescript
     * const handle = await contract.getValue();
     * const decrypted = await fhevm.userDecryptEuint(
     *   FhevmType.euint32,
     *   handle,
     *   contractAddress,
     *   signer
     * );
     * console.log("My value:", decrypted);
     * ```
     */
    function getValue() external view returns (euint32) {
        return _values[msg.sender];
    }

    /**
     * @notice Get the encrypted value for a specific user (only if you have permission)
     * @param user The address to query
     * @return The encrypted euint32 value (will revert on decrypt if you don't have permission)
     */
    function getValueOf(address user) external view returns (euint32) {
        return _values[user];
    }

    /**
     * @notice COMMON MISTAKE EXAMPLE - This will fail!
     * @dev This function demonstrates what DOESN'T work
     *
     *  WRONG: Cannot initialize from plaintext and expect client to decrypt
     * The client won't have permission because we didn't call FHE.allow()
     */
    function initializeValueWrong(uint32 value) external {
        _values[msg.sender] = FHE.asEuint32(value);
        // Missing: FHE.allowThis() and FHE.allow()
        // User CANNOT decrypt this value!
    }

    /**
     * @notice CORRECT WAY - Initialize from plaintext with proper permissions
     * @dev This shows the correct pattern for contract-generated encrypted values
     */
    function initializeValueCorrect(uint32 value) external {
        euint32 encryptedValue = FHE.asEuint32(value);

        _values[msg.sender] = encryptedValue;

        // CRITICAL: Must grant permissions for user decryption
        FHE.allowThis(encryptedValue);
        FHE.allow(encryptedValue, msg.sender);

        emit ValueStored(msg.sender);
    }
}
