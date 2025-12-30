# Confidential ERC20 Token

An ERC-20 compatible token with fully encrypted balances and allowances, implementing the ERC7984 standard. This template demonstrates how to build privacy-preserving DeFi primitives where token holdings and approvals remain confidential while maintaining composability with the broader ecosystem.

## What You'll Learn

This template demonstrates the ERC7984 standard for confidential tokens, encrypted balance storage using euint64 for privacy, encrypted allowances for confidential spending permissions, permission management for multi-party token operations, and the limitations of encrypted state validation. You will understand how to build privacy-preserving financial primitives that integrate with existing DeFi infrastructure.

## Core Patterns

### Encrypted Balance Storage

Token balances are stored as encrypted euint64 values, ensuring complete privacy of holdings. Users can only decrypt their own balances client-side, while the contract can perform arithmetic operations on encrypted values without revealing the actual amounts.

```solidity
mapping(address => euint64) private _balances;

function balanceOf(address account) public view returns (euint64) {
    return _balances[account];
}
```

### Encrypted Transfer Pattern

Transfers accept encrypted amounts from users through the externalEuint64 type and input proofs. The contract performs encrypted arithmetic to update balances without ever decrypting the values. Permission management ensures both sender and recipient can decrypt their updated balances.

```solidity
function transfer(address to, externalEuint64 inputEuint64, bytes calldata inputProof) external returns (bool) {
    euint64 amount = FHE.fromExternal(inputEuint64, inputProof);

    // Encrypted arithmetic - no decryption needed
    _balances[msg.sender] = FHE.sub(_balances[msg.sender], amount);
    _balances[to] = FHE.add(_balances[to], amount);

    // Grant permissions for decryption
    FHE.allowThis(_balances[msg.sender]);
    FHE.allow(_balances[msg.sender], msg.sender);
    FHE.allowThis(_balances[to]);
    FHE.allow(_balances[to], to);

    return true;
}
```

### Encrypted Allowances

The approve pattern extends to encrypted values, allowing users to grant spending permissions without revealing the approved amount. Both the owner and spender can decrypt the allowance to verify the permission level.

```solidity
mapping(address => mapping(address => euint64)) private _allowances;

function approve(address spender, externalEuint64 inputEuint64, bytes calldata inputProof) external returns (bool) {
    euint64 amount = FHE.fromExternal(inputEuint64, inputProof);
    _allowances[msg.sender][spender] = amount;

    // Grant permissions to both owner and spender
    FHE.allowThis(amount);
    FHE.allow(amount, msg.sender);
    FHE.allow(amount, spender);

    return true;
}
```

### TransferFrom with Encrypted State

The transferFrom function demonstrates complex encrypted state management, updating three encrypted values in a single transaction: the allowance, the sender's balance, and the recipient's balance. All operations occur without decryption.

```solidity
function transferFrom(address from, address to, externalEuint64 inputEuint64, bytes calldata inputProof) external returns (bool) {
    euint64 amount = FHE.fromExternal(inputEuint64, inputProof);

    // Update allowance, from balance, and to balance - all encrypted
    _allowances[from][msg.sender] = FHE.sub(_allowances[from][msg.sender], amount);
    _balances[from] = FHE.sub(_balances[from], amount);
    _balances[to] = FHE.add(_balances[to], amount);

    // Manage permissions for all parties
    FHE.allowThis(_allowances[from][msg.sender]);
    FHE.allow(_allowances[from][msg.sender], from);
    FHE.allow(_allowances[from][msg.sender], msg.sender);

    FHE.allowThis(_balances[from]);
    FHE.allow(_balances[from], from);

    FHE.allowThis(_balances[to]);
    FHE.allow(_balances[to], to);

    return true;
}
```

## Critical Limitations

The most important limitation of confidential tokens is the inability to enforce balance and allowance checks on-chain. Since balances are encrypted, the contract cannot verify that a user has sufficient funds before executing a transfer. Client applications must decrypt balances locally and validate sufficient funds before submitting transactions. Negative balance protection must be implemented at the application layer, not the contract layer.

