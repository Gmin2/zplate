// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {FHE, euint8, euint16, euint32, euint64, ebool, externalEuint32} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

/// @title FHE Operations
/// @author ZCraft Examples
/// @notice Comprehensive showcase of all FHE operations available in FHEVM
/// @dev Reference contract demonstrating arithmetic, comparison, boolean, bitwise, and special operations
contract FHEOperations is ZamaEthereumConfig {
    /// @notice Stored encrypted values for demonstration
    euint32 public storedValue1;
    euint32 public storedValue2;
    ebool public storedBool;

    /// @notice Emitted when values are updated
    event ValuesUpdated(address indexed user);

    /// @notice Emitted when an operation is performed
    event OperationPerformed(string operation);

    constructor() {
        // Initialize with default encrypted values
        storedValue1 = FHE.asEuint32(0);
        storedValue2 = FHE.asEuint32(0);
        storedBool = FHE.asEbool(false);
    }

    // ============ ARITHMETIC OPERATIONS ============

    /// @notice Demonstrates FHE addition
    /// @param a First encrypted operand
    /// @param b Second encrypted operand
    /// @return result The sum of a and b (encrypted)
    function demonstrateAdd(euint32 a, euint32 b) public returns (euint32 result) {
        result = FHE.add(a, b);
    }

    /// @notice Demonstrates FHE subtraction
    /// @param a First encrypted operand
    /// @param b Second encrypted operand
    /// @return result The difference a - b (encrypted)
    function demonstrateSub(euint32 a, euint32 b) public returns (euint32 result) {
        result = FHE.sub(a, b);
    }

    /// @notice Demonstrates FHE multiplication
    /// @param a First encrypted operand
    /// @param b Second encrypted operand
    /// @return result The product of a and b (encrypted)
    function demonstrateMul(euint32 a, euint32 b) public returns (euint32 result) {
        result = FHE.mul(a, b);
    }

    /// @notice Demonstrates FHE division with plaintext divisor
    /// @param a Dividend (encrypted)
    /// @param b Divisor (plaintext)
    /// @return result The quotient a / b (encrypted)
    /// @dev Note: divisor must be plaintext in FHEVM v0.9.1
    function demonstrateDiv(euint32 a, uint32 b) public returns (euint32 result) {
        result = FHE.div(a, b);
    }

    /// @notice Demonstrates FHE remainder/modulo with plaintext divisor
    /// @param a Dividend (encrypted)
    /// @param b Divisor (plaintext)
    /// @return result The remainder a % b (encrypted)
    /// @dev Note: divisor must be plaintext in FHEVM v0.9.1
    function demonstrateRem(euint32 a, uint32 b) public returns (euint32 result) {
        result = FHE.rem(a, b);
    }

    // ============ COMPARISON OPERATIONS ============

    /// @notice Demonstrates FHE equality check
    /// @param a First encrypted operand
    /// @param b Second encrypted operand
    /// @return result True if a == b (encrypted boolean)
    function demonstrateEq(euint32 a, euint32 b) public returns (ebool result) {
        result = FHE.eq(a, b);
    }

    /// @notice Demonstrates FHE inequality check
    /// @param a First encrypted operand
    /// @param b Second encrypted operand
    /// @return result True if a != b (encrypted boolean)
    function demonstrateNe(euint32 a, euint32 b) public returns (ebool result) {
        result = FHE.ne(a, b);
    }

    /// @notice Demonstrates FHE less than
    /// @param a First encrypted operand
    /// @param b Second encrypted operand
    /// @return result True if a < b (encrypted boolean)
    function demonstrateLt(euint32 a, euint32 b) public returns (ebool result) {
        result = FHE.lt(a, b);
    }

    /// @notice Demonstrates FHE less than or equal
    /// @param a First encrypted operand
    /// @param b Second encrypted operand
    /// @return result True if a <= b (encrypted boolean)
    function demonstrateLe(euint32 a, euint32 b) public returns (ebool result) {
        result = FHE.le(a, b);
    }

    /// @notice Demonstrates FHE greater than
    /// @param a First encrypted operand
    /// @param b Second encrypted operand
    /// @return result True if a > b (encrypted boolean)
    function demonstrateGt(euint32 a, euint32 b) public returns (ebool result) {
        result = FHE.gt(a, b);
    }

    /// @notice Demonstrates FHE greater than or equal
    /// @param a First encrypted operand
    /// @param b Second encrypted operand
    /// @return result True if a >= b (encrypted boolean)
    function demonstrateGe(euint32 a, euint32 b) public returns (ebool result) {
        result = FHE.ge(a, b);
    }

    // ============ SPECIAL COMPARISON OPERATIONS ============

    /// @notice Demonstrates FHE minimum
    /// @param a First encrypted operand
    /// @param b Second encrypted operand
    /// @return result The smaller of a and b (encrypted)
    function demonstrateMin(euint32 a, euint32 b) public returns (euint32 result) {
        result = FHE.min(a, b);
    }

    /// @notice Demonstrates FHE maximum
    /// @param a First encrypted operand
    /// @param b Second encrypted operand
    /// @return result The larger of a and b (encrypted)
    function demonstrateMax(euint32 a, euint32 b) public returns (euint32 result) {
        result = FHE.max(a, b);
    }

    // ============ BOOLEAN OPERATIONS ============

    /// @notice Demonstrates FHE logical AND
    /// @param a First encrypted boolean
    /// @param b Second encrypted boolean
    /// @return result True if both a AND b are true (encrypted)
    function demonstrateAnd(ebool a, ebool b) public returns (ebool result) {
        result = FHE.and(a, b);
    }

    /// @notice Demonstrates FHE logical OR
    /// @param a First encrypted boolean
    /// @param b Second encrypted boolean
    /// @return result True if a OR b is true (encrypted)
    function demonstrateOr(ebool a, ebool b) public returns (ebool result) {
        result = FHE.or(a, b);
    }

    /// @notice Demonstrates FHE logical XOR
    /// @param a First encrypted boolean
    /// @param b Second encrypted boolean
    /// @return result True if a XOR b (exactly one is true) (encrypted)
    function demonstrateXor(ebool a, ebool b) public returns (ebool result) {
        result = FHE.xor(a, b);
    }

    /// @notice Demonstrates FHE logical NOT
    /// @param a Encrypted boolean to negate
    /// @return result The logical NOT of a (encrypted)
    function demonstrateNot(ebool a) public returns (ebool result) {
        result = FHE.not(a);
    }

    // ============ CONDITIONAL/SELECT OPERATION ============

    /// @notice Demonstrates FHE conditional select (encrypted if-then-else)
    /// @param condition Encrypted boolean condition
    /// @param ifTrue Value to return if condition is true
    /// @param ifFalse Value to return if condition is false
    /// @return result ifTrue if condition, else ifFalse (all encrypted)
    /// @dev This is the FHE equivalent of: condition ? ifTrue : ifFalse
    function demonstrateSelect(ebool condition, euint32 ifTrue, euint32 ifFalse)
        public
        returns (euint32 result)
    {
        result = FHE.select(condition, ifTrue, ifFalse);
    }

    // ============ BITWISE OPERATIONS ============

    /// @notice Demonstrates FHE bitwise shift left
    /// @param value Value to shift (euint32)
    /// @param bits Number of bits to shift (euint8)
    /// @return result value << bits (encrypted)
    /// @dev Shift amount must be euint8
    function demonstrateShl(euint32 value, euint8 bits) public returns (euint32 result) {
        result = FHE.shl(value, bits);
    }

    /// @notice Demonstrates FHE bitwise shift left with plaintext shift amount
    /// @param value Value to shift (euint32)
    /// @param bits Number of bits to shift (plaintext uint8)
    /// @return result value << bits (encrypted)
    function demonstrateShlPlaintext(euint32 value, uint8 bits) public returns (euint32 result) {
        result = FHE.shl(value, bits);
    }

    /// @notice Demonstrates FHE bitwise shift right
    /// @param value Value to shift (euint32)
    /// @param bits Number of bits to shift (euint8)
    /// @return result value >> bits (encrypted)
    /// @dev Shift amount must be euint8
    function demonstrateShr(euint32 value, euint8 bits) public returns (euint32 result) {
        result = FHE.shr(value, bits);
    }

    /// @notice Demonstrates FHE bitwise shift right with plaintext shift amount
    /// @param value Value to shift (euint32)
    /// @param bits Number of bits to shift (plaintext uint8)
    /// @return result value >> bits (encrypted)
    function demonstrateShrPlaintext(euint32 value, uint8 bits) public returns (euint32 result) {
        result = FHE.shr(value, bits);
    }

    /// @notice Demonstrates FHE bitwise rotate left
    /// @param value Value to rotate (euint32)
    /// @param bits Number of bits to rotate (euint8)
    /// @return result value rotated left by bits (encrypted)
    function demonstrateRotl(euint32 value, euint8 bits) public returns (euint32 result) {
        result = FHE.rotl(value, bits);
    }

    /// @notice Demonstrates FHE bitwise rotate right
    /// @param value Value to rotate (euint32)
    /// @param bits Number of bits to rotate (euint8)
    /// @return result value rotated right by bits (encrypted)
    function demonstrateRotr(euint32 value, euint8 bits) public returns (euint32 result) {
        result = FHE.rotr(value, bits);
    }

    // ============ TYPE CONVERSION/CASTING ============

    /// @notice Demonstrates creating encrypted uint8 from plaintext
    /// @param value Plaintext value to encrypt
    /// @return result Encrypted euint8
    function demonstrateAsEuint8(uint8 value) public returns (euint8 result) {
        result = FHE.asEuint8(value);
    }

    /// @notice Demonstrates creating encrypted uint16 from plaintext
    /// @param value Plaintext value to encrypt
    /// @return result Encrypted euint16
    function demonstrateAsEuint16(uint16 value) public returns (euint16 result) {
        result = FHE.asEuint16(value);
    }

    /// @notice Demonstrates creating encrypted uint32 from plaintext
    /// @param value Plaintext value to encrypt
    /// @return result Encrypted euint32
    function demonstrateAsEuint32(uint32 value) public returns (euint32 result) {
        result = FHE.asEuint32(value);
    }

    /// @notice Demonstrates creating encrypted uint64 from plaintext
    /// @param value Plaintext value to encrypt
    /// @return result Encrypted euint64
    function demonstrateAsEuint64(uint64 value) public returns (euint64 result) {
        result = FHE.asEuint64(value);
    }

    /// @notice Demonstrates creating encrypted boolean from plaintext
    /// @param value Plaintext boolean to encrypt
    /// @return result Encrypted ebool
    function demonstrateAsEbool(bool value) public returns (ebool result) {
        result = FHE.asEbool(value);
    }

    // ============ EXTERNAL INPUT HANDLING ============

    /// @notice Demonstrates handling external encrypted input from user
    /// @param inputValue Encrypted value from user
    /// @param inputProof Zero-knowledge proof for the encrypted value
    /// @dev This pattern is used whenever accepting encrypted data from users
    function demonstrateFromExternal(externalEuint32 inputValue, bytes calldata inputProof)
        public
        returns (euint32 result)
    {
        result = FHE.fromExternal(inputValue, inputProof);

        // Store and set permissions
        storedValue1 = result;
        FHE.allowThis(storedValue1);
        FHE.allow(storedValue1, msg.sender);

        emit ValuesUpdated(msg.sender);
    }

    // ============ COMBINED OPERATIONS EXAMPLE ============

    /// @notice Example combining multiple operations: clamp a value within a range
    /// @param value Value to clamp
    /// @param minValue Minimum allowed value
    /// @param maxValue Maximum allowed value
    /// @return result Value clamped between minValue and maxValue
    /// @dev Demonstrates real-world use: result = min(max(value, minValue), maxValue)
    function demonstrateClamp(euint32 value, euint32 minValue, euint32 maxValue)
        public
        returns (euint32 result)
    {
        // First ensure value is at least minValue
        euint32 atLeastMin = FHE.max(value, minValue);
        // Then ensure it's at most maxValue
        result = FHE.min(atLeastMin, maxValue);
    }

    /// @notice Example: Encrypted if-then-else using select
    /// @param a First value
    /// @param b Second value
    /// @return result Returns a if a > b, otherwise returns b
    /// @dev Demonstrates: if (a > b) return a; else return b;
    function demonstrateConditionalMax(euint32 a, euint32 b) public returns (euint32 result) {
        ebool condition = FHE.gt(a, b);
        result = FHE.select(condition, a, b);
    }

    // ============ STATE MANAGEMENT WITH PERMISSIONS ============

    /// @notice Updates stored values with proper permission handling
    /// @param inputValue1 First encrypted input
    /// @param inputValue2 Second encrypted input
    /// @param inputProof1 Proof for first value
    /// @param inputProof2 Proof for second value
    function updateStoredValues(
        externalEuint32 inputValue1,
        externalEuint32 inputValue2,
        bytes calldata inputProof1,
        bytes calldata inputProof2
    ) external {
        storedValue1 = FHE.fromExternal(inputValue1, inputProof1);
        storedValue2 = FHE.fromExternal(inputValue2, inputProof2);

        // Critical: Grant permissions for contract to use these values
        FHE.allowThis(storedValue1);
        FHE.allowThis(storedValue2);

        // Grant user permission to decrypt
        FHE.allow(storedValue1, msg.sender);
        FHE.allow(storedValue2, msg.sender);

        emit ValuesUpdated(msg.sender);
    }

    /// @notice Performs operation on stored values
    /// @param operation Operation to perform: 0=add, 1=sub, 2=mul, 3=min, 4=max
    /// @return result Result of the operation
    function performOperationOnStored(uint8 operation) external returns (euint32 result) {
        if (operation == 0) {
            result = FHE.add(storedValue1, storedValue2);
            emit OperationPerformed("add");
        } else if (operation == 1) {
            result = FHE.sub(storedValue1, storedValue2);
            emit OperationPerformed("sub");
        } else if (operation == 2) {
            result = FHE.mul(storedValue1, storedValue2);
            emit OperationPerformed("mul");
        } else if (operation == 3) {
            result = FHE.min(storedValue1, storedValue2);
            emit OperationPerformed("min");
        } else if (operation == 4) {
            result = FHE.max(storedValue1, storedValue2);
            emit OperationPerformed("max");
        } else {
            revert("Invalid operation");
        }

        // Grant permissions for result
        FHE.allowThis(result);
        FHE.allow(result, msg.sender);
    }

    /// @notice Gets first stored value
    /// @return The first stored encrypted value
    function getStoredValue1() external view returns (euint32) {
        return storedValue1;
    }

    /// @notice Gets second stored value
    /// @return The second stored encrypted value
    function getStoredValue2() external view returns (euint32) {
        return storedValue2;
    }

    /// @notice Gets stored boolean
    /// @return The stored encrypted boolean
    function getStoredBool() external view returns (ebool) {
        return storedBool;
    }
}
