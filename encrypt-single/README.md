# Encrypt Single Value

Demonstrates accepting a single encrypted user input with proof validation - the essential pattern for all FHEVM applications.

## What You'll Learn

- Using `FHE.fromExternal()` to validate encrypted inputs
- Input proof binding to contract AND user address
- Client-side encryption with fhevmjs
- Permission management patterns (correct vs wrong)

## Key Pattern

```solidity
function storeEncryptedValue(externalEuint32 inputEuint32, bytes calldata inputProof) external {
    euint32 encryptedValue = FHE.fromExternal(inputEuint32, inputProof);
    _values[msg.sender] = encryptedValue;

    // Critical: Grant permissions for decryption
    FHE.allowThis(encryptedValue);
    FHE.allow(encryptedValue, msg.sender);
}
```

## Client-Side Usage

```typescript
const encryptedInput = await fhevm
  .createEncryptedInput(contractAddress, signerAddress)
  .add32(42)
  .encrypt();

await contract.storeEncryptedValue(
  encryptedInput.handles[0],
  encryptedInput.inputProof
);
```

## Common Pitfalls

❌ **Missing permissions** - User can't decrypt without `FHE.allow()`
❌ **Wrong proof binding** - Proof must match contract AND user address
❌ **Wrong parameter order** - Handle first, then proof

## Quick Start

```bash
npm install
npm run compile
npm test
```
