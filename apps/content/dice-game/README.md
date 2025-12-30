# Dice Betting Game

A simple betting game demonstrating encrypted random dice rolls and payouts using Fully Homomorphic Encryption. This template shows how to implement fair, provably random gameplay where neither the player nor the contract operator can predict or manipulate outcomes.

## What You'll Learn

This template demonstrates encrypted random number generation with FHE.randEuint8(), range conversion using modulo operations for dice values (1-6), encrypted conditional logic with FHE.select(), game state management with encrypted bets, and fair gaming mechanics that prevent front-running attacks.

## Core Patterns

### Random Dice Roll (1-6)

The dice roll uses a three-step process to generate a fair random number in the range 1-6. First, we generate an encrypted random number in the full euint8 range (0-255). Then, we use modulo 6 to convert this to the range 0-5. Finally, we add 1 to shift the range to 1-6.

```solidity
function rollDice(uint8 guess) external {
    // STEP 1: Generate encrypted random number (0-255)
    euint8 randomValue = FHE.randEuint8();

    // STEP 2: Convert to dice range (0-5)
    euint8 diceValue = FHE.rem(randomValue, 6);

    // STEP 3: Add 1 to get 1-6 range
    euint8 diceRoll = FHE.add(diceValue, FHE.asEuint8(1));
}
```

### Encrypted Conditional Payout

After rolling the dice, we need to calculate the payout based on whether the player's guess was correct. Since all values are encrypted, we use FHE.eq() to compare the roll with the guess, producing an encrypted boolean. We then use FHE.select() to choose between the win amount (bet multiplied by 6) or zero based on this encrypted condition.

```solidity
// Check if player won (encrypted comparison)
ebool won = FHE.eq(diceRoll, FHE.asEuint8(guess));

// Calculate payout (encrypted conditional)
// If won: payout = bet * 6
// If lost: payout = 0
euint32 winAmount = FHE.mul(currentBet, FHE.asEuint32(6));
euint32 payout = FHE.select(won, winAmount, FHE.asEuint32(0));

// Add payout to balance
_balances[msg.sender] = FHE.add(_balances[msg.sender], payout);
```

## Game Flow

The game follows a standard betting cycle. Players first deposit encrypted funds into their account. They then place an encrypted bet, committing a specific amount without revealing it publicly. Next, they submit their guess (a plaintext number from 1-6) and the contract rolls the encrypted dice. If the guess matches the roll, the player wins 6 times their bet amount. Finally, players can decrypt their results client-side to see the outcome and their updated balance.

## Fairness Guarantees

The dice roll uses FHE.randEuint8() which provides cryptographically secure randomness, not a weak pseudorandom number generator that could be predicted. Since both the bet amount and the dice roll result are encrypted, front-running attacks are impossible. The result remains encrypted until the player chooses to reveal it through decryption. The payout structure provides a 6x multiplier on a 1/6 probability event, resulting in zero house edge.

## Client-Side Usage

```typescript
// Initialize balance
await diceGame.initializeBalance(1000);

// Place bet
const betInput = await fhevm
  .createEncryptedInput(contractAddress, signerAddress)
  .add32(100)
  .encrypt();

await diceGame.placeBet(betInput.handles[0], betInput.inputProof);

// Roll dice with guess (1-6)
await diceGame.rollDice(4);

// Decrypt results
const rollHandle = await diceGame.getLastRoll();
const roll = await fhevm.userDecryptEuint(
  FhevmType.euint8,
  rollHandle,
  contractAddress,
  signer
);

const payoutHandle = await diceGame.getLastPayout();
const payout = await fhevm.userDecryptEuint(
  FhevmType.euint32,
  payoutHandle,
  contractAddress,
  signer
);

console.log(`Rolled: ${roll}, Payout: ${payout}`);
```

## Random Number Generation Pattern

The three-step pattern is important for correct distribution. A common mistake is to use FHE.rem(FHE.randEuint8(), 6) directly, which gives the range 0-5 instead of 1-6. The correct approach generates the random value first, applies modulo to get 0-5, then adds 1 to shift to 1-6.

```solidity
// WRONG - biased distribution
euint8 dice = FHE.rem(FHE.randEuint8(), 6);  // Gives 0-5, not 1-6!

// CORRECT - uniform 1-6 distribution
euint8 randomValue = FHE.randEuint8();      // 0-255
euint8 diceValue = FHE.rem(randomValue, 6); // 0-5
euint8 dice = FHE.add(diceValue, FHE.asEuint8(1)); // 1-6
```

For other random ranges, you can adapt this pattern. A coin flip uses FHE.rem(FHE.randEuint8(), 2) to get 0-1. A d20 die uses FHE.add(FHE.rem(FHE.randEuint8(), 20), 1) for the range 1-20. For any custom range from min to max, use FHE.add(FHE.rem(rand, max-min+1), min).

## Key Concepts

Use type-specific random functions like randEuint8() for small values or randEuint32() for larger ranges to optimize gas costs. The modulo operation converts uniform random distributions to specific ranges. Encrypted conditionals using FHE.select(condition, ifTrue, ifFalse) allow you to implement if-else logic on encrypted values. Game state tracking maintains bets and results per player. Note that you cannot validate encrypted balances on-chain, so client-side validation is necessary before submitting transactions.

## Production Considerations

For production gaming systems, you should add house balance validation to ensure the contract has sufficient funds for payouts. Implement bet limits with minimum and maximum bet sizes to manage risk. Add cooldown periods to prevent spam and potential exploit attempts. For multi-player games, use commit-reveal patterns to ensure fairness. Replace the mock balance system with integration to confidential tokens for real value transfers.

## Quick Start

```bash
npm install
npm run compile
npm test
```

## Next Steps

See the rock-paper-scissors template for two-player commit-reveal gaming patterns. The confidential-bank template provides additional balance management patterns. Refer to TEMPLATE_SPECIFICATIONS.md for more FHE random number generation patterns and advanced gaming mechanics.
