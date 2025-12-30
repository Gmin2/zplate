# FHE Simple Vault

An encrypted vault contract demonstrating balance management, access control, and safe encrypted arithmetic with FHEVM.

## What You'll Learn

This example teaches intermediate FHEVM patterns:

- **Encrypted Balance Management**: Store and manage encrypted balances per user
- **Conditional Logic with FHE**: Use `FHE.select()` for encrypted if/else logic
- **Encrypted Comparisons**: Check balances with `FHE.gte()` without decryption
- **Multi-User State**: Manage isolated encrypted state for multiple users
- **Safe Withdrawal Patterns**: Prevent overdraft using encrypted checks

## Contract Overview

The `FHESimpleVault` contract maintains encrypted balances for users, allowing deposits and withdrawals without revealing amounts on-chain.

### Key Features

```solidity
mapping(address => euint32) private balances;  // Encrypted balances
```

- `deposit(inputAmount, inputProof)` - Add encrypted funds to your balance
- `withdraw(inputAmount, inputProof)` - Remove encrypted funds with balance check
- `getBalance()` - Get your encrypted balance for decryption
- `getBalanceOf(user)` - Query another user's encrypted balance

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

// Deploy vault
const FHESimpleVault = await ethers.getContractFactory("FHESimpleVault");
const vault = await FHESimpleVault.deploy();
const vaultAddress = await vault.getAddress();

// Deposit 100 units
const depositInput = await fhevm
  .createEncryptedInput(vaultAddress, userAddress)
  .add32(100)
  .encrypt();

await vault.deposit(
  depositInput.handles[0],
  depositInput.inputProof
);

// Withdraw 30 units
const withdrawInput = await fhevm
  .createEncryptedInput(vaultAddress, userAddress)
  .add32(30)
  .encrypt();

await vault.withdraw(
  withdrawInput.handles[0],
  withdrawInput.inputProof
);

// Check balance
const encryptedBalance = await vault.getBalance();
const balance = await fhevm.userDecryptEuint(
  FhevmType.euint32,
  encryptedBalance,
  vaultAddress,
  signer
);

console.log(`Remaining balance: ${balance}`); // 70
```

## Key Patterns Demonstrated

### 1. Encrypted Balance Management

```solidity
mapping(address => euint32) private balances;

function deposit(externalEuint32 inputAmount, bytes calldata inputProof) external {
    euint32 amount = FHE.fromExternal(inputAmount, inputProof);
    balances[msg.sender] = FHE.add(balances[msg.sender], amount);

    FHE.allowThis(balances[msg.sender]);
    FHE.allow(balances[msg.sender], msg.sender);
}
```

Each user has their own encrypted balance that accumulates deposits.

### 2. Safe Encrypted Withdrawal with Conditional Logic

```solidity
function withdraw(externalEuint32 inputAmount, bytes calldata inputProof) external {
    euint32 amount = FHE.fromExternal(inputAmount, inputProof);

    // Check if balance >= amount (returns encrypted boolean)
    ebool hasSufficientBalance = FHE.gte(balances[msg.sender], amount);

    // Only subtract if sufficient balance exists
    euint32 amountToSubtract = FHE.select(
        hasSufficientBalance,  // condition
        amount,                // value if true
        FHE.asEuint32(0)      // value if false
    );

    balances[msg.sender] = FHE.sub(balances[msg.sender], amountToSubtract);
}
```

**Key Insight**: We can't use regular `if` statements with encrypted values. Instead:
- `FHE.ge()` performs encrypted comparison, returns `ebool`
- `FHE.select()` implements encrypted conditional: `condition ? valueIfTrue : valueIfFalse`
- Everything stays encrypted - no decryption needed!

### 3. Encrypted Comparison Operations

```solidity
ebool hasSufficientBalance = FHE.ge(balances[msg.sender], amount);
```

Available encrypted comparisons:
- `FHE.eq()` - Equal to
- `FHE.ne()` - Not equal to
- `FHE.lt()` - Less than
- `FHE.le()` - Less than or equal
- `FHE.gt()` - Greater than
- `FHE.ge()` - Greater than or equal

All return `ebool` (encrypted boolean).

### 4. Permission System

```solidity
FHE.allowThis(balances[msg.sender]);  // Contract can use this value
FHE.allow(balances[msg.sender], msg.sender);  // User can decrypt
```

Permissions must be set after every state change to encrypted values.

### 5. Multi-User State Isolation

```solidity
mapping(address => euint32) private balances;
```

Each address has completely isolated encrypted state - no user can see another's balance without explicit permission.

## Important Patterns

### Handling Insufficient Balance

This contract uses a **silent failure** pattern - if you try to withdraw more than your balance, the transaction succeeds but your balance doesn't change:

```solidity
// If balance < amount:
//   hasSufficientBalance = false (encrypted)
//   amountToSubtract = 0 (encrypted)
//   balance = balance - 0 = balance (unchanged)
```

**Alternative Pattern** (for production):
You could use gateway decryption to check balance and revert:

```solidity
// Check balance via gateway, then revert if insufficient
```

### Why Not Regular `require()`?

```solidity
// ❌ This won't work - can't decrypt in contract
require(balance >= amount, "Insufficient balance");

// ✅ Use encrypted conditional instead
euint32 amountToSubtract = FHE.select(
    FHE.ge(balance, amount),
    amount,
    FHE.asEuint32(0)
);
```

Regular `require()` needs a plaintext boolean, but our comparison is encrypted!

## Testing

The test suite demonstrates:

- Depositing encrypted amounts
- Accumulating multiple deposits
- Withdrawing valid amounts
- Handling overdraft attempts (balance remains unchanged)
- Multi-user balance isolation
- Balance queries with decryption
- Event emission

Run tests:

```bash
npm run test
```

## Production Considerations

### 1. Add Event Data

Currently events just emit the user address. Consider adding encrypted amount handles:

```solidity
event Deposit(address indexed user, euint32 encryptedAmount);
```

### 2. Minimum Balance Checks

Add minimum balance requirements:

```solidity
require(amount >= MINIMUM_DEPOSIT, "Deposit too small");
```

### 3. Gateway Decryption for Errors

For better UX, use gateway decryption to check balances and provide clear error messages:

```solidity
// Request decryption of balance check
// Revert with clear message if insufficient
```

### 4. Access Control for `getBalanceOf`

Currently anyone can query anyone's encrypted balance. Add access control:

```solidity
require(
    msg.sender == user || hasPermission(msg.sender, user),
    "Unauthorized"
);
```

## Next Steps

After mastering this example, explore:

- **Confidential Bank** - Gateway decryption and interest calculations
- **ERC7984** - Confidential ERC20 token standard
- **Sealed Auction** - Bid sealing and revealing patterns

## Resources

- [FHEVM Documentation](https://docs.zama.ai/fhevm)
- [Conditional Operations](https://docs.zama.ai/protocol/solidity-guides/operators#select)
- [Comparison Operations](https://docs.zama.ai/protocol/solidity-guides/operators#comparison-operations)
- [Permission System](https://docs.zama.ai/protocol/solidity-guides/decryption/decrypt)

## License

BSD-3-Clause-Clear

---

**Part of ZCraft FHEVM Examples** | Built with Zama FHEVM
