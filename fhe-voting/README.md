# FHE Voting

A confidential voting system where votes and results remain encrypted until the voting session ends, demonstrating advanced FHEVM patterns for boolean operations and vote tallying.

## What You'll Learn

This example teaches intermediate to advanced FHEVM patterns:
- **Boolean to Integer Conversion**: Convert encrypted booleans (0/1) for arithmetic operations
- **Encrypted Vote Counting**: Tally votes without ever decrypting individual ballots
- **Struct with Encrypted Fields**: Organize multiple encrypted values in a struct
- **Time-Based Access Control**: Use deadlines to control voting periods
- **Permission Management**: Grant decryption rights only after voting ends
- **Multiple Encrypted Counters**: Maintain separate tallies for different vote types

## Contract Overview

The `FHEVoting` contract enables confidential voting where individual votes remain private and only the final tally can be decrypted by the owner after voting ends.

### Key Features

```solidity
struct VotingSession {
    euint32 yesVotes;      // Encrypted count of yes votes
    euint32 noVotes;       // Encrypted count of no votes
    euint32 totalVotes;    // Encrypted total votes
    uint64 deadline;       // Plaintext deadline
    bool isActive;         // Whether voting is open
}
```

- `createVotingSession(duration)` - Start a new voting session (owner only)
- `vote(encryptedVote, inputProof)` - Cast an encrypted ballot (0 = no, 1 = yes)
- `endVoting()` - Close voting and grant owner decryption permission
- `getYesVotes()`, `getNoVotes()`, `getTotalVotes()` - Query encrypted results

## Quick Start

### Prerequisites

- Node.js >= 20
- npm >= 7.0.0

### Installation

```bash
npm install
```

### Compile

```bash
npm run compile
```

### Test

```bash
npm run test
```

## Usage Example

```typescript
import { fhevm } from "hardhat";

// Deploy voting contract
const FHEVoting = await ethers.getContractFactory("FHEVoting");
const voting = await FHEVoting.deploy();
const votingAddress = await voting.getAddress();

// Owner creates a voting session (1 hour duration)
await voting.createVotingSession(3600);

// Alice votes YES (1)
const aliceVote = await fhevm
  .createEncryptedInput(votingAddress, aliceAddress)
  .add32(1)  // 1 = yes, 0 = no
  .encrypt();

await voting.connect(alice).vote(
  aliceVote.handles[0],
  aliceVote.inputProof
);

// Bob votes NO (0)
const bobVote = await fhevm
  .createEncryptedInput(votingAddress, bobAddress)
  .add32(0)
  .encrypt();

await voting.connect(bob).vote(
  bobVote.handles[0],
  bobVote.inputProof
);

// Fast-forward time past deadline
await ethers.provider.send("evm_increaseTime", [3601]);
await ethers.provider.send("evm_mine", []);

// Owner ends voting (grants permission to decrypt)
await voting.endVoting();

// Owner decrypts results
const encryptedYesVotes = await voting.getYesVotes();
const yesVotes = await fhevm.userDecryptEuint(
  FhevmType.euint32,
  encryptedYesVotes,
  votingAddress,
  owner
);

console.log(`Yes votes: ${yesVotes}`); // 1
console.log(`No votes: ${await decrypt(voting.getNoVotes())}`); // 1
console.log(`Total votes: ${await decrypt(voting.getTotalVotes())}`); // 2
```

## Key Patterns Demonstrated

### 1. Boolean to Integer Conversion Trick

The core pattern for encrypted vote counting:

```solidity
function vote(externalEuint32 encryptedVote, bytes calldata inputProof) external {
    // Convert vote to encrypted integer (0 or 1)
    euint32 voteValue = FHE.fromExternal(encryptedVote, inputProof);

    // Boolean to integer conversion:
    euint32 one = FHE.asEuint32(1);
    euint32 yesIncrement = voteValue;                    // 1 if yes, 0 if no
    euint32 noIncrement = FHE.sub(one, voteValue);       // 0 if yes, 1 if no

    // Update tallies
    session.yesVotes = FHE.add(session.yesVotes, yesIncrement);
    session.noVotes = FHE.add(session.noVotes, noIncrement);
    session.totalVotes = FHE.add(session.totalVotes, one);
}
```

**How it works**:
- If `voteValue = 1` (yes): `yesIncrement = 1`, `noIncrement = 1 - 1 = 0`
- If `voteValue = 0` (no): `yesIncrement = 0`, `noIncrement = 1 - 0 = 1`

This allows us to increment exactly one counter based on the encrypted vote, without ever decrypting!

### 2. Struct with Multiple Encrypted Fields

```solidity
struct VotingSession {
    euint32 yesVotes;
    euint32 noVotes;
    euint32 totalVotes;
    uint64 deadline;
    bool isActive;
}
```

Combining encrypted and plaintext fields in a struct for organized state management.

### 3. Time-Based Access Control

```solidity
modifier votingActive() {
    require(session.isActive, "Voting is not active");
    require(block.timestamp < session.deadline, "Voting period has ended");
    _;
}
```

Use plaintext timestamps to control when operations are allowed.

### 4. Delayed Permission Granting

```solidity
function endVoting() external onlyOwner {
    require(block.timestamp >= session.deadline, "Voting period not ended");

    session.isActive = false;

    // Only now grant owner permission to decrypt results
    FHE.allow(session.yesVotes, owner);
    FHE.allow(session.noVotes, owner);
    FHE.allow(session.totalVotes, owner);
}
```

Permissions are granted only after voting ends, ensuring results can't be seen during the voting period.

### 5. Double-Voting Prevention

