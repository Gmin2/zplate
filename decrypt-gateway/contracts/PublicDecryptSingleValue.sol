// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {FHE, euint32} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

/**
 * @title PublicDecryptSingleValue
 * @notice Demonstrates gateway decryption for public revelation of encrypted values
 * @dev Two-phase pattern: (1) Request decryption (2) Callback with plaintext result
 *
 * GATEWAY DECRYPTION USE CASES:
 * - Revealing auction winners
 * - Publishing vote results
 * - Determining game outcomes
 * - Any scenario requiring encrypted→public transition
 *
 * NOTE: This is a SIMPLIFIED educational example
 * Production apps should use proper gateway integration patterns
 */
contract PublicDecryptSingleValue is ZamaEthereumConfig {
    euint32 private _encryptedValue;
    uint32 public cleartextValue;
    bool public isDecrypted;

    event DecryptionRequested(bytes32 indexed handle);
    event ValueDecrypted(uint32 value);

    /**
     * @notice Initialize with an encrypted value
     * @dev This value will later be decrypted publicly via gateway
     */
    function initializeValue(uint32 value) external {
        _encryptedValue = FHE.asEuint32(value);
        FHE.allowThis(_encryptedValue);
    }

    /**
     * @notice PHASE 1: Request gateway to decrypt the value
     * @dev Marks the value for public decryption
     *
     * WHAT HAPPENS:
     * 1. FHE.makePubliclyDecryptable() registers decryption request
     * 2. Gateway observes this and starts decryption process
     * 3. Once complete, gateway will call finalizeDecryption() with result
     *
     * EVENT-DRIVEN PATTERN:
     * - Emit event so off-chain relayer knows to trigger callback
     * - Handle contains the encrypted value reference
     */
    function requestDecryption() external {
        require(FHE.isInitialized(_encryptedValue), "Value not initialized");
        require(!isDecrypted, "Already decrypted");

        // Mark value for public decryption
        FHE.makePubliclyDecryptable(_encryptedValue);

        emit DecryptionRequested(FHE.toBytes32(_encryptedValue));
    }

    /**
     * @notice PHASE 2: Gateway callback with decrypted value
     * @dev Called by gateway/relayer after decryption completes
     *
     * @param decryptedValue The plaintext result from gateway
     *
     * SECURITY NOTES:
     * - In production, verify msg.sender is authorized gateway
     * - Check signatures/proofs to prevent spoofing
     * - This simplified version is for educational purposes
     *
     * REAL IMPLEMENTATION would include:
     * ```solidity
     * function finalizeDecryption(
     *     bytes32[] calldata handles,
     *     uint256 decryptedValue,
     *     bytes calldata proof
     * ) external onlyGateway {
     *     FHE.checkSignatures(handles, abi.encode(decryptedValue), proof);
     *     cleartextValue = uint32(decryptedValue);
     *     isDecrypted = true;
     * }
     * ```
     */
    function finalizeDecryption(uint32 decryptedValue) external {
        require(!isDecrypted, "Already finalized");

        // Store the plaintext result
        cleartextValue = decryptedValue;
        isDecrypted = true;

        emit ValueDecrypted(decryptedValue);
    }

    /**
     * @notice Get the current encrypted value (before decryption)
     */
    function getEncryptedValue() external view returns (euint32) {
        return _encryptedValue;
    }

    /**
     * @notice Check if value has been publicly decrypted
     */
    function getDecryptionStatus() external view returns (bool decrypted, uint32 value) {
        return (isDecrypted, cleartextValue);
    }
}
