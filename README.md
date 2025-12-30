# ZPlate - FHEVM Example Templates

A collection of high-quality example templates for building FHEVM (Fully Homomorphic Encryption) smart contracts.

## Overview

ZPlate provides production-ready, well-documented example contracts demonstrating various FHEVM patterns and use cases. Each template is a standalone Hardhat project that can be used with the ZCraft CLI tool.

## Available Templates

### Basics
- **base-template** - Foundation template with complete FHEVM Hardhat setup
- **fhe-counter** - Simple encrypted counter demonstrating core FHE operations

### Coming Soon
- **fhe-simple-vault** - Encrypted balance management with access control
- **fhe-voting** - Confidential voting system
- **fhe-operations** - Comprehensive FHE operations showcase
- And 18 more templates across DeFi, Gaming, Governance, and Advanced categories

## Template Structure

Each template follows this structure:
```
template-name/
├── contracts/           # Solidity contracts
├── test/               # Comprehensive test suite
├── deploy/             # Deployment scripts
├── hardhat.config.ts   # Hardhat configuration
├── package.json        # Dependencies
└── README.md           # Template documentation
```

## Usage with ZCraft

```bash
# Create new project from template
zcraft new fhe-counter my-project

# Or clone directly
git clone https://github.com/zama-ai/zplate
cd zplate/fhe-counter
npm install
npm test
```

## Quality Standards

Every template in ZPlate adheres to:

- ✅ **90%+ Test Coverage** - Comprehensive test suites
- ✅ **Full NatSpec Documentation** - Detailed inline documentation
- ✅ **Production Patterns** - Best practices and security considerations
- ✅ **Error Handling Examples** - Proper error handling demonstrations
- ✅ **Type Safety** - Full TypeScript support with generated types

## Template Categories

### Basics
| Template | Description |
|---|---|
| `base-template` | Foundation template with complete FHEVM Hardhat setup |
| `fhe-counter` | Simplest encrypted counter demonstrating encrypted state and basic arithmetic |
| `fhe-simple-vault` | Single-user encrypted vault for deposits/withdrawals and balance tracking |
| `fhe-voting` | Yes/No encrypted voting with tallying and permission patterns |
| `fhe-operations` | Full reference of FHE operations (arithmetic, comparisons, boolean, bitwise) |
| `fhe-random` | Encrypted random number generation (dice, fair randomness patterns) |

### Encryption / Decryption
| Template | Description |
|---|---|
| `encrypt-single` | Accept and store a single encrypted user input with proof binding |
| `encrypt-multiple` | Accept and store multiple encrypted values (bool, uint, address) in one call |
| `decrypt-user` | User decryption pattern showing correct permission ordering and an anti-pattern example |
| `decrypt-gateway` | Two-phase gateway decryption pattern for public revelation via relayer/gateway |

### DeFi
| Template | Description |
|---|---|
| `confidential-bank` | Multi-user confidential bank: deposits, withdrawals, transfers with private balances |
| `confidential-token` | ERC7984 confidential token implementation and operator patterns |
| `sealed-auction` | NFT blind/sealed auction using encrypted bids and encrypted winner reveal |
| `dutch-auction` | Descending-price auction with confidential purchase amounts and dynamic pricing |
| `confidential-airdrop` | Private airdrop distribution with confidential amounts and claim patterns |

### Gaming
| Template | Description |
|---|---|
| `fhe-wordle` | Encrypted Wordle-style game with Merkle-proofed guesses and encrypted feedback computation |
| `dice-game` | Betting game built on encrypted random dice rolls and encrypted payouts |
| `rock-paper-scissors` | Two-player commit-reveal game using encrypted moves and reveal flow |

### Governance
| Template | Description |
|---|---|
| `confidential-voting` | DAO proposal voting with encrypted vote counts and delegation patterns |
| `quadratic-voting` | Quadratic voting where allocations and costs are handled confidentially |

### Advanced
| Template | Description |
|---|---|
| `eth-wrapper` | Confidential ETH wrapper patterns and helpers for ETH-like assets |
| `token-swap` | Confidential token swap examples and cross-token operations |
| `vesting-wallet` | Encrypted vesting wallet patterns for time-locked confidential allocations |
| `freezable-compliance` | Compliance primitives (freeze/unfreeze, policy enforcement) for confidential tokens |

## Contributing

We welcome contributions! Each template should:
1. Follow the standard structure
2. Include comprehensive tests
3. Have detailed README with usage examples
4. Demonstrate best practices

## Resources

- [FHEVM Documentation](https://docs.zama.ai/fhevm)
- [ZCraft CLI](https://github.com/zama-ai/zcraft)
- [FHEVM Solidity Library](https://docs.zama.ai/protocol/solidity-guides)

## License

BSD-3-Clause-Clear

---

![alt text](image.png)

**Built by Zama** | Making encryption work on encrypted data
