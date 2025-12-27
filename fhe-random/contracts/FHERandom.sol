// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {FHE, euint8, euint32, ebool} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

/// @title FHE Random
/// @author ZCraft Examples
/// @notice Demonstrates encrypted random number generation using FHEVM
/// @dev Educational example showing dice rolling and random number patterns with FHE
contract FHERandom is ZamaEthereumConfig {
    /// @notice Stores the last dice roll for each player
    mapping(address => euint8) private lastDiceRoll;

    /// @notice Stores a random number in custom range for each player
    mapping(address => euint32) private lastRandomNumber;

    /// @notice Stores the total number of rolls per player
    mapping(address => uint256) public totalRolls;

    /// @notice Emitted when a player rolls the dice
    /// @param player The address of the player
    /// @param rollCount The total number of rolls by this player
    event DiceRolled(address indexed player, uint256 rollCount);

    /// @notice Emitted when a random number is generated
    /// @param player The address of the player
    event RandomGenerated(address indexed player);

    /// @notice Rolls a standard 6-sided dice (1-6)
    /// @dev Generates encrypted random number and converts to 1-6 range
    function rollDice() external {
        // Generate random euint8 (0-255)
        euint8 randomValue = FHE.randEuint8();

        // Convert to 0-5 range using modulo
        euint8 diceValue = FHE.rem(randomValue, 6);

        // Add 1 to make it 1-6 range
        euint8 diceRoll = FHE.add(diceValue, FHE.asEuint8(1));

        // Store the roll
        lastDiceRoll[msg.sender] = diceRoll;

        // Grant permissions
        FHE.allowThis(lastDiceRoll[msg.sender]);
        FHE.allow(lastDiceRoll[msg.sender], msg.sender);

        // Track statistics
        totalRolls[msg.sender]++;

        emit DiceRolled(msg.sender, totalRolls[msg.sender]);
    }

    /// @notice Rolls a custom-sided dice (1 to maxValue)
    /// @param maxValue Maximum value for the dice (e.g., 20 for d20)
    /// @dev Generates encrypted random number in range [1, maxValue]
    function rollCustomDice(uint8 maxValue) external {
        require(maxValue > 0, "Max value must be positive");
        require(maxValue <= 255, "Max value too large");

        // Generate random euint8
        euint8 randomValue = FHE.randEuint8();

        // Convert to 0-(maxValue-1) range
        euint8 diceValue = FHE.rem(randomValue, maxValue);

        // Add 1 to make it 1-maxValue range
        euint8 diceRoll = FHE.add(diceValue, FHE.asEuint8(1));

        // Store the roll
        lastDiceRoll[msg.sender] = diceRoll;

        // Grant permissions
        FHE.allowThis(lastDiceRoll[msg.sender]);
        FHE.allow(lastDiceRoll[msg.sender], msg.sender);

        // Track statistics
        totalRolls[msg.sender]++;

        emit DiceRolled(msg.sender, totalRolls[msg.sender]);
    }

    /// @notice Generates a random number in a custom range [min, max]
    /// @param min Minimum value (inclusive)
    /// @param max Maximum value (inclusive)
    /// @dev Demonstrates range conversion for larger numbers using euint32
    function generateRandomInRange(uint32 min, uint32 max) external {
        require(min < max, "Min must be less than max");
        require(max - min <= type(uint32).max, "Range too large");

        // Generate random euint32
        euint32 randomValue = FHE.randEuint32();

        // Calculate range size
        uint32 rangeSize = max - min + 1;

        // Convert to 0-(rangeSize-1) range
        euint32 normalized = FHE.rem(randomValue, rangeSize);

        // Add min to shift to [min, max] range
        euint32 result = FHE.add(normalized, FHE.asEuint32(min));

        // Store the result
        lastRandomNumber[msg.sender] = result;

        // Grant permissions
        FHE.allowThis(lastRandomNumber[msg.sender]);
        FHE.allow(lastRandomNumber[msg.sender], msg.sender);

        emit RandomGenerated(msg.sender);
    }

    /// @notice Generates a simple random boolean (true/false)
    /// @return result Encrypted random boolean
    function randomBool() external returns (ebool result) {
        // Generate random euint8
        euint8 randomValue = FHE.randEuint8();

        // Get least significant bit (0 or 1)
        euint8 bit = FHE.rem(randomValue, 2);

        // Convert to boolean: bit == 1
        result = FHE.eq(bit, FHE.asEuint8(1));

        // Grant permissions
        FHE.allowThis(result);
        FHE.allow(result, msg.sender);

        emit RandomGenerated(msg.sender);
    }

    /// @notice Rolls multiple dice and returns the sum
    /// @param diceCount Number of dice to roll (1-10)
    /// @dev Demonstrates combining multiple random values
    function rollMultipleDice(uint8 diceCount) external {
        require(diceCount > 0 && diceCount <= 10, "Invalid dice count");

        // Initialize sum to 0
        euint8 sum = FHE.asEuint8(0);

        // Roll dice and accumulate
        for (uint8 i = 0; i < diceCount; i++) {
            euint8 randomValue = FHE.randEuint8();
            euint8 diceValue = FHE.rem(randomValue, 6);
            euint8 diceRoll = FHE.add(diceValue, FHE.asEuint8(1));
            sum = FHE.add(sum, diceRoll);
        }

        // Store as euint8 (cast if needed for compatibility)
        lastDiceRoll[msg.sender] = sum;

        // Grant permissions
        FHE.allowThis(lastDiceRoll[msg.sender]);
        FHE.allow(lastDiceRoll[msg.sender], msg.sender);

        // Track statistics
        totalRolls[msg.sender]++;

        emit DiceRolled(msg.sender, totalRolls[msg.sender]);
    }

    /// @notice Gets the last dice roll for the caller
    /// @return The encrypted dice roll value
    /// @dev User must have permission to decrypt this value
    function getLastDiceRoll() external view returns (euint8) {
        return lastDiceRoll[msg.sender];
    }

    /// @notice Gets the last random number generated for the caller
    /// @return The encrypted random number
    function getLastRandomNumber() external view returns (euint32) {
        return lastRandomNumber[msg.sender];
    }

    /// @notice Gets the last dice roll for a specific player
    /// @param player The player's address
    /// @return The encrypted dice roll value
    /// @dev Querying user needs permission to decrypt
    function getDiceRollOf(address player) external view returns (euint8) {
        return lastDiceRoll[player];
    }

    /// @notice Gets the total number of rolls for a player
    /// @param player The player's address
    /// @return The total roll count (plaintext)
    function getTotalRolls(address player) external view returns (uint256) {
        return totalRolls[player];
    }

    /// @notice Demonstrates weighted random selection
    /// @param option1Weight Weight for option 1 (0-100)
    /// @param option2Weight Weight for option 2 (0-100)
    /// @return selected Which option was selected (1 or 2) as encrypted uint8
    /// @dev Total weights must equal 100
    function weightedRandomSelection(uint8 option1Weight, uint8 option2Weight)
        external
        returns (euint8 selected)
    {
        require(option1Weight + option2Weight == 100, "Weights must sum to 100");

        // Generate random number 0-99
        euint8 randomValue = FHE.randEuint8();
        euint8 randomPercent = FHE.rem(randomValue, 100);

        // Check if randomPercent < option1Weight
        ebool selectOption1 = FHE.lt(randomPercent, FHE.asEuint8(option1Weight));

        // Select option 1 or 2 based on condition
        selected = FHE.select(selectOption1, FHE.asEuint8(1), FHE.asEuint8(2));

        // Grant permissions
        FHE.allowThis(selected);
        FHE.allow(selected, msg.sender);

        emit RandomGenerated(msg.sender);
    }
}
