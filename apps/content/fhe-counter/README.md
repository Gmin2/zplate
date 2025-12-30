# FHE Counter

A simple encrypted counter contract demonstrating the basics of Fully Homomorphic Encryption (FHE) on Ethereum using FHEVM.

## What You'll Learn

This example teaches the fundamental patterns for working with encrypted data in FHEVM:

- **Encrypted State**: Store encrypted values (`euint32`) on-chain
- **External Inputs**: Accept encrypted inputs from users with `FHE.fromExternal()`
- **FHE Operations**: Perform arithmetic on encrypted values (`FHE.add()`, `FHE.sub()`)
- **Permission Management**: Control access to encrypted data with `FHE.allow()` and `FHE.allowThis()`
- **View Functions**: Return encrypted handles for client-side decryption

## Contract Overview

The `FHECounter` contract maintains an encrypted counter that can be incremented and decremented without revealing the actual count value on-chain.

### Key Features

```solidity
euint32 private _count;  // Encrypted counter state
```

- `increment(inputEuint32, inputProof)` - Add encrypted value to counter
- `decrement(inputEuint32, inputProof)` - Subtract encrypted value from counter
- `getCount()` - Returns encrypted count handle for decryption

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

// Deploy contract
const FHECounter = await ethers.getContractFactory("FHECounter");
const counter = await FHECounter.deploy();
const address = await counter.getAddress();

// Encrypt input value
const encryptedInput = await fhevm
  .createEncryptedInput(address, userAddress)
  .add32(5)  // Increment by 5
  .encrypt();

// Call contract with encrypted input
await counter.increment(
  encryptedInput.handles[0],
  encryptedInput.inputProof
);

// Get encrypted count and decrypt
const encryptedCount = await counter.getCount();
const decryptedValue = await fhevm.userDecryptEuint(
  FhevmType.euint32,
  encryptedCount,
  address,
  signer
);

console.log(`Current count: ${decryptedValue}`);
```

## Key Patterns Demonstrated

### 1. Accepting Encrypted External Inputs

```solidity
function increment(externalEuint32 inputEuint32, bytes calldata inputProof) external {
    euint32 encryptedEuint32 = FHE.fromExternal(inputEuint32, inputProof);
    // ...
}
```

The `externalEuint32` type and `inputProof` work together to securely bring encrypted data from the client into the contract.

### 2. FHE Arithmetic Operations

```solidity
_count = FHE.add(_count, encryptedEuint32);  // Addition on encrypted values
_count = FHE.sub(_count, encryptedEuint32);  // Subtraction on encrypted values
```

All arithmetic happens on encrypted values without decryption.

### 3. Permission Management

```solidity
FHE.allowThis(_count);        // Allow contract to use this handle
FHE.allow(_count, msg.sender); // Allow caller to decrypt
```

Permissions control who can decrypt encrypted values.

### 4. Configuration Inheritance

The `FHECounter` contract inherits from `ZamaEthereumConfig` to access the FHEVM configuration.

```solidity
contract FHECounter is ZamaEthereumConfig {
    // Contract inherits FHEVM configuration
}
```

## Important Notes

This example intentionally **omits overflow/underflow checks** for clarity and simplicity. In production:

```solidity
// Example: Add overflow check
require(FHE.decrypt(FHE.lt(_count, FHE.asEuint32(type(uint32).max - value))), "Overflow");
```

## Testing

The test suite demonstrates:

- Deploying FHE contracts
- Creating encrypted inputs with `fhevm.createEncryptedInput()`
- Calling contract functions with encrypted parameters
- Decrypting results with `fhevm.userDecryptEuint()`
- Verifying encrypted computation results

Run tests:

```bash
npm run test
```

## Next Steps

After mastering this example, explore:

- **FHE Simple Vault** - Learn access control with encrypted balances
- **FHE Voting** - Confidential voting mechanisms
- **Confidential Bank** - Gateway decryption for revealing results

## Resources

- [FHEVM Documentation](https://docs.zama.ai/fhevm)
- [FHEVM Solidity Library](https://docs.zama.ai/protocol/solidity-guides)
- [Hardhat Plugin Guide](https://docs.zama.ai/protocol/solidity-guides/development-guide/hardhat)

## License

BSD-3-Clause-Clear

---

**Part of ZCraft FHEVM Examples** | Built with Zama FHEVM
