# Confidential Airdrop

Private token distribution where airdrop amounts remain confidential through encryption.

## Understanding Airdrop Privacy

Traditional token airdrops expose allocation amounts on-chain for anyone to analyze. When projects distribute tokens to early supporters, investors, or community members, every allocation becomes public information. This creates transparency but at the cost of privacy. Competitors can analyze distribution patterns to understand go-to-market strategy and user acquisition targets. Large recipients become targets for phishing attacks and social engineering. Early claimers signal their allocation sizes to later participants, potentially influencing claiming behavior and market perception.

The public nature of traditional airdrops also enables unwanted analysis. Blockchain analysts can track distributions to identify whale addresses, measure participation rates, and correlate wallet behaviors. This information asymmetry favors sophisticated observers over regular participants. Projects lose control over how distribution data gets used and interpreted.

Confidential airdrops using Fully Homomorphic Encryption solve these privacy issues while maintaining necessary transparency. The eligibility criteria remain public and verifiable. The time window for claiming is clear to all participants. But the actual token amounts involved stay encrypted. Only recipients can decrypt their allocations using private keys. Observers see that an airdrop happened and who claimed, but not how much anyone received.

## How Confidential Claiming Works

The airdrop contract stores an encrypted amount set during deployment. This could be a fixed allocation that all eligible users receive, or production implementations could support tiered amounts based on different criteria. The encrypted value never appears in plaintext on-chain. When someone claims their airdrop, the contract transfers this encrypted amount to their balance and grants decryption permissions.

The claiming process is straightforward. An eligible user calls the claim function during the active time window. The contract checks that they haven't claimed before using a mapping that tracks claim status per address. If eligible and within the time window, the contract marks them as claimed, transfers the encrypted amount, and emits an event. The event intentionally omits the amount to preserve privacy. Only the timestamp and claimer address appear in the event log.

After claiming, recipients can decrypt their balance client-side using the FHEVM SDK. They import their wallet, connect to the contract, fetch their encrypted balance handle, and decrypt it locally. This decryption happens off-chain on their device. Nobody else sees the plaintext amount unless the recipient chooses to share it. This puts privacy control in the hands of users rather than exposing everything publicly by default.

## Time Windows and Access Control

Airdrops operate within defined time windows for fairness and practical management. The contract sets a start time and end time during deployment. Before the start time, claiming reverts. After the end time, claiming reverts. Only during the active window can eligible users claim their allocations.

This time-based access control serves multiple purposes. It ensures all participants have equal opportunity to claim within a known period. It creates urgency that encourages prompt claiming rather than indefinite delay. It allows the project to plan token distribution schedules and communicate clear deadlines. After the window closes, any unclaimed tokens can be recovered by the contract owner, preventing permanent lock of undistributed funds.

The implementation uses simple timestamp checks. Solidity's block.timestamp provides the current time in seconds since Unix epoch. The contract compares this against stored start and end times to determine if claiming is currently allowed. Production systems might add buffer periods, multiple claim windows, or staged rollouts, but the core mechanism remains time-based permission gating.

## Example Usage

Deploying a confidential airdrop with 1000 tokens per user and 24-hour claim window:

```typescript
import { ethers } from "hardhat";

// Deploy airdrop contract
const ConfidentialAirdrop = await ethers.getContractFactory("ConfidentialAirdrop");
const airdrop = await ConfidentialAirdrop.deploy(
  1000, // amount per claimer
  86400 // duration (24 hours in seconds)
);

await airdrop.waitForDeployment();
```

Users can check if the airdrop is currently active:

```typescript
const isActive = await airdrop.isActive();
const timeRemaining = await airdrop.getTimeRemaining();

console.log(`Active: ${isActive}`);
console.log(`Time remaining: ${timeRemaining} seconds`);
```

Claiming an airdrop allocation:

```typescript
// Check if already claimed
const hasClaimed = await airdrop.hasClaimed(userAddress);

if (!hasClaimed) {
  // Claim allocation
  const tx = await airdrop.connect(user).claim();
  await tx.wait();
  
  console.log("Successfully claimed airdrop!");
}
```

