// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {FHE, euint64} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

/**
 * @title ConfidentialAirdrop
 * @notice Private token distribution where airdrop amounts remain confidential
 * @dev Demonstrates encrypted token airdrops with time windows and eligibility tracking
 *
 * @custom:security-contact security@example.com
 * @custom:chapter airdrop
 * @custom:chapter defi
 * @custom:chapter privacy
 *
 * This contract implements a confidential airdrop system where the distribution amount remains
 * encrypted throughout the entire claiming process. Traditional airdrops expose allocation amounts
 * on-chain, allowing anyone to see exactly how much each participant receives. This creates several
 * privacy concerns. Competitors can analyze distribution patterns to understand tokenomics and user
 * segmentation. Large holders become targets for phishing and social engineering. Early claimers
 * signal their allocation sizes to later participants, potentially influencing claiming behavior.
 *
 * With FHE-based confidential airdrops, the amount being distributed is encrypted. Observers can see
 * that an airdrop exists and verify the eligibility criteria, but they cannot determine how many
 * tokens each user receives. Only the recipient can decrypt their allocation amount using their
 * private key. This protects user privacy while maintaining transparency about the eligibility rules.
 *
 * The mechanism works through a simple claim process. The contract stores an encrypted airdrop amount
 * set during deployment. Users who meet eligibility criteria can call the claim function once. The
 * contract tracks who has claimed to prevent double-claiming, transfers the encrypted amount to the
 * user's balance, and grants decryption permissions. The user can then verify their received amount
 * client-side without revealing it to others.
 *
 * Time windows control when claiming is allowed. The airdrop has a start time before which no claims
 * are accepted, and an end time after which the window closes. This creates fairness by ensuring all
 * eligible participants have equal opportunity to claim within a defined period. It also allows
 * unclaimed tokens to be recovered after the window expires.
 *
 * This is a demonstration contract for educational purposes. Production implementations would add
 * Merkle tree proofs for eligibility verification, allowing large-scale airdrops with gas-efficient
 * eligibility checks. You would support multiple allocation tiers where different users receive
 * different amounts based on criteria like holding duration or participation level. Integration with
 * actual ERC7984 confidential tokens provides real value transfer rather than the mock balance system
 * shown here. Vesting schedules could lock airdropped tokens with cliff periods to prevent immediate
 * dumps and encourage long-term holding.
 *
 * Common mistakes include forgetting to set appropriate time windows, making the airdrop either too
 * short for users to claim or indefinitely open. Another pitfall is not tracking claims per user,
 * allowing repeated claiming. Developers sometimes forget that the encrypted amount is fixed at
 * deployment, so all eligible users receive the same amount unless you implement tier logic. The
 * contract must grant FHE permissions to both the contract itself and the recipient, or decryption
 * will fail. Finally, without proper eligibility checks, anyone can claim, defeating the purpose of
 * targeted distribution.
 */
contract ConfidentialAirdrop is ZamaEthereumConfig {
    /**
     * @notice Encrypted airdrop amount per claim
     * @dev Immutable value set at deployment - all claimers receive this amount
     */
    euint64 private immutable airdropAmount;

    /**
     * @notice Time window for claiming
     * @dev Public timestamps visible to all
     */
    uint256 public immutable startTime;
    uint256 public immutable endTime;

    /**
     * @notice Tracks which addresses have already claimed
     * @dev Prevents double-claiming
     */
    mapping(address => bool) public hasClaimed;

    /**
     * @notice Contract owner/admin
     */
    address public immutable owner;

    // Mock balances for demonstration (production would use ERC7984)
    mapping(address => euint64) private _balances;

    /**
     * @notice Emitted when a user successfully claims airdrop
     * @dev Amount is intentionally omitted to preserve privacy
     */
    event Claimed(address indexed user, uint256 timestamp);

    /**
     * @notice Emitted when unclaimed tokens are recovered by owner
     */
    event TokensRecovered(address indexed owner, uint256 timestamp);

    /**
     * @notice Initialize airdrop with encrypted amount and time window
     * @dev Demonstrates encrypted value initialization
     *
     * @custom:chapter airdrop
     * @custom:chapter privacy
     *
     * Creates an airdrop with a fixed encrypted amount that all eligible users can claim.
     * The amount is converted to encrypted type and stored immutably, ensuring consistent
     * distribution while keeping the actual value private.
     */
    constructor(uint64 _amount, uint256 _duration) {
        owner = msg.sender;

        // Convert plaintext amount to encrypted type
        airdropAmount = FHE.asEuint64(_amount);

        // Set time window (start immediately, end after duration)
        startTime = block.timestamp;
        endTime = block.timestamp + _duration;

        // Grant contract permission to use encrypted amount
        FHE.allowThis(airdropAmount);

        // Initialize owner's balance for distribution (demo purposes)
        _balances[owner] = FHE.asEuint64(_amount * 1000); // Fund for 1000 claims
        FHE.allowThis(_balances[owner]);
        FHE.allow(_balances[owner], owner);
    }

    /**
     * @notice Claim airdrop allocation
     * @dev Transfers encrypted amount to caller's balance
     *
     * @custom:chapter airdrop
     * @custom:chapter defi
     *
     * Allows eligible users to claim their airdrop allocation during the active time window.
     * The encrypted amount is transferred and decryption permissions are granted to the
     * recipient, allowing them to verify their balance privately.
     */
    function claim() external {
        // Verify claim window is active
        require(block.timestamp >= startTime, "Airdrop not started");
        require(block.timestamp <= endTime, "Airdrop ended");

        // Prevent double-claiming
        require(!hasClaimed[msg.sender], "Already claimed");

        // Mark as claimed
        hasClaimed[msg.sender] = true;

        // Transfer encrypted amount to claimant
        // In production, this would use ERC7984 confidentialTransfer
        _balances[msg.sender] = FHE.add(_balances[msg.sender], airdropAmount);

        // Grant permissions for recipient to decrypt their balance
        FHE.allowThis(_balances[msg.sender]);
        FHE.allow(_balances[msg.sender], msg.sender);

        emit Claimed(msg.sender, block.timestamp);
    }

    /**
     * @notice Recover unclaimed tokens after airdrop ends
     * @dev Only callable by owner after end time
     *
     * @custom:chapter airdrop
     *
     * Allows the owner to recover any unclaimed tokens after the distribution window closes.
     * This prevents tokens from being locked forever in the contract.
     */
    function recoverUnclaimedTokens() external {
        require(msg.sender == owner, "Only owner");
        require(block.timestamp > endTime, "Airdrop still active");

        // In production, would transfer remaining balance back to owner
        // For this demo, we just emit an event
        emit TokensRecovered(owner, block.timestamp);
    }

    /**
     * @notice Check if airdrop is currently active
     */
    function isActive() public view returns (bool) {
        return block.timestamp >= startTime && block.timestamp <= endTime;
    }

    /**
     * @notice Get time remaining in airdrop window
     */
    function getTimeRemaining() public view returns (uint256) {
        if (block.timestamp >= endTime) {
            return 0;
        }
        if (block.timestamp < startTime) {
            return endTime - startTime;
        }
        return endTime - block.timestamp;
    }

    /**
     * @notice Get caller's encrypted balance
     * @dev Recipient must decrypt client-side using fhevm.userDecryptEuint
     */
    function getBalance() external view returns (euint64) {
        return _balances[msg.sender];
    }

    /**
     * @notice Get encrypted airdrop amount
     * @dev Returns encrypted handle - use decryption to see actual value
     */
    function getAirdropAmount() external view returns (euint64) {
        return airdropAmount;
    }
}
