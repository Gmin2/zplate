// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {FHE, euint32, euint64, ebool, eaddress, externalEuint32, externalEuint64, externalEbool, externalEaddress} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

/**
 * @title EncryptMultipleValues
 * @notice Demonstrates accepting multiple encrypted values of different types in a single transaction
 * @dev This shows the gas-efficient pattern for batching encrypted inputs
 *
 * KEY BENEFITS:
 * 1. Single proof validates ALL encrypted inputs (gas optimization)
 * 2. Supports multiple encrypted types in one call
 * 3. Maintains type safety with proper handle ordering
 *
 * IMPORTANT: Handle order in client MUST match parameter order in contract
 */
contract EncryptMultipleValues is ZamaEthereumConfig {
    // Storage for different encrypted types per user
    mapping(address => ebool) private _boolValues;
    mapping(address => euint32) private _uint32Values;
    mapping(address => euint64) private _uint64Values;
    mapping(address => eaddress) private _addressValues;

    event ValuesStored(address indexed user, uint8 valueCount);

    /**
     * @notice Store multiple encrypted values in a single transaction
     * @dev ONE proof validates ALL inputs - this is a gas optimization pattern
     *
     * @param inputEbool External handle for encrypted boolean
     * @param inputEuint32 External handle for encrypted uint32
     * @param inputEuint64 External handle for encrypted uint64
     * @param inputEaddress External handle for encrypted address
     * @param inputProof Single proof that validates ALL four inputs
     *
     * CRITICAL: Parameter order MUST match client-side handle order!
     *
     * CLIENT-SIDE PATTERN:
     * ```typescript
     * const input = await fhevm
     *   .createEncryptedInput(contractAddress, signerAddress)
     *   .addBool(true)        // handles[0]
     *   .add32(100)           // handles[1]
     *   .add64(1000000)       // handles[2]
     *   .addAddress("0x...") // handles[3]
     *   .encrypt();
     *
     * await contract.storeMultipleValues(
     *   input.handles[0],  // ebool
     *   input.handles[1],  // euint32
     *   input.handles[2],  // euint64
     *   input.handles[3],  // eaddress
     *   input.inputProof   // Single proof for all!
     * );
     * ```
     */
    function storeMultipleValues(
        externalEbool inputEbool,
        externalEuint32 inputEuint32,
        externalEuint64 inputEuint64,
        externalEaddress inputEaddress,
        bytes calldata inputProof
    ) external {
        // Convert external handles to encrypted values
        // All validated by the SAME proof - this is the optimization!
        ebool encryptedBool = FHE.fromExternal(inputEbool, inputProof);
        euint32 encryptedUint32 = FHE.fromExternal(inputEuint32, inputProof);
        euint64 encryptedUint64 = FHE.fromExternal(inputEuint64, inputProof);
        eaddress encryptedAddress = FHE.fromExternal(inputEaddress, inputProof);

        // Store all values
        _boolValues[msg.sender] = encryptedBool;
        _uint32Values[msg.sender] = encryptedUint32;
        _uint64Values[msg.sender] = encryptedUint64;
        _addressValues[msg.sender] = encryptedAddress;

        // Grant permissions for all values
        FHE.allowThis(encryptedBool);
        FHE.allow(encryptedBool, msg.sender);

        FHE.allowThis(encryptedUint32);
        FHE.allow(encryptedUint32, msg.sender);

        FHE.allowThis(encryptedUint64);
        FHE.allow(encryptedUint64, msg.sender);

        FHE.allowThis(encryptedAddress);
        FHE.allow(encryptedAddress, msg.sender);

        emit ValuesStored(msg.sender, 4);
    }

    /**
     * @notice Store partial set of values (demonstrates flexible patterns)
     * @dev Shows you can have different functions with different combinations
     */
    function storeBoolAndUint(
        externalEbool inputEbool,
        externalEuint32 inputEuint32,
        bytes calldata inputProof
    ) external {
        ebool encryptedBool = FHE.fromExternal(inputEbool, inputProof);
        euint32 encryptedUint32 = FHE.fromExternal(inputEuint32, inputProof);

        _boolValues[msg.sender] = encryptedBool;
        _uint32Values[msg.sender] = encryptedUint32;

        FHE.allowThis(encryptedBool);
        FHE.allow(encryptedBool, msg.sender);

        FHE.allowThis(encryptedUint32);
        FHE.allow(encryptedUint32, msg.sender);

        emit ValuesStored(msg.sender, 2);
    }

    // Getter functions
    function getBoolValue() external view returns (ebool) {
        return _boolValues[msg.sender];
    }

    function getUint32Value() external view returns (euint32) {
        return _uint32Values[msg.sender];
    }

    function getUint64Value() external view returns (euint64) {
        return _uint64Values[msg.sender];
    }

    function getAddressValue() external view returns (eaddress) {
        return _addressValues[msg.sender];
    }

    /**
     * @notice Get all values at once
     * @return All four encrypted values for the caller
     */
    function getAllValues()
        external
        view
        returns (ebool, euint32, euint64, eaddress)
    {
        return (
            _boolValues[msg.sender],
            _uint32Values[msg.sender],
            _uint64Values[msg.sender],
            _addressValues[msg.sender]
        );
    }
}
