// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {FHE, euint64, ebool, externalEuint64} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

/**
 * @title FreezableCompliance
 * @notice Compliance-enabled confidential token with encrypted freeze amounts
 * @dev Demonstrates regulatory compliance while maintaining balance privacy
 *
 * @custom:security-contact security@example.com
 * @custom:chapter compliance
 * @custom:chapter defi
 * @custom:chapter privacy
 *
 * This contract implements a compliance layer for confidential tokens where regulatory authorities
 * can freeze portions of user balances while keeping both the frozen amounts and total balances
 * encrypted. Traditional compliance mechanisms expose frozen amounts publicly, revealing sensitive
 * financial information about users under investigation or sanction. This creates privacy concerns
 * where merely being frozen signals regulatory action, potentially damaging reputation before any
 * wrongdoing is proven.
 *
 * With FHE-based freezable compliance, the frozen amount remains encrypted. Observers can verify
 * that compliance mechanisms exist and that transfers respect frozen status, but they cannot
 * determine how much is frozen or even definitively whether a specific address is frozen. The user
 * can decrypt their own frozen amount to understand their available balance, while regulators with
 * appropriate permissions can verify compliance without exposing details publicly.
 *
 * The mechanism works through encrypted balance partitioning. Each address has a total balance
 * (encrypted) and a frozen balance (encrypted). The available balance for transfers is calculated
 * as total minus frozen using FHE subtraction. When someone attempts a transfer, the contract
 * checks that the transfer amount doesn't exceed available balance. If it does, the transfer amount
 * gets reduced to zero using encrypted select operations, preventing any transfer of frozen funds.
 *
 * Compliance authorities have permission to set frozen amounts for addresses. They submit encrypted
 * freeze amounts through the standard FHE input pattern with proofs. The contract stores this
 * encrypted value as the frozen balance and emits an event. The event intentionally omits the
 * frozen amount to preserve privacy, including only the affected address and timestamp.
 *
 * This demonstrates how regulatory compliance and financial privacy can coexist. Authorities can
 * enforce freezes when needed, users retain privacy about their holdings, and the system remains
 * transparent about the existence of compliance mechanisms without exposing sensitive details.
 *
 * This is a demonstration contract for educational purposes. Production implementations would
 * integrate with full ERC7984 confidential token standards providing complete token functionality.
 * You would need multi-signature requirements for freeze actions to prevent single-point-of-failure
 * abuse. Time-limited freezes that automatically expire prevent indefinite holds without review.
 * Audit trails track all freeze/unfreeze actions for regulatory oversight. Appeal mechanisms allow
 * users to challenge incorrect freezes through defined processes.
 *
 * Common mistakes include freezing more than the user's total balance, which would make their
 * entire balance unavailable. Another pitfall is not handling the case where available balance
 * goes negative due to frozen amount exceeding total, which requires careful FHE arithmetic.
 * Developers sometimes forget that frozen amounts and balances are both encrypted, so direct
 * comparison is impossible without FHE operations. Missing permission grants for frozen amounts
 * prevents users from seeing their available balance. Finally, emitting frozen amounts in events
 * defeats the privacy purpose by revealing sensitive compliance information.
 */
