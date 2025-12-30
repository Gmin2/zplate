# Confidential Bank

Multi-user bank with encrypted balances, deposits, withdrawals, and encrypted transfers between users - core DeFi primitive.

## What You'll Learn

- Multi-user encrypted balance management
- Encrypted transfers between users  
- Permission management for sender AND recipient
- **CRITICAL**: Cannot validate encrypted balances on-chain!
- Deposit/withdraw/transfer patterns

## Core Patterns

### Deposit

```solidity
function deposit(externalEuint64 inputEuint64, bytes calldata inputProof) external {
    euint64 amount = FHE.fromExternal(inputEuint64, inputProof);
    _balances[msg.sender] = FHE.add(_balances[msg.sender], amount);
    
    FHE.allowThis(_balances[msg.sender]);
    FHE.allow(_balances[msg.sender], msg.sender);
}
```

### Transfer (Critical: Both Users Need Permissions!)

```solidity
function transfer(address to, externalEuint64 amount, bytes calldata proof) external {
    euint64 encryptedAmount = FHE.fromExternal(amount, proof);
    
    // Update both balances
    _balances[msg.sender] = FHE.sub(_balances[msg.sender], encryptedAmount);
    _balances[to] = FHE.add(_balances[to], encryptedAmount);
    
    // MUST grant permissions to BOTH users!
    FHE.allowThis(_balances[msg.sender]);
    FHE.allow(_balances[msg.sender], msg.sender);
    
    FHE.allowThis(_balances[to]);
    FHE.allow(_balances[to], to);
}
```

## Critical Limitation

**You CANNOT validate encrypted balances on-chain:**

```solidity
// ❌ THIS DOESN'T WORK - balance is encrypted!
require(balance >= amount, "Insufficient balance");

// ✅ Solutions:
// 1. Client-side validation before submitting
// 2. Use FHESafeMath.tryDecrease() pattern
// 3. Accept that underflow creates large encrypted number
```

## Client-Side Usage

```typescript
// Deposit
const input = await fhevm
  .createEncryptedInput(contractAddress, signerAddress)
  .add64(1000)
  .encrypt();

await bank.deposit(input.handles[0], input.inputProof);

// Check balance
const encryptedBalance = await bank.getBalance();
const balance = await fhevm.userDecryptEuint(
  FhevmType.euint64,
  encryptedBalance,
  contractAddress,
  signer
);
console.log("My balance:", balance);

// Transfer
const transferInput = await fhevm
  .createEncryptedInput(contractAddress, signerAddress)
  .add64(500)
  .encrypt();

await bank.transfer(
  recipientAddress,
  transferInput.handles[0],
  transferInput.inputProof
);
```

## Key Concepts

✅ **Encrypted State** - Balances never revealed on-chain
✅ **Permission Management** - Both parties in transfer need access
✅ **Multi-User** - Each user maintains separate encrypted balance
⚠️ **No On-Chain Validation** - Cannot check balance >= amount

## Production Considerations

For production DeFi:
1. Use **FHESafeMath** for safe arithmetic
2. Implement **ERC7984 standard** for compatibility
3. Add **access control** for admin functions
4. Consider **withdrawal limits** and **rate limiting**
5. Integrate with **confidential tokens** for real value

## Quick Start

```bash
npm install
npm run compile
npm test
```

## Next Steps

- See `confidential-token` for ERC7984 standard implementation
- See `sealed-auction` for advanced DeFi patterns
- See TEMPLATE_SPECIFICATIONS.md for FHESafeMath patterns
