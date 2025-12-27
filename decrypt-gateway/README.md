# Gateway Decryption - Public Revelation

Two-phase gateway decryption pattern for revealing encrypted values publicly - essential for auctions, voting results, and game outcomes.

## What You'll Learn

- Two-phase decryption flow (request → callback)
- Using `FHE.makePubliclyDecryptable()` 
- Gateway callback pattern
- Event-driven architecture for decryption
- Production security considerations

## Two-Phase Pattern

### Phase 1: Request Decryption

```solidity
function requestDecryption() external {
    // Mark value for public decryption
    FHE.makePubliclyDecryptable(_encryptedValue);
    
    emit DecryptionRequested(FHE.toBytes32(_encryptedValue));
}
```

### Phase 2: Gateway Callback

```solidity
function finalizeDecryption(uint32 decryptedValue) external {
    // Store the plaintext result
    cleartextValue = decryptedValue;
    isDecrypted = true;
    
    emit ValueDecrypted(decryptedValue);
}
```

## Use Cases

- **Auctions**: Reveal winning bid after bidding ends
- **Voting**: Publish results after voting period
- **Gaming**: Determine outcomes (dice rolls, card draws)
- **Lotteries**: Reveal random winner publicly

## Complete Flow

```typescript
// 1. Initialize encrypted value
await contract.initializeValue(secretValue);

// 2. Request public decryption
await contract.requestDecryption();

// 3. Listen for DecryptionRequested event
// 4. Gateway processes and calls finalizeDecryption()

// 5. Read public result
const result = await contract.cleartextValue();
console.log("Public result:", result);
```

## Production Security

⚠️ **This simplified example lacks production security!**

Real implementations MUST:
- Verify `msg.sender` is authorized gateway
- Check cryptographic proofs (`FHE.checkSignatures`)
- Prevent replay attacks
- Handle callback failures

```solidity
// Production pattern
function finalizeDecryption(
    bytes32[] calldata handles,
    uint256 decryptedValue,
    bytes calldata proof
) external onlyGateway {
    FHE.checkSignatures(handles, abi.encode(decryptedValue), proof);
    // ... process result
}
```

## Quick Start

```bash
npm install
npm run compile
npm test
```

## Important Notes

- Decryption is **async** (two separate transactions)
- Gateway must be running and monitoring events
- This is **one-way** (encrypted → public, cannot go back)
- Use for revealing information, not for computation