contract FreezableCompliance is ZamaEthereumConfig {
    /**
     * @notice Encrypted token balances per address
     */
    mapping(address => euint64) private _balances;

    /**
     * @notice Encrypted frozen amounts per address
     * @dev Frozen amount cannot be transferred until unfrozen
     */
    mapping(address => euint64) private _frozenBalances;

    /**
     * @notice Compliance authority address
     * @dev Only this address can freeze/unfreeze balances
     */
    address public immutable complianceAuthority;

    /**
     * @notice Emitted when tokens are frozen for an address
     * @dev Amount is intentionally omitted to preserve privacy
     */
    event TokensFrozen(address indexed account, uint256 timestamp);

    /**
     * @notice Emitted when tokens are unfrozen
     */
    event TokensUnfrozen(address indexed account, uint256 timestamp);

    /**
     * @notice Emitted when tokens are transferred
     */
    event Transfer(address indexed from, address indexed to, uint256 timestamp);

    /**
     * @notice Initialize contract with compliance authority
     * @dev Authority has exclusive freeze/unfreeze permissions
     */
    constructor(address _complianceAuthority) {
        require(_complianceAuthority != address(0), "Invalid authority");
        complianceAuthority = _complianceAuthority;
    }

    /**
     * @notice Set frozen amount for an address
     * @dev Only callable by compliance authority
     *
     * @custom:chapter compliance
     * @custom:chapter privacy
     *
     * Allows regulatory authority to freeze a portion of a user's balance. The frozen amount
     * is stored as an encrypted value, keeping the compliance action private while still
     * enforcing the restriction. User can decrypt to see their available balance.
     */
    function freeze(address account, externalEuint64 encryptedAmount, bytes calldata inputProof) external {
        require(msg.sender == complianceAuthority, "Only authority");
        require(account != address(0), "Invalid account");

        // Convert external encrypted input to internal type and validate proof
        euint64 frozenAmount = FHE.fromExternal(encryptedAmount, inputProof);

        // Store encrypted frozen amount
        _frozenBalances[account] = frozenAmount;

        // Grant permissions
        FHE.allowThis(_frozenBalances[account]);
        FHE.allow(_frozenBalances[account], account);
        FHE.allow(_frozenBalances[account], complianceAuthority);

        emit TokensFrozen(account, block.timestamp);
    }

    /**
     * @notice Unfreeze an address by setting frozen amount to zero
     * @dev Only callable by compliance authority
     *
     * @custom:chapter compliance
     *
     * Removes freeze restrictions by setting frozen amount to encrypted zero. User regains
     * full access to their balance after unfreezing.
     */
    function unfreeze(address account) external {
        require(msg.sender == complianceAuthority, "Only authority");

        // Set frozen to encrypted zero
        _frozenBalances[account] = FHE.asEuint64(0);

        FHE.allowThis(_frozenBalances[account]);
        FHE.allow(_frozenBalances[account], account);

        emit TokensUnfrozen(account, block.timestamp);
    }

    /**
     * @notice Transfer tokens respecting frozen amounts
     * @dev Automatically reduces transfer to available balance if needed
     *
     * @custom:chapter compliance
     * @custom:chapter defi
     *
     * Transfers respect frozen balances by calculating available balance (total - frozen)
     * and capping the transfer amount at available. This happens entirely on encrypted
     * values using FHE select operations.
     */
    function transfer(address to, externalEuint64 encryptedAmount, bytes calldata inputProof) external {
        require(to != address(0), "Invalid recipient");

        // Convert external encrypted input to internal type
        euint64 transferAmount = FHE.fromExternal(encryptedAmount, inputProof);

        // Calculate available balance: total - frozen
        euint64 available = FHE.sub(_balances[msg.sender], _frozenBalances[msg.sender]);

        // Cap transfer at available balance using encrypted comparison
        // If transferAmount <= available: use transferAmount
        // If transferAmount > available: use 0 (transfer fails)
        ebool isValidTransfer = FHE.lte(transferAmount, available);
        euint64 actualAmount = FHE.select(isValidTransfer, transferAmount, FHE.asEuint64(0));

        // Execute transfer
        _balances[msg.sender] = FHE.sub(_balances[msg.sender], actualAmount);
        _balances[to] = FHE.add(_balances[to], actualAmount);

        // Grant permissions
        FHE.allowThis(_balances[msg.sender]);
        FHE.allow(_balances[msg.sender], msg.sender);
        FHE.allowThis(_balances[to]);
        FHE.allow(_balances[to], to);

        emit Transfer(msg.sender, to, block.timestamp);
    }

    /**
     * @notice Get encrypted balance for caller
     * @dev User must decrypt client-side to see plaintext value
     */
    function getBalance() external view returns (euint64) {
        return _balances[msg.sender];
    }

    /**
     * @notice Get encrypted frozen amount for caller
     * @dev User must decrypt to see how much is frozen
     */
    function getFrozenBalance() external view returns (euint64) {
        return _frozenBalances[msg.sender];
    }

    /**
     * @notice Get available (unfrozen) balance for caller
     * @dev Calculated as total - frozen
     */
    function getAvailableBalance() external view returns (euint64) {
        return FHE.sub(_balances[msg.sender], _frozenBalances[msg.sender]);
    }

    /**
     * @notice Initialize balance for testing
     * @dev Demo function - production would use actual token minting
     */
    function initializeBalance(uint64 amount) external {
        euint64 encAmount = FHE.asEuint64(amount);
        _balances[msg.sender] = encAmount;

        // Initialize frozen to zero
        _frozenBalances[msg.sender] = FHE.asEuint64(0);

        FHE.allowThis(_balances[msg.sender]);
        FHE.allow(_balances[msg.sender], msg.sender);
        FHE.allowThis(_frozenBalances[msg.sender]);
        FHE.allow(_frozenBalances[msg.sender], msg.sender);
    }
}
