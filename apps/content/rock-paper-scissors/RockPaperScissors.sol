// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {FHE, euint8, ebool, externalEuint8} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

/**
 * @title RockPaperScissors
 * @notice Two-player encrypted game with commit-reveal pattern
 * @dev Demonstrates secure two-player gaming with FHE
 *
 * GAME MECHANICS:
 * 1. Player1 commits encrypted move (1=Rock, 2=Paper, 3=Scissors)
 * 2. Player2 commits encrypted move (1=Rock, 2=Paper, 3=Scissors)
 * 3. Both players reveal (decrypt enabled)
 * 4. Contract determines winner based on game rules
 * 5. Winner receives bet amount from both players
 *
 * FAIRNESS:
 * - Moves are encrypted - neither player sees the other's choice
 * - Both must commit before reveal phase
 * - No front-running possible
 * - Deterministic winner calculation
 */
contract RockPaperScissors is ZamaEthereumConfig {
    // Game state
    struct Game {
        address player1;
        address player2;
        euint8 move1; // 1=Rock, 2=Paper, 3=Scissors
        euint8 move2;
        bool player1Committed;
        bool player2Committed;
        bool isActive;
        uint256 betAmount;
    }

    mapping(uint256 => Game) public games;
    uint256 public nextGameId;

    mapping(address => uint256) public playerBalances;

    event GameCreated(uint256 indexed gameId, address indexed player1, uint256 betAmount);
    event PlayerJoined(uint256 indexed gameId, address indexed player2);
    event MoveCommitted(uint256 indexed gameId, address indexed player);
    event GameResult(uint256 indexed gameId, address indexed winner, uint8 result);

    /**
     * @notice Create a new game
     * @param betAmount Amount to bet (non-encrypted for simplicity)
     */
    function createGame(uint256 betAmount) external returns (uint256) {
        require(playerBalances[msg.sender] >= betAmount, "Insufficient balance");

        uint256 gameId = nextGameId++;

        games[gameId] = Game({
            player1: msg.sender,
            player2: address(0),
            move1: FHE.asEuint8(0),
            move2: FHE.asEuint8(0),
            player1Committed: false,
            player2Committed: false,
            isActive: true,
            betAmount: betAmount
        });

        // Lock bet
        playerBalances[msg.sender] -= betAmount;

        emit GameCreated(gameId, msg.sender, betAmount);
        return gameId;
    }

    /**
     * @notice Join an existing game as player 2
     * @param gameId The game to join
     */
    function joinGame(uint256 gameId) external {
        Game storage game = games[gameId];
        require(game.isActive, "Game not active");
        require(game.player2 == address(0), "Game already full");
        require(msg.sender != game.player1, "Cannot play against yourself");
        require(playerBalances[msg.sender] >= game.betAmount, "Insufficient balance");

        game.player2 = msg.sender;

        // Lock bet
        playerBalances[msg.sender] -= game.betAmount;

        emit PlayerJoined(gameId, msg.sender);
    }

    /**
     * @notice Commit encrypted move
     * @param gameId The game ID
     * @param inputEuint8 Encrypted move (1=Rock, 2=Paper, 3=Scissors)
     * @param inputProof Proof binding move to player
     */
    function commitMove(uint256 gameId, externalEuint8 inputEuint8, bytes calldata inputProof) external {
        Game storage game = games[gameId];
        require(game.isActive, "Game not active");
        require(game.player2 != address(0), "Waiting for player 2");
        require(msg.sender == game.player1 || msg.sender == game.player2, "Not a player");

        euint8 move = FHE.fromExternal(inputEuint8, inputProof);

        if (msg.sender == game.player1) {
            require(!game.player1Committed, "Already committed");
            game.move1 = move;
            game.player1Committed = true;

            FHE.allowThis(move);
            FHE.allow(move, msg.sender);
        } else {
            require(!game.player2Committed, "Already committed");
            game.move2 = move;
            game.player2Committed = true;

            FHE.allowThis(move);
            FHE.allow(move, msg.sender);
        }

        emit MoveCommitted(gameId, msg.sender);

        // If both committed, determine winner
        if (game.player1Committed && game.player2Committed) {
            _determineWinner(gameId);
        }
    }

    /**
     * @notice Determine winner using encrypted logic
     * @dev Uses FHE operations to calculate winner without revealing moves
     *
     * GAME RULES:
     * - Rock (1) beats Scissors (3)
     * - Paper (2) beats Rock (1)
     * - Scissors (3) beats Paper (2)
     * - Same move = Draw
     *
     * RESULT:
     * - 0 = Draw
     * - 1 = Player 1 wins
     * - 2 = Player 2 wins
     */
    function _determineWinner(uint256 gameId) internal {
        Game storage game = games[gameId];

        // Check if moves are equal (draw)
        ebool isDraw = FHE.eq(game.move1, game.move2);

        // Check player 1 win conditions
        // Rock (1) beats Scissors (3)
        ebool p1RockBeatsScissors = FHE.and(FHE.eq(game.move1, FHE.asEuint8(1)), FHE.eq(game.move2, FHE.asEuint8(3)));

        // Paper (2) beats Rock (1)
        ebool p1PaperBeatsRock = FHE.and(FHE.eq(game.move1, FHE.asEuint8(2)), FHE.eq(game.move2, FHE.asEuint8(1)));

        // Scissors (3) beats Paper (2)
        ebool p1ScissorsBeatsPaper = FHE.and(
            FHE.eq(game.move1, FHE.asEuint8(3)),
            FHE.eq(game.move2, FHE.asEuint8(2))
        );

        // Player 1 wins if any win condition is true
        ebool p1Wins = FHE.or(FHE.or(p1RockBeatsScissors, p1PaperBeatsRock), p1ScissorsBeatsPaper);

        // Calculate result: 0 = draw, 1 = p1 wins, 2 = p2 wins
        // If draw: result = 0
        // If p1 wins: result = 1
        // If p2 wins: result = 2
        euint8 drawValue = FHE.asEuint8(0);
        euint8 p1WinValue = FHE.asEuint8(1);
        euint8 p2WinValue = FHE.asEuint8(2);

        // First, select between p1 win (1) and p2 win (2)
        euint8 winnerValue = FHE.select(p1Wins, p1WinValue, p2WinValue);

        // Then, select between winner and draw
        euint8 finalResult = FHE.select(isDraw, drawValue, winnerValue);

        // For demo purposes, make result public (in production, you might want to keep it encrypted)
        FHE.makePubliclyDecryptable(finalResult);

        // In a real implementation, you would:
        // 1. Request gateway decryption
        // 2. Wait for callback with decrypted result
        // 3. Distribute payouts
        //
        // For now, we'll emit event with encrypted result
        // and let players decrypt to see outcome

        game.isActive = false;

        // Note: In production, payout should happen after gateway callback
        // For this demo, we'll distribute based on encrypted result
        // This is a simplified version - real implementation needs gateway integration

        emit GameResult(gameId, address(0), 0); // Placeholder - needs gateway callback
    }

    /**
     * @notice Initialize balance for testing
     * @dev Production would integrate with confidential tokens
     */
    function initializeBalance(uint256 amount) external {
        playerBalances[msg.sender] = amount;
    }

    /**
     * @notice Get player's balance
     */
    function getBalance() external view returns (uint256) {
        return playerBalances[msg.sender];
    }

    /**
     * @notice Get game details
     */
    function getGame(
        uint256 gameId
    )
        external
        view
        returns (
            address player1,
            address player2,
            bool player1Committed,
            bool player2Committed,
            bool isActive,
            uint256 betAmount
        )
    {
        Game storage game = games[gameId];
        return (
            game.player1,
            game.player2,
            game.player1Committed,
            game.player2Committed,
            game.isActive,
            game.betAmount
        );
    }

    /**
     * @notice Get player's move (only readable by that player)
     */
    function getMove(uint256 gameId) external view returns (euint8) {
        Game storage game = games[gameId];
        require(msg.sender == game.player1 || msg.sender == game.player2, "Not a player");

        if (msg.sender == game.player1) {
            return game.move1;
        } else {
            return game.move2;
        }
    }
}
