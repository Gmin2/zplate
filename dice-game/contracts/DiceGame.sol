// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {FHE, euint8, euint32, ebool, externalEuint32} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

/**
 * @title DiceGame
 * @notice Simple betting game with encrypted random dice rolls and payouts
 * @dev Demonstrates FHE random number generation and encrypted game mechanics
 *
 * GAME MECHANICS:
 * 1. Player places encrypted bet
 * 2. Player guesses outcome (1-6)
 * 3. Contract rolls encrypted dice
 * 4. If guess matches, player wins 6x bet (house edge of 0%)
 * 5. Results are encrypted - player must decrypt to see outcome
 *
 * FAIRNESS:
 * - Dice roll uses FHE.randEuint8() - cryptographically secure
 * - Result is encrypted until player chooses to reveal
 * - No front-running possible (bet and outcome both encrypted)
 */
contract DiceGame is ZamaEthereumConfig {
    // Game state per player
    struct GameState {
        euint32 currentBet;
        euint8 lastRoll;
        euint32 lastPayout;
        bool hasActiveBet;
    }

    mapping(address => GameState) private _games;
    mapping(address => euint32) private _balances;

    event BetPlaced(address indexed player, bytes32 encryptedAmount);
    event DiceRolled(address indexed player, bytes32 encryptedRoll);
    event PayoutCalculated(address indexed player, bytes32 encryptedPayout);

    /**
     * @notice Deposit funds to play
     * @dev Players must have balance before betting
     */
    function deposit(externalEuint32 inputEuint32, bytes calldata inputProof) external {
        euint32 amount = FHE.fromExternal(inputEuint32, inputProof);

        _balances[msg.sender] = FHE.add(_balances[msg.sender], amount);

        FHE.allowThis(_balances[msg.sender]);
        FHE.allow(_balances[msg.sender], msg.sender);
    }

    /**
     * @notice Place a bet (must deposit first)
     * @dev Bet is encrypted - house doesn't know bet size
     *
     * @param inputEuint32 Encrypted bet amount
     * @param inputProof Proof binding bet to player
     */
    function placeBet(externalEuint32 inputEuint32, bytes calldata inputProof) external {
        require(!_games[msg.sender].hasActiveBet, "Finish current game first");

        euint32 betAmount = FHE.fromExternal(inputEuint32, inputProof);

        // Deduct from balance (no validation - underflow creates huge number)
        _balances[msg.sender] = FHE.sub(_balances[msg.sender], betAmount);

        // Store bet
        _games[msg.sender].currentBet = betAmount;
        _games[msg.sender].hasActiveBet = true;

        FHE.allowThis(_balances[msg.sender]);
        FHE.allow(_balances[msg.sender], msg.sender);

        FHE.allowThis(betAmount);
        FHE.allow(betAmount, msg.sender);

        emit BetPlaced(msg.sender, FHE.toBytes32(betAmount));
    }

    /**
     * @notice Roll dice and calculate payout
     * @dev Uses encrypted random number for fair dice roll
     *
     * @param guess Player's guess (1-6, plaintext)
     *
     * RANDOM DICE ROLL PATTERN:
     * 1. Generate random euint8 (0-255)
     * 2. Modulo 6 to get 0-5 range
     * 3. Add 1 to get 1-6 range
     *
     * PAYOUT LOGIC:
     * - If guess matches: payout = bet * 6
     * - If guess wrong: payout = 0
     * - Uses FHE.select for encrypted conditional
     */
    function rollDice(uint8 guess) external {
        require(_games[msg.sender].hasActiveBet, "No active bet");
        require(guess >= 1 && guess <= 6, "Guess must be 1-6");

        GameState storage game = _games[msg.sender];

        // STEP 1: Generate encrypted random number (0-255)
        euint8 randomValue = FHE.randEuint8();

        // STEP 2: Convert to dice range (0-5)
        euint8 diceValue = FHE.rem(randomValue, 6);

        // STEP 3: Add 1 to get 1-6 range
        euint8 diceRoll = FHE.add(diceValue, FHE.asEuint8(1));

        // Store roll
        game.lastRoll = diceRoll;

        // STEP 4: Check if player won (encrypted comparison)
        ebool won = FHE.eq(diceRoll, FHE.asEuint8(guess));

        // STEP 5: Calculate payout (encrypted conditional)
        // If won: payout = bet * 6
        // If lost: payout = 0
        euint32 winAmount = FHE.mul(game.currentBet, FHE.asEuint32(6));
        euint32 payout = FHE.select(won, winAmount, FHE.asEuint32(0));

        // Store payout
        game.lastPayout = payout;

        // Add payout to balance
        _balances[msg.sender] = FHE.add(_balances[msg.sender], payout);

        // Clear active bet
        game.hasActiveBet = false;

        // Grant permissions
        FHE.allowThis(diceRoll);
        FHE.allow(diceRoll, msg.sender);

        FHE.allowThis(payout);
        FHE.allow(payout, msg.sender);

        FHE.allowThis(_balances[msg.sender]);
        FHE.allow(_balances[msg.sender], msg.sender);

        emit DiceRolled(msg.sender, FHE.toBytes32(diceRoll));
        emit PayoutCalculated(msg.sender, FHE.toBytes32(payout));
    }

    /**
     * @notice Withdraw funds
     */
    function withdraw(externalEuint32 inputEuint32, bytes calldata inputProof) external {
        euint32 amount = FHE.fromExternal(inputEuint32, inputProof);

        _balances[msg.sender] = FHE.sub(_balances[msg.sender], amount);

        FHE.allowThis(_balances[msg.sender]);
        FHE.allow(_balances[msg.sender], msg.sender);
    }

    /**
     * @notice Get player's balance
     * @return Encrypted balance (decrypt client-side)
     */
    function getBalance() external view returns (euint32) {
        return _balances[msg.sender];
    }

    /**
     * @notice Get last dice roll result
     * @return Encrypted dice roll (1-6, decrypt to see result)
     */
    function getLastRoll() external view returns (euint8) {
        return _games[msg.sender].lastRoll;
    }

    /**
     * @notice Get last payout amount
     * @return Encrypted payout (decrypt to see winnings)
     */
    function getLastPayout() external view returns (euint32) {
        return _games[msg.sender].lastPayout;
    }

    /**
     * @notice Get current bet amount
     * @return Encrypted bet (decrypt to see bet size)
     */
    function getCurrentBet() external view returns (euint32) {
        return _games[msg.sender].currentBet;
    }

    /**
     * @notice Check if player has active bet
     */
    function hasActiveBet() external view returns (bool) {
        return _games[msg.sender].hasActiveBet;
    }

    /**
     * @notice Initialize balance for testing
     * @dev Production would only allow deposits
     */
    function initializeBalance(uint32 amount) external {
        _balances[msg.sender] = FHE.asEuint32(amount);

        FHE.allowThis(_balances[msg.sender]);
        FHE.allow(_balances[msg.sender], msg.sender);
    }
}
