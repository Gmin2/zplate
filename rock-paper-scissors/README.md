# Rock Paper Scissors

A two-player encrypted game demonstrating the commit-reveal pattern using Fully Homomorphic Encryption. This template shows how to implement fair multiplayer gaming where players cannot see each other's moves until both have committed, preventing cheating and ensuring trustless gameplay.

## What You'll Learn

This template demonstrates the commit-reveal pattern for two-player games, encrypted move submission to prevent front-running, game state management for multiple concurrent matches, encrypted comparison and conditional logic for determining winners, and fair gaming mechanics without a trusted third party.

## Core Patterns

### Commit-Reveal Pattern

The commit-reveal pattern is essential for fair two-player games. Players first commit their encrypted moves without revealing them. Only after both players have committed their moves does the contract evaluate the winner. This prevents the second player from seeing the first player's move and choosing their move accordingly.

```solidity
function commitMove(uint256 gameId, externalEuint8 inputEuint8, bytes calldata inputProof) external {
    Game storage game = games[gameId];
    euint8 move = FHE.fromExternal(inputEuint8, inputProof);

    if (msg.sender == game.player1) {
        game.move1 = move;
        game.player1Committed = true;
    } else {
        game.move2 = move;
        game.player2Committed = true;
    }

    // Determine winner only after both committed
    if (game.player1Committed && game.player2Committed) {
        _determineWinner(gameId);
    }
}
```

### Encrypted Winner Determination

The contract uses encrypted boolean logic to determine the winner without decrypting the moves. It checks all possible win conditions using FHE comparison and logical operations. Rock beats Scissors, Paper beats Rock, and Scissors beats Paper. The result is calculated using encrypted conditionals that select between draw, player 1 wins, or player 2 wins.

```solidity
// Check if moves are equal (draw)
ebool isDraw = FHE.eq(game.move1, game.move2);

// Check player 1 win conditions
ebool p1RockBeatsScissors = FHE.and(
    FHE.eq(game.move1, FHE.asEuint8(1)),
    FHE.eq(game.move2, FHE.asEuint8(3))
);

ebool p1PaperBeatsRock = FHE.and(
    FHE.eq(game.move1, FHE.asEuint8(2)),
    FHE.eq(game.move2, FHE.asEuint8(1))
);

ebool p1ScissorsBeatsPaper = FHE.and(
    FHE.eq(game.move1, FHE.asEuint8(3)),
    FHE.eq(game.move2, FHE.asEuint8(2))
);

// Combine win conditions
ebool p1Wins = FHE.or(FHE.or(p1RockBeatsScissors, p1PaperBeatsRock), p1ScissorsBeatsPaper);

// Calculate result: 0 = draw, 1 = p1 wins, 2 = p2 wins
euint8 finalResult = FHE.select(isDraw, drawValue, FHE.select(p1Wins, p1WinValue, p2WinValue));
```

## Game Flow

The game follows a structured multi-step process. First, Player 1 creates a game by specifying a bet amount, which locks their funds. Player 2 then joins the game by matching the bet, which also locks their funds. Both players commit their encrypted moves where 1 represents Rock, 2 represents Paper, and 3 represents Scissors. Once both moves are committed, the contract automatically determines the winner using encrypted logic. Finally, players can decrypt the result client-side to see the outcome and the winner receives the combined pot.

## Fairness Guarantees

Moves are encrypted using FHE, ensuring neither player can see the other's choice before committing. Both players must commit their moves before the winner is determined, preventing strategic advantage. The encrypted logic makes front-running impossible since moves cannot be observed in the mempool. Winner calculation is deterministic and based on the classic game rules, ensuring no manipulation is possible. The contract acts as a trustless referee without seeing the actual moves.

## Client-Side Usage

```typescript
// Initialize balances
await game.connect(alice).initializeBalance(1000);
await game.connect(bob).initializeBalance(1000);

// Alice creates game
const tx = await game.connect(alice).createGame(100);
const receipt = await tx.wait();
const gameId = 0; // First game

// Bob joins
await game.connect(bob).joinGame(gameId);

// Alice commits Rock (1)
const aliceInput = await fhevm
  .createEncryptedInput(contractAddress, alice.address)
  .add8(1)
  .encrypt();

await game.connect(alice).commitMove(gameId, aliceInput.handles[0], aliceInput.inputProof);

// Bob commits Paper (2)
const bobInput = await fhevm
  .createEncryptedInput(contractAddress, bob.address)
  .add8(2)
  .encrypt();

await game.connect(bob).commitMove(gameId, bobInput.handles[0], bobInput.inputProof);

// Decrypt moves to verify
const aliceMoveHandle = await game.connect(alice).getMove(gameId);
const aliceMove = await fhevm.userDecryptEuint(
  FhevmType.euint8,
  aliceMoveHandle,
  contractAddress,
  alice
);

console.log(`Alice played: ${aliceMove === 1n ? 'Rock' : aliceMove === 2n ? 'Paper' : 'Scissors'}`);
```

## Move Encoding

The contract uses a simple numeric encoding for moves. The value 1 represents Rock, 2 represents Paper, and 3 represents Scissors. Any other value is invalid and should be validated client-side before submission. This encoding allows for efficient encrypted comparison operations.

## Key Concepts

The commit-reveal pattern prevents information leakage by ensuring both players commit before any reveal. Encrypted boolean logic using FHE.and, FHE.or, and FHE.eq enables complex game rule evaluation without decryption. Game state tracking maintains multiple concurrent games with independent state for each match. Permission management ensures only game participants can access their own moves. The contract provides trustless execution where no centralized authority is needed to determine the winner.

## Production Considerations

For production multiplayer gaming systems, you should integrate the Gateway pattern for result decryption to enable automatic payout distribution. Implement timeout mechanisms to handle cases where a player abandons the game after committing. Add re-entry protection and proper state validation to prevent exploit attempts. Replace the mock balance system with integration to confidential tokens for real value transfers. Consider adding a ranking or ELO system for competitive play. Implement game history tracking for player statistics and dispute resolution.

## Comparison with Traditional Approaches

Traditional smart contract implementations of Rock Paper Scissors face a fundamental problem: the second player can see the first player's move in the transaction mempool and choose their move accordingly. Previous solutions require complex commit-reveal schemes with hash commitments and reveal phases, adding multiple transaction rounds and gas costs. FHE eliminates these problems entirely by allowing both players to commit encrypted moves simultaneously without the need for separate reveal transactions or hash-based commitments.

## Quick Start

```bash
npm install
npm run compile
npm test
```

## Next Steps

See the dice-game template for single-player encrypted gaming patterns. The confidential-bank template demonstrates balance management that can be extended for gaming economies. Refer to advanced gaming patterns for tournament systems, matchmaking, and multiplayer scenarios beyond two players.
