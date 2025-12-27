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

### 1. Basics (5 templates)
Learn fundamental FHEVM patterns - encrypted state, operations, permissions

### 2. Encryption/Decryption (4 templates)
Master input encryption, gateway decryption, and permission systems

### 3. DeFi (5 templates)
Build confidential financial applications - vaults, auctions, tokens

### 4. Gaming (3 templates)
Create privacy-preserving games - wordle, dice, rock-paper-scissors

### 5. Governance (2 templates)
Implement confidential voting and governance mechanisms

### 6. Advanced (4 templates)
Advanced patterns - compliance, wrapped tokens, complex workflows

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

**Built by Zama** | Making encryption work on encrypted data
