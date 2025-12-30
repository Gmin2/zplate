# Encrypt Multiple Values

Accept and store multiple encrypted values of different types in a single transaction - gas optimization pattern.

## What You'll Learn

- Single proof validates ALL encrypted inputs (gas-efficient!)
- Batching multiple encrypted types in one transaction
- Handle ordering importance
- Type-safe multiple value handling

## Key Pattern

```solidity
function storeMultipleValues(
    externalEbool inputEbool,
    externalEuint32 inputEuint32,
    externalEuint64 inputEuint64,
    externalEaddress inputEaddress,
    bytes calldata inputProof  // Single proof for all!
) external {
    ebool encryptedBool = FHE.fromExternal(inputEbool, inputProof);
    euint32 encryptedUint32 = FHE.fromExternal(inputEuint32, inputProof);
    euint64 encryptedUint64 = FHE.fromExternal(inputEuint64, inputProof);
    eaddress encryptedAddress = FHE.fromExternal(inputEaddress, inputProof);
    // ... store and grant permissions
}
```

## Client-Side Usage

```typescript
const input = await fhevm
  .createEncryptedInput(contractAddress, signerAddress)
  .addBool(true)        // handles[0]
  .add32(100)           // handles[1]
  .add64(1000000)       // handles[2]
  .addAddress("0x...")  // handles[3]
  .encrypt();

await contract.storeMultipleValues(
  input.handles[0],  // ebool
  input.handles[1],  // euint32
  input.handles[2],  // euint64
  input.handles[3],  // eaddress
  input.inputProof   // Single proof!
);
```

## Why This Matters

✅ **Gas Optimization** - One proof for multiple values vs. multiple proofs
✅ **Atomic Operations** - All values stored together or none
✅ **Type Flexibility** - Mix ebool, euint32, euint64, eaddress

## Common Pitfalls

❌ **Wrong handle order** - Client order MUST match function parameters
❌ **Missing types** - Forgetting to import all encrypted types
❌ **Permission grants** - Must call FHE.allow() for EACH value

## Quick Start

```bash
npm install
npm run compile
npm test
```
