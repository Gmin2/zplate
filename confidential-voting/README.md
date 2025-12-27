# Confidential Voting

DAO proposal voting with encrypted vote counts for private governance decisions.

## Understanding Voting Privacy

Traditional on-chain voting systems expose every vote publicly, creating several problems for decentralized governance. When votes are transparent, anyone can see how each address voted and track voting patterns in real time. This visibility enables vote buying, where someone can verify you voted as requested and compensate you accordingly. It creates coercion risks, where large stakeholders face pressure to vote certain ways when their positions become public. It allows coordination attacks where political coalitions track defections and punish members who don't vote with the group.

Public vote tallies also distort democratic processes through bandwagon effects. When voters see early results showing a proposal winning or losing, they may change their vote to join the winning side rather than voting their true preference. Proposals that appear to be losing may see reduced participation as voters assume their vote won't matter. Strategic voting replaces honest preference revelation, reducing the legitimacy of governance outcomes.

Confidential voting using Fully Homomorphic Encryption addresses these issues by keeping individual votes and running tallies encrypted throughout the voting process. Voters submit encrypted boolean values representing yes or no positions. The contract increments encrypted counters without ever seeing plaintext votes. Only after voting closes can final results be revealed through authorized decryption, preventing real-time tracking of voting trends and manipulation through strategic timing.

## How Encrypted Vote Counting Works

The mechanism relies on clever arithmetic to count encrypted votes. When a voter submits an encrypted boolean (true for yes, false for no), the contract converts this to an encrypted integer where true becomes 1 and false becomes 0. The yes counter increments by the vote value, which is 1 if yes and 0 if no. The no counter increments by (1 - vote value), which is 0 if yes and 1 if no.

This arithmetic works entirely on encrypted values without revealing individual votes. If someone votes yes, the encrypted 1 gets added to yes votes and encrypted 0 gets added to no votes. If someone votes no, the encrypted 0 gets added to yes votes and encrypted 1 gets added to no votes. The running tallies accumulate these encrypted increments, keeping counts private until authorized decryption.

The boolean to integer conversion is key to making this work. FHE supports arithmetic operations on encrypted integers but needs encrypted booleans converted first. The contract uses FHE.asEuint32 to convert the encrypted boolean to an encrypted integer, then performs subtraction and addition on these encrypted values to calculate the appropriate increments for each counter.

## Proposal Lifecycle

Each proposal goes through a defined lifecycle controlling when voting is allowed. Creation establishes the proposal title, description, and voting period duration. The contract initializes encrypted vote counters at zero and records start and end times. During the active voting window, eligible participants can submit their encrypted votes once.

After the voting period ends, anyone can call the end function to mark the proposal inactive. This prevents further voting and allows result revelation. The proposal creator receives permissions to decrypt the final yes and no vote counts, revealing the outcome while keeping individual votes private. This two-phase approach ensures votes remain secret during the decision period and can only be tallied after all votes are in.

Access control prevents double voting through a mapping that tracks which addresses have voted on each proposal. Before accepting a vote, the contract checks this mapping and reverts if the address already voted. After recording the vote in the encrypted tallies, the contract marks the address as having voted. This ensures one vote per address per proposal while keeping vote choices private.

## Example Usage

Creating a governance proposal with a 24-hour voting period:

```typescript
import { ethers } from "hardhat";

const ConfidentialVoting = await ethers.getContractFactory("ConfidentialVoting");
const voting = await ConfidentialVoting.deploy();
await voting.waitForDeployment();

// Create proposal
const tx = await voting.createProposal(
  "Increase treasury allocation",
  "Proposal to increase treasury allocation by 10%",
  86400 // 24 hours in seconds
);

const receipt = await tx.wait();
// Proposal ID is 0 for first proposal
```

Voting on a proposal with encrypted vote:

```typescript
import { createFhevmInstance } from "@fhevm/sdk";

const fhevm = await createFhevmInstance();

// Create encrypted yes vote (true)
const yesVote = await fhevm
  .createEncryptedInput(votingAddress, voterAddress)
  .addBool(true)
  .encrypt();

// Submit vote
await voting.connect(voter).vote(
  0, // proposal ID
  yesVote.handles[0],
  yesVote.inputProof
);

// Create encrypted no vote (false)
const noVote = await fhevm
  .createEncryptedInput(votingAddress, voterAddress)
  .addBool(false)
  .encrypt();

await voting.connect(anotherVoter).vote(0, noVote.handles[0], noVote.inputProof);
```