Verifying received amount by decrypting balance:

```typescript
import { createFhevmInstance } from "@fhevm/sdk";

const fhevm = await createFhevmInstance();

// Get encrypted balance handle
const balanceHandle = await airdrop.connect(user).getBalance();

// Decrypt balance locally
const decryptedBalance = await fhevm.userDecryptEuint(
  balanceHandle,
  airdropAddress,
  userAddress
);

console.log(`Received ${decryptedBalance} tokens`);
```

Owner recovering unclaimed tokens after deadline:

```typescript
// After end time passes
await airdrop.connect(owner).recoverUnclaimedTokens();
```

## Common Mistakes to Avoid

Setting time windows incorrectly creates usability issues. A duration of 3600 means one hour, not one day. One day is 86400 seconds. Using 24 instead of 86400 would create a 24-second claim window. Always verify time calculations in seconds.

Forgetting double-claim prevention allows users to repeatedly claim. The contract must track who has claimed using a mapping and check this before transferring tokens. Without this check, malicious users could drain the airdrop.

Not granting proper FHE permissions means users cannot decrypt their balances. The contract must call FHE.allowThis for itself to perform operations, and FHE.allow for the recipient to decrypt. Missing either permission breaks the functionality.

Including amounts in events defeats the privacy purpose. If the Claimed event emits the claimed amount, it becomes public on-chain. Events should only include addresses and timestamps, not encrypted values or their plaintext equivalents.

The encrypted amount is fixed at deployment in this simple implementation. All claimers receive the same allocation. If you need different tiers, you must implement additional logic to determine allocation per user. The current contract cannot support variable amounts without modification.

## Production Considerations

This is a demonstration contract for educational purposes. Production implementations would integrate with actual ERC7984 confidential tokens for real value transfer. The mock balance system shown here only simulates token distribution.

Merkle tree proofs enable gas-efficient eligibility verification for large airdrops. Instead of storing a whitelist on-chain, the contract stores a single Merkle root. Claimers submit proofs that their address is in the eligible set. This scales to millions of participants while keeping gas costs manageable.

Multiple allocation tiers support differentiated distributions. Early adopters might receive more than late joiners. Long-term holders could get larger allocations than recent acquirers. The contract would hash user address plus tier identifier to look up their specific allocation amount.

Vesting schedules prevent immediate token dumps. Instead of transferring liquid tokens, the airdrop could create vesting contracts with cliff periods. Recipients get tokens locked for a period before they become transferable, aligning incentives for long-term participation.

Emergency pause functionality protects against discovered vulnerabilities. If an exploit is found mid-airdrop, administrators need ability to halt claiming while investigating. The pause should not affect already-claimed allocations, only prevent new claims until resolved.

Anti-sybil mechanisms prevent gaming through multiple addresses. Rate limiting based on IP addresses, requiring social media verification, or implementing proof-of-humanity checks help ensure fair distribution to real users rather than bot farms.

## Testing

Run the test suite:

```bash
npm test
```

The tests demonstrate claiming mechanics, double-claim prevention, time window enforcement, privacy guarantees, and edge cases. All assertions validate that encrypted values behave correctly and access controls work as expected.

## Security Notes

This contract has not been audited. It is provided for educational purposes to demonstrate FHE-based airdrop patterns. Do not use in production without proper security review, comprehensive testing, and professional audit.

The mock balance system is not a real token. Production deployments must integrate with confidential ERC7984 implementations that properly handle encrypted token transfers, balances, and standard token interfaces.

Reentrancy protection is needed for production. The demonstration contract lacks ReentrancyGuard on the claim function. While the simple implementation isn't vulnerable, production code should use OpenZeppelin's ReentrancyGuard as a safety measure.

Access control for owner functions must be robust. The recovery function uses a simple owner check. Production implementations should use OpenZeppelin's Ownable or AccessControl for standardized, well-tested access management.