This limitation means that malicious or buggy clients could attempt transfers with insufficient balances, resulting in underflow that won't be caught by the contract. In production, you would integrate with gateway decryption for critical validations or implement application-level safeguards.

## Client-Side Usage

```typescript
// Deploy token
const token = await ethers.getContractFactory("ConfidentialERC20");
const deployed = await token.deploy("Private Token", "PTKN", 18);

// Mint tokens
await deployed.mint(alice.address, 1000n);

// Check encrypted balance
const balanceHandle = await deployed.balanceOf(alice.address);
const balance = await fhevm.userDecryptEuint(
  FhevmType.euint64,
  balanceHandle,
  contractAddress,
  alice
);

// Transfer encrypted amount
const transferInput = await fhevm
  .createEncryptedInput(contractAddress, alice.address)
  .add64(100)
  .encrypt();

await deployed.connect(alice).transfer(
  bob.address,
  transferInput.handles[0],
  transferInput.inputProof
);

// Approve spending
const approvalInput = await fhevm
  .createEncryptedInput(contractAddress, alice.address)
  .add64(500)
  .encrypt();

await deployed.connect(alice).approve(
  bob.address,
  approvalInput.handles[0],
  approvalInput.inputProof
);

// TransferFrom
const transferFromInput = await fhevm
  .createEncryptedInput(contractAddress, bob.address)
  .add64(200)
  .encrypt();

await deployed.connect(bob).transferFrom(
  alice.address,
  carol.address,
  transferFromInput.handles[0],
  transferFromInput.inputProof
);
```

## ERC7984 Standard

This implementation follows the ERC7984 standard for confidential tokens, which extends ERC-20 with encrypted state. The standard maintains the same function signatures as ERC-20 but replaces uint256 amounts with encrypted euint64 values. This allows confidential tokens to compose with existing DeFi protocols through adapter contracts or direct integration.

The ERC7984 standard specifies encrypted balances and allowances, encrypted amount parameters for transfers and approvals, permission-based decryption for balance queries, and compatibility with standard ERC-20 tooling through events and metadata functions.

## Privacy Features

Balance privacy ensures no third party can observe token holdings on-chain. Transfer amounts remain encrypted in events and state, preventing transaction analysis. Allowance privacy keeps spending permissions confidential between owner and spender. Only authorized parties can decrypt their relevant balances and allowances through client-side decryption.

## Production Considerations

For production deployment of confidential tokens, you should implement access control for minting operations using role-based permissions. Integrate gateway decryption for compliance requirements such as regulatory reporting or tax events. Add pausability and emergency controls for handling critical bugs or security incidents. Implement proper error handling and revert messages for better user experience. Consider implementing encrypted snapshots for voting or dividend distribution mechanisms.

You should also add upgradeability patterns if the token standard evolves, implement batch transfer operations for gas efficiency, integrate with confidential DEX protocols for trading, and add encrypted metadata for advanced token features like vesting or cliffs.

## Integration with DeFi

Confidential tokens can integrate with DeFi protocols through several patterns. For DEX integration, use encrypted order books or confidential AMMs that operate on encrypted liquidity and swap amounts. For lending protocols, implement encrypted collateral and debt positions with gateway-based liquidation oracles. For governance, use encrypted voting power with confidential delegation. For yield farming, track encrypted staked amounts and distribute encrypted rewards.

## Security Considerations

While FHE provides computational privacy, there are several security considerations. MEV protection is enhanced but not perfect as transaction ordering can still leak information. Replay attacks must be prevented through proper nonce management and proof validation. The absence of on-chain balance checks means client validation is critical for preventing underflows. Permission management must be carefully implemented to prevent unauthorized decryption attempts.

## Quick Start

```bash
npm install
npm run compile
npm test
```

## Next Steps

See the token-swap template for confidential DEX patterns. The vesting-wallet template demonstrates time-locked encrypted token distributions. The eth-wrapper template shows how to wrap native ETH as a confidential token. Refer to sealed-auction for confidential NFT trading patterns using ERC7984 tokens as payment.
