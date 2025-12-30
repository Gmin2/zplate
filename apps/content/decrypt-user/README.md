# User Decryption - Permission Patterns

Demonstrates user decryption with CORRECT and WRONG permission patterns - critical for all FHEVM development.

## What You'll Learn

- **THE CRITICAL RULE**: `FHE.allowThis()` MUST come before `FHE.allow()`
- Why missing `FHE.allowThis()` breaks user decryption
- Common permission errors and how to debug them
- How to grant permissions to third parties

## Correct Pattern ✅

```solidity
function initializeValueCorrect(uint32 value) external {
    _value = FHE.asEuint32(value);
    
    // STEP 1: Contract gets permission FIRST
    FHE.allowThis(_value);
    
    // STEP 2: User gets permission SECOND
    FHE.allow(_value, msg.sender);
}
```

## Wrong Pattern ❌ (Educational)

```solidity
function initializeValueWrong(uint32 value) external {
    _value = FHE.asEuint32(value);
    
    // ❌ MISSING: FHE.allowThis()
    // User decryption will FAIL!
    FHE.allow(_value, msg.sender);
}
```

## Client-Side Decryption

```typescript
// This works with CORRECT pattern
const handle = await contract.getValueCorrect();
const decrypted = await fhevm.userDecryptEuint(
  FhevmType.euint32,
  handle,
  contractAddress,
  signer
);
console.log(decrypted); // ✅ Success!

// This FAILS with WRONG pattern
const wrongHandle = await contract.getValueWrong();
await fhevm.userDecryptEuint(...); // ❌ Error: "permission denied"
```

## Common Error Messages

When permissions are wrong, you'll see:
- `"reencryption error"`
- `"permission denied"`
- `"ACL check failed"`

**Solution**: Always call `FHE.allowThis()` before `FHE.allow()`

## Why This Template Matters

This is the **#1 mistake** in FHEVM development. This template shows both patterns so you can:
1. Learn the correct way
2. Understand what breaks
3. Debug permission issues in your own code

## Quick Start

```bash
npm install
npm run compile
npm test  # See both patterns tested!
```
