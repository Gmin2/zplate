# Vesting Wallet

Time-locked confidential token vesting with cliff periods for team allocations, investor lockups, and grants.

## Understanding the Privacy Problem

Traditional vesting contracts expose all allocation amounts on-chain, allowing anyone to analyze team equity distribution, investor positions, and employee compensation. When a company creates vesting schedules for early employees, competitors can see exactly how much equity each person received. When an investor negotiates a token allocation with a cliff period, the market can observe the exact size of their position. This creates privacy concerns and potential competitive disadvantages.

This contract demonstrates how Fully Homomorphic Encryption (FHE) enables completely private vesting schedules. The total amount being vested remains encrypted throughout the entire lifecycle. Observers can see that a vesting schedule exists and verify the time parameters like start date and cliff duration, but they cannot determine how many tokens are involved. Only the beneficiary can decrypt their allocation details using their private key.

## How Vesting Works

The mechanism combines two time-based controls to create flexible vesting schedules. The cliff period is a duration where no tokens vest at all. This ensures recipients have some commitment period before receiving anything. Common examples include one-year cliffs for employees or six-month cliffs for advisors. During this time, if the beneficiary tries to claim tokens, the transaction will revert.

After the cliff ends, tokens release linearly based on elapsed time. If someone has a four-year vesting schedule with 100,000 tokens, and they've passed the cliff, then at the two-year mark they have 50,000 tokens available. At the three-year mark they have 75,000 tokens available. The calculation is continuous, meaning every block that passes releases a tiny amount more based on the linear schedule.

The contract tracks two encrypted values for each schedule: the total amount being vested, and how much has already been claimed. When a beneficiary claims tokens, the contract calculates how much should be vested at the current time, subtracts what was already claimed, and transfers the remainder. This allows partial claims where someone might claim quarterly or monthly rather than waiting for full vesting.

## Privacy Through Encryption

All token amounts remain encrypted using FHE. When creating a vesting schedule, the caller generates an encrypted value client-side and submits it along with a zero-knowledge proof. The proof cryptographically binds the encrypted value to both the contract address and the sender's address, preventing replay attacks where someone might try to reuse the same encrypted value in a different context.

The contract performs all calculations on these encrypted values without ever seeing plaintext amounts. When computing how many tokens have vested, the multiplication and division operations happen using FHE arithmetic functions. The result stays encrypted throughout the computation. When tokens are claimed, the subtraction to find the claimable amount and the addition to track claimed tokens all happen on encrypted values.

Only the beneficiary can decrypt their vesting details. The contract grants decryption permissions explicitly when creating the schedule and when updating the claimed amount. This means the beneficiary can query their total allocation, see how much they've claimed so far, and verify their remaining balance, all by decrypting values client-side.

## Example Usage

Creating a vesting schedule for an employee with a four-year vesting period and one-year cliff:

```typescript
import { createFhevmInstance } from "@fhevm/sdk";

const fhevm = await createFhevmInstance();

// Create encrypted input for 100,000 tokens
const input = await fhevm
  .createEncryptedInput(contractAddress, creatorAddress)
  .add64(100000)
  .encrypt();

// Create vesting schedule
// Cliff: 31,536,000 seconds (1 year)
// Duration: 126,144,000 seconds (4 years)
const tx = await vestingContract.createVestingSchedule(
  beneficiaryAddress,
  input.handles[0],
  input.inputProof,
  31536000,
  126144000
);

const receipt = await tx.wait();
const scheduleId = /* extract from event */;
```

After the cliff period ends, the beneficiary can claim vested tokens:

```typescript
// Wait until cliff passes (1 year in this example)
// Then claim available tokens
const claimTx = await vestingContract
  .connect(beneficiary)
  .claimVestedTokens(scheduleId);

// Check balance by decrypting
const balanceHandle = await vestingContract.getBalance();
const balance = await fhevm.userDecryptEuint64(
  balanceHandle,
  contractAddress,
  beneficiaryAddress
);

console.log(`Claimed tokens: ${balance}`);
```

The beneficiary can check their vesting status at any time by decrypting the schedule details:

```typescript
// Get total allocation
const totalHandle = await vestingContract.getTotalAmount(scheduleId);
const total = await fhevm.userDecryptEuint64(
  totalHandle,
  contractAddress,
  beneficiaryAddress
);

// Get claimed amount
const claimedHandle = await vestingContract.getClaimedAmount(scheduleId);
const claimed = await fhevm.userDecryptEuint64(
  claimedHandle,
  contractAddress,
  beneficiaryAddress
);

// Calculate remaining
const remaining = total - claimed;
```

## Common Mistakes to Avoid

Setting a cliff duration that exceeds or equals the total duration means tokens never vest. The cliff must be shorter than the total vesting period. For example, a four-year vesting schedule cannot have a four-year cliff.

Attempting to claim before the cliff ends will always revert. The contract checks that the current timestamp is at least startTime plus cliffDuration. If you create a schedule with a one-year cliff, no claims will succeed until one full year has passed.

Time calculations must use seconds, not days or months. A one-year cliff is 31,536,000 seconds, not 365. Using incorrect time units will cause your cliff and duration to be completely wrong.

Integer division in the vesting calculation truncates fractional tokens. If the linear calculation results in 1000.7 tokens being vested, the beneficiary receives 1000 tokens and loses the 0.7 fractional amount. Production systems might use higher precision by scaling amounts before division.

Forgetting to grant FHE decryption permissions to the beneficiary means they cannot see their vesting details. The contract must call both FHE.allowThis and FHE.allow for each encrypted value so the beneficiary can decrypt client-side.

## Production Considerations

This is a demonstration contract for educational purposes. Production implementations would integrate with actual confidential ERC20 token contracts rather than the mock balance system shown here. The vesting schedule would transfer real encrypted tokens from a treasury or reserve into the beneficiary's token balance.

Batch creation of vesting schedules improves gas efficiency when onboarding many employees or distributing to multiple investors. A single transaction could create dozens of schedules with different amounts and time parameters.

Revocation mechanisms handle terminated employees or cancelled grants. The contract could allow schedule creators to revoke unvested tokens, returning them to the treasury while preserving any already-vested amounts.

Emergency pause functionality provides protection during security incidents. Administrators could temporarily halt all claims while investigating potential issues, then resume normal operation once resolved.

Multi-signature requirements for creating high-value vesting schedules add security for large allocations. Requiring multiple authorized signers prevents a single compromised key from creating unauthorized vesting schedules.

## Testing

Run the test suite:

```bash
npm test
```

The tests demonstrate creating schedules with encrypted amounts, claiming after cliff periods, preventing early claims, and verifying linear vesting calculations. All assertions validate that encrypted values behave correctly and that time-based controls work as expected.

## Security Notes

This contract has not been audited. It is provided for educational purposes to demonstrate FHE-based vesting patterns. Do not use in production without proper security review, comprehensive testing, and professional audit.

The mock balance system is not a real token. Production deployments must integrate with confidential ERC20 implementations that properly handle encrypted token transfers, total supply tracking, and standard token interfaces.

Input proof validation is critical. The contract must verify zero-knowledge proofs to ensure encrypted values are properly bound to the sender and contract. Never skip proof validation in production.