```solidity
mapping(address => bool) public hasVoted;

function vote(...) external {
    require(!hasVoted[msg.sender], "Already voted");
    // ... vote logic
    hasVoted[msg.sender] = true;
}
```

Simple plaintext mapping prevents users from voting multiple times.

## Important Patterns

### Why Use 0 and 1 Instead of ebool?

You might wonder why we use `euint32` with values 0/1 instead of `ebool`:

```solidity
// ❌ Can't do this - can't directly increment counters with ebool
ebool vote = ...;
yesVotes = FHE.add(yesVotes, vote);  // Won't work!

// ✅ Use integer 0/1 instead
euint32 vote = ...;  // 0 or 1
yesVotes = FHE.add(yesVotes, vote);  // Works!
```

The boolean→integer conversion allows us to use encrypted votes directly in arithmetic operations.

### Confidentiality Guarantees

- **During voting**: No one can see individual votes or tallies (all encrypted)
- **After voting ends**: Only the owner can decrypt the final results
- **Vote privacy**: Individual ballots remain encrypted forever - only aggregates are revealed

### Alternative Patterns

For more complex voting systems, you could:

1. **Multiple choices**: Use separate counters for each option
```solidity
mapping(uint256 => euint32) public optionVotes;
```

2. **Weighted voting**: Multiply vote by encrypted token balance
```solidity
euint32 weight = getVotingPower(msg.sender);
yesIncrement = FHE.mul(yesIncrement, weight);
```

3. **Threshold checks**: Use `FHE.select()` to implement quorum requirements
```solidity
euint32 quorum = FHE.asEuint32(100);
ebool hasQuorum = FHE.ge(totalVotes, quorum);
```

## Testing

The test suite demonstrates:

- Creating voting sessions with deadlines
- Casting encrypted yes/no votes
- Preventing double voting
- Correctly tallying mixed votes
- Time-based access control
- Permission management for result decryption
- Event emission

Run tests:

```bash
npm run test
```

### Key Test Cases

1. **Vote Tallying**: Verifies the boolean→integer conversion correctly counts votes
2. **Double Voting Prevention**: Ensures users can only vote once
3. **Time Controls**: Confirms voting can't happen before/after session period
4. **Mixed Votes**: Tests correct tallying when users vote differently
5. **Permission System**: Validates only owner can decrypt after voting ends

## Production Considerations

### 1. Voter Authentication

Add voter registration to control who can vote:

```solidity
mapping(address => bool) public isEligibleVoter;

function registerVoter(address voter) external onlyOwner {
    isEligibleVoter[voter] = true;
}

function vote(...) external {
    require(isEligibleVoter[msg.sender], "Not eligible");
    // ...
}
```

### 2. Multiple Voting Sessions

Reset `hasVoted` when starting a new session:

```solidity
mapping(uint256 => mapping(address => bool)) public hasVoted;
uint256 public sessionId;

function createVotingSession(...) external {
    sessionId++;
    // ...
}
```

### 3. Gateway Decryption for Real-Time Results

For live result updates, use gateway decryption:

```solidity
// Request decryption of current tally
uint256[] memory cts = new uint256[](1);
cts[0] = Gateway.toUint256(session.yesVotes);
Gateway.requestDecryption(cts, ...);
```

### 4. Result Verification

Emit encrypted vote counts in events for transparency:

```solidity
event VotingEnded(euint32 yesVotes, euint32 noVotes, euint32 totalVotes);
```

### 5. Minimum Participation

Add quorum requirements:

```solidity
function endVoting() external {
    euint32 minVotes = FHE.asEuint32(100);
    ebool hasQuorum = FHE.ge(session.totalVotes, minVotes);
    // Use FHE.select() to conditionally proceed
}
```

### 6. Vote Delegation

Allow users to delegate voting power:

```solidity
mapping(address => address) public delegation;
mapping(address => euint32) public votingPower;
```

## Common Pitfalls

### 1. Forgetting to Set Permissions

```solidity
// ❌ Won't work - user can't decrypt
session.yesVotes = FHE.add(session.yesVotes, increment);

// ✅ Always update permissions after state changes
session.yesVotes = FHE.add(session.yesVotes, increment);
FHE.allowThis(session.yesVotes);
```

### 2. Trying to Use ebool for Counting

```solidity
// ❌ Can't add ebool to euint32
ebool vote = ...;
yesVotes = FHE.add(yesVotes, vote);

// ✅ Use euint32 with 0/1 values
euint32 vote = ...;  // Must be 0 or 1
```

### 3. Not Validating Vote Values

In production, validate that votes are actually 0 or 1:

```solidity
// Add bounds checking
euint32 zero = FHE.asEuint32(0);
euint32 one = FHE.asEuint32(1);
ebool isValid = FHE.or(FHE.eq(voteValue, zero), FHE.eq(voteValue, one));
// Use FHE.select() to only count valid votes
```

## Next Steps

After mastering this example, explore:

- **Quadratic Voting** - Weighted voting with encrypted balances
- **DAO Governance** - Proposal creation and multi-option voting
- **Ranked Choice Voting** - Multiple preference ordering
- **Sealed Auction** - Similar confidentiality patterns for bidding

## Resources

- [FHEVM Documentation](https://docs.zama.ai/fhevm)
- [Encrypted Operations](https://docs.zama.ai/protocol/solidity-guides/operators)
- [Permission System](https://docs.zama.ai/protocol/solidity-guides/decryption/decrypt)
- [Boolean Operations](https://docs.zama.ai/protocol/solidity-guides/operators#boolean-operations)

## License

BSD-3-Clause-Clear

---

**Part of ZCraft FHEVM Examples** | Built with Zama FHEVM