Checking voting status and revealing results after voting ends:

```typescript
// Check if voting is still active
const isActive = await voting.isVotingActive(0);

// After voting period ends
await voting.endVoting(0);

// Creator decrypts results
const yesHandle = await voting.getYesVotes(0);
const noHandle = await voting.getNoVotes(0);

const yesCount = await fhevm.userDecryptEuint(
  yesHandle,
  votingAddress,
  creatorAddress
);

const noCount = await fhevm.userDecryptEuint(
  noHandle,
  votingAddress,
  creatorAddress
);

console.log(`Results: ${yesCount} yes, ${noCount} no`);
```

## Common Mistakes to Avoid

Allowing users to vote multiple times without tracking defeats the purpose of fair voting. The contract must maintain a mapping that records which addresses have voted on each proposal. Before accepting a vote, check this mapping and revert if the address already voted. Without this check, malicious users could submit many votes to manipulate outcomes.

Revealing votes or tallies before voting closes enables strategic voting and manipulation. Individual vote values should never appear in events or return values. Running tallies should remain encrypted during the voting period. Only after voting ends should final results be decryptable, preventing real-time tracking of voting trends.

Forgetting that boolean to integer conversion requires specific FHE arithmetic causes implementation errors. You cannot directly use encrypted booleans for arithmetic. Convert the encrypted boolean to an encrypted integer using FHE.asEuint32, then perform calculations. The yes increment is the vote value (1 if yes, 0 if no), and the no increment is (1 - vote value).

Not granting proper FHE permissions means operations will fail. The contract must call FHE.allowThis for encrypted values it operates on. To allow result decryption, call FHE.allow with the authorized address. Missing these permission grants causes reversion when trying to decrypt or perform encrypted operations.

Including vote values in events exposes individual votes publicly. The VoteCast event should only include the proposal ID and voter address, not their vote choice. If you emit the vote value, it becomes public on-chain, defeating the confidentiality purpose. Keep vote values private by omitting them from all events.

## Production Considerations

This is a demonstration contract for educational purposes. Production DAO governance requires significant additional functionality beyond simple yes/no voting on proposals.

Token-weighted voting makes vote power proportional to token holdings rather than one-address-one-vote. Each voter's power should be their token balance at a snapshot block, preventing manipulation through token transfers during voting. The encrypted vote would include both the vote choice and the voter's token weight, requiring more complex arithmetic.

Delegation mechanisms allow token holders to delegate voting power to representatives they trust. Instead of every token holder voting directly, they can assign their voting power to another address. The contract would track delegation relationships and aggregate delegated power when representatives vote.

Quadratic voting reduces plutocratic outcomes by making vote costs increase quadratically. Instead of one token equaling one vote, the cost of votes increases with quantity. Your second vote costs more than your first, your third costs more than your second, and so on. This balances power between large and small stakeholders.

Multi-sig requirements for proposal creation prevent spam. Not anyone should be able to create proposals. Requiring a minimum token threshold, multiple signatures, or whitelist membership ensures only serious proposals reach the voting stage.

Execution mechanisms automatically implement passing proposals on-chain. After a proposal passes, the contract should execute the proposed changes without requiring manual intervention. This might involve calling functions on other contracts, transferring funds, or updating system parameters based on the vote outcome.

## Testing

Run the test suite:

```bash
npm test
```

The tests demonstrate proposal creation, encrypted voting with yes/no options, vote counting arithmetic, double-vote prevention, time window enforcement, privacy guarantees, and edge cases. All assertions validate that encrypted values behave correctly and governance mechanics work as expected.

## Security Notes

This contract has not been audited. It is provided for educational purposes to demonstrate FHE-based voting patterns. Do not use in production without proper security review, comprehensive testing, and professional audit.

The simple one-address-one-vote model is not suitable for production governance. Real DAOs need token-weighted voting to reflect stakeholder interests proportionally. Without token weighting, governance can be manipulated through sybil attacks creating many addresses.

Input proof validation is critical. The contract must verify zero-knowledge proofs to ensure encrypted votes are properly bound to the sender and contract. Never skip proof validation in production, as it prevents vote manipulation.

Access control for administrative functions needs hardening. The demonstration contract allows anyone to create proposals and end voting after the period expires. Production implementations should restrict these actions to authorized addresses or require token thresholds.
