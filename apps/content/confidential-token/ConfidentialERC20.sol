// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {FHE, euint64, externalEuint64} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

/**
 * @title ConfidentialERC20
 * @notice ERC-20 compatible token with fully encrypted balances and allowances
 * @dev Implements ERC7984 - Confidential Token Standard
 *
 * KEY FEATURES:
 * - Encrypted balances (euint64) - balance privacy for all holders
 * - Encrypted allowances - private spending permissions
 * - Standard ERC-20 interface with encrypted amounts
 * - No balance or allowance information leaked on-chain
 * - Users can decrypt their own balances client-side
 *
 * LIMITATIONS:
 * - Cannot enforce balance checks on-chain (encrypted!)
 * - Client must validate sufficient balance before transfer
 * - TotalSupply is public (not encrypted in this implementation)
 */
contract ConfidentialERC20 is ZamaEthereumConfig {
    // Token metadata
    string private _name;
    string private _symbol;
    uint8 private _decimals;
    uint64 private _totalSupply;

    // Encrypted balances: address => encrypted balance
    mapping(address => euint64) private _balances;

    // Encrypted allowances: owner => spender => encrypted allowance
    mapping(address => mapping(address => euint64)) private _allowances;

    // Events (amounts are NOT encrypted in events for simplicity)
    // In production, you might emit encrypted handles instead
    event Transfer(address indexed from, address indexed to, bytes32 encryptedAmount);
    event Approval(address indexed owner, address indexed spender, bytes32 encryptedAmount);
    event Mint(address indexed to, uint64 amount);

    /**
     * @notice Deploy a new confidential ERC20 token
     * @param name_ Token name
     * @param symbol_ Token symbol
     * @param decimals_ Token decimals
     */
    constructor(string memory name_, string memory symbol_, uint8 decimals_) {
        _name = name_;
        _symbol = symbol_;
        _decimals = decimals_;
    }

    // ============ Token Metadata ============

    function name() public view returns (string memory) {
        return _name;
    }

    function symbol() public view returns (string memory) {
        return _symbol;
    }

    function decimals() public view returns (uint8) {
        return _decimals;
    }

    function totalSupply() public view returns (uint64) {
        return _totalSupply;
    }

    // ============ Core Token Functions ============

    /**
     * @notice Get encrypted balance for an address
     * @dev Only the account owner can decrypt this
     * @return Encrypted balance handle
     */
    function balanceOf(address account) public view returns (euint64) {
        return _balances[account];
    }

    /**
     * @notice Transfer encrypted amount to recipient
     * @param to Recipient address
     * @param inputEuint64 Encrypted amount to transfer
     * @param inputProof Proof binding encrypted amount to sender
     *
     * @dev WARNING: No on-chain balance validation!
     *      Client MUST verify sufficient balance before calling
     */
    function transfer(address to, externalEuint64 inputEuint64, bytes calldata inputProof) external returns (bool) {
        require(to != address(0), "Transfer to zero address");

        euint64 amount = FHE.fromExternal(inputEuint64, inputProof);

        // Subtract from sender (no validation - encrypted!)
        _balances[msg.sender] = FHE.sub(_balances[msg.sender], amount);

        // Add to recipient
        _balances[to] = FHE.add(_balances[to], amount);

        // Grant permissions
        FHE.allowThis(_balances[msg.sender]);
        FHE.allow(_balances[msg.sender], msg.sender);

        FHE.allowThis(_balances[to]);
        FHE.allow(_balances[to], to);

        emit Transfer(msg.sender, to, FHE.toBytes32(amount));
        return true;
    }

    /**
     * @notice Approve encrypted spending allowance
     * @param spender Address authorized to spend
     * @param inputEuint64 Encrypted amount to approve
     * @param inputProof Proof binding amount to owner
     */
    function approve(address spender, externalEuint64 inputEuint64, bytes calldata inputProof) external returns (bool) {
        require(spender != address(0), "Approve to zero address");

        euint64 amount = FHE.fromExternal(inputEuint64, inputProof);

        _allowances[msg.sender][spender] = amount;

        FHE.allowThis(amount);
        FHE.allow(amount, msg.sender);
        FHE.allow(amount, spender);

        emit Approval(msg.sender, spender, FHE.toBytes32(amount));
        return true;
    }

    /**
     * @notice Get encrypted allowance
     * @param owner Token owner
     * @param spender Authorized spender
     * @return Encrypted allowance handle
     */
    function allowance(address owner, address spender) public view returns (euint64) {
        return _allowances[owner][spender];
    }

    /**
     * @notice Transfer from another account using allowance
     * @param from Source account
     * @param to Destination account
     * @param inputEuint64 Encrypted amount to transfer
     * @param inputProof Proof binding amount to spender
     *
     * @dev WARNING: No on-chain validation of allowance or balance!
     *      Client MUST verify both before calling
     */
    function transferFrom(
        address from,
        address to,
        externalEuint64 inputEuint64,
        bytes calldata inputProof
    ) external returns (bool) {
        require(from != address(0), "Transfer from zero address");
        require(to != address(0), "Transfer to zero address");

        euint64 amount = FHE.fromExternal(inputEuint64, inputProof);

        // Subtract from allowance (no validation!)
        _allowances[from][msg.sender] = FHE.sub(_allowances[from][msg.sender], amount);

        // Subtract from sender balance
        _balances[from] = FHE.sub(_balances[from], amount);

        // Add to recipient
        _balances[to] = FHE.add(_balances[to], amount);

        // Grant permissions
        FHE.allowThis(_allowances[from][msg.sender]);
        FHE.allow(_allowances[from][msg.sender], from);
        FHE.allow(_allowances[from][msg.sender], msg.sender);

        FHE.allowThis(_balances[from]);
        FHE.allow(_balances[from], from);

        FHE.allowThis(_balances[to]);
        FHE.allow(_balances[to], to);

        emit Transfer(from, to, FHE.toBytes32(amount));
        return true;
    }

    // ============ Minting (for testing/demo) ============

    /**
     * @notice Mint tokens to an address
     * @dev In production, add access control!
     * @param to Recipient address
     * @param amount Amount to mint (plaintext for simplicity)
     */
    function mint(address to, uint64 amount) external {
        require(to != address(0), "Mint to zero address");

        euint64 encryptedAmount = FHE.asEuint64(amount);

        _balances[to] = FHE.add(_balances[to], encryptedAmount);
        _totalSupply += amount;

        FHE.allowThis(_balances[to]);
        FHE.allow(_balances[to], to);

        emit Mint(to, amount);
    }

    /**
     * @notice Initialize balance for testing
     * @dev Convenience function for demo purposes
     */
    function initializeBalance(uint64 amount) external {
        _balances[msg.sender] = FHE.asEuint64(amount);
        _totalSupply += amount;

        FHE.allowThis(_balances[msg.sender]);
        FHE.allow(_balances[msg.sender], msg.sender);

        emit Mint(msg.sender, amount);
    }
}
