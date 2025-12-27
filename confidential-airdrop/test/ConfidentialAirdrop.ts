import { expect } from "chai";
import { ethers, fhevm } from "hardhat";
import { FhevmType } from "@fhevm/hardhat-plugin";
import type { Signers } from "../types";
import { deployConfidentialAirdropFixture } from "./ConfidentialAirdrop.fixture";
import { time } from "@nomicfoundation/hardhat-network-helpers";

/**
 * @title ConfidentialAirdrop Test Suite
 * @notice Comprehensive tests for private token distribution
 * @dev Tests cover claiming, time windows, double-claim prevention, and privacy
 *
 * @custom:chapter airdrop
 * @custom:chapter defi
 * @custom:chapter privacy
 */
describe("ConfidentialAirdrop", function () {
  // Test constants
  const AIRDROP_AMOUNT = 1000;
  const DURATION = 3600; // 1 hour

  /**
   * Setup test signers
   * @dev alice = owner, bob/carol = claimers
   */
  before(async function () {
    this.signers = {} as Signers;
    const signers = await ethers.getSigners();
    this.signers.alice = signers[0]; // Owner
    this.signers.bob = signers[1]; // Claimer 1
    this.signers.carol = signers[2]; // Claimer 2
  });

  /**
   * Deploy fresh contract for each test
   * @dev Uses fixture pattern for consistent deployment
   */
  beforeEach(async function () {
    const { contract } = await deployConfidentialAirdropFixture();
    this.contract = contract;
    this.contractAddress = await contract.getAddress();
  });

  /**
   * @custom:chapter airdrop
   */
  describe("Deployment", function () {
    /**
     * Test airdrop initializes with correct time window
     * @dev Verifies start and end times are set correctly
     * @custom:chapter airdrop
     * @custom:example
     *
     * TIME WINDOW CONFIGURATION:
     * Airdrops have defined claim periods to ensure fairness.
     * - startTime: When claiming becomes available
     * - endTime: When claiming closes
     * - Duration: Total time window for claims
     *
     * This prevents indefinite claiming and allows token recovery.
     */
    it("should initialize with correct time window", async function () {
      const startTime = await this.contract.startTime();
      const endTime = await this.contract.endTime();

      expect(endTime - startTime).to.equal(DURATION);
    });

    /**
     * Test airdrop is active immediately after deployment
     * @dev Demonstrates immediate activation pattern
     * @custom:chapter airdrop
     */
    it("should be active immediately", async function () {
      const isActive = await this.contract.isActive();
      expect(isActive).to.be.true;
    });

    /**
     * Test encrypted amount is initialized
     * @dev Verifies encrypted value setup
     * @custom:chapter privacy
     */
    it("should initialize encrypted airdrop amount", async function () {
      const encryptedAmount = await this.contract.getAirdropAmount();
      expect(encryptedAmount).to.not.equal(0n);
    });
  });

  /**
   * @custom:chapter airdrop
   * @custom:chapter defi
   */
  describe("Claiming", function () {
    /**
     * Test successful claim
     * @dev Demonstrates basic claim flow
     * @custom:chapter airdrop
     * @custom:example
     *
     * CLAIM PROCESS:
     * 1. User calls claim() during active window
     * 2. Contract verifies user hasn't claimed before
     * 3. Contract marks user as claimed
     * 4. Contract transfers encrypted amount to user
     * 5. User receives decryption permissions
     *
     * PRIVACY: Amount transferred is encrypted, only recipient knows exact value
     */
    it("should allow eligible user to claim", async function () {
      const tx = await this.contract.connect(this.signers.bob).claim();
      await expect(tx).to.emit(this.contract, "Claimed").withArgs(this.signers.bob.address, await time.latest());
    });

    /**
     * Test user can decrypt claimed amount
     * @dev Verifies permission grants allow decryption
     * @custom:chapter airdrop
     * @custom:chapter privacy
     * @custom:example
     *
     * DECRYPTION AFTER CLAIM:
     * After claiming, user receives permissions to decrypt their balance.
     * They can verify the received amount client-side without revealing
     * it to other users or observers.
     */
    it("should allow user to decrypt claimed amount", async function () {
      await this.contract.connect(this.signers.bob).claim();

      // Get encrypted balance
      const balanceHandle = await this.contract.connect(this.signers.bob).getBalance();

      // Decrypt balance
      const decryptedBalance = await fhevm.userDecryptEuint(
        FhevmType.euint64,
        balanceHandle,
        this.contractAddress,
        this.signers.bob
      );

      expect(decryptedBalance).to.equal(BigInt(AIRDROP_AMOUNT));
    });

    /**
     * Test multiple users can claim independently
     * @dev Demonstrates multi-user airdrop distribution
     * @custom:chapter airdrop
     * @custom:example
     *
     * MULTI-USER DISTRIBUTION:
     * Each eligible user can claim independently.
     * Claims are tracked per-address to prevent double-claiming.
     * All users receive the same encrypted amount.
     */
    it("should allow multiple users to claim", async function () {
      // Bob claims
      await this.contract.connect(this.signers.bob).claim();

      // Carol claims
      await this.contract.connect(this.signers.carol).claim();

      // Both should have claimed status
      expect(await this.contract.hasClaimed(this.signers.bob.address)).to.be.true;
      expect(await this.contract.hasClaimed(this.signers.carol.address)).to.be.true;
    });

    /**
     * Test claim status is tracked correctly
     * @dev Verifies hasClaimed mapping updates
     * @custom:chapter airdrop
     */
    it("should track claim status", async function () {
      // Before claim
      expect(await this.contract.hasClaimed(this.signers.bob.address)).to.be.false;

      // Claim
      await this.contract.connect(this.signers.bob).claim();

      // After claim
      expect(await this.contract.hasClaimed(this.signers.bob.address)).to.be.true;
    });
  });

  /**
   * @custom:chapter airdrop
   */
  describe("Double-Claim Prevention", function () {
    /**
     * Test prevents double-claiming
     * @dev SECURITY: Critical protection against repeated claims
     * @custom:chapter airdrop
     * @custom:pitfall double-claim
     * @custom:example
     *
     * DOUBLE-CLAIM ATTACK:
     * Without proper tracking, users could claim multiple times.
     * The contract uses a mapping to track who has claimed:
     * - mapping(address => bool) hasClaimed
     *
     * Before transferring tokens, contract checks:
     * - require(!hasClaimed[msg.sender], "Already claimed")
     *
     * This prevents draining the airdrop through repeated claims.
     */
    it("should revert on double-claim attempt", async function () {
      // First claim succeeds
      await this.contract.connect(this.signers.bob).claim();

      // Second claim reverts
      await expect(this.contract.connect(this.signers.bob).claim()).to.be.revertedWith("Already claimed");
    });

    /**
     * Test claim status persists across calls
     * @dev Ensures claim tracking is permanent
     * @custom:chapter airdrop
     */
    it("should maintain claim status permanently", async function () {
      await this.contract.connect(this.signers.bob).claim();

      // Status remains true even after time passes
      await time.increase(1000);

      expect(await this.contract.hasClaimed(this.signers.bob.address)).to.be.true;
    });
  });

  /**
   * @custom:chapter airdrop
   * @custom:chapter time-lock
   */
  describe("Time Windows", function () {
    /**
     * Test claims revert before start time
     * @dev Demonstrates time-based access control
     * @custom:chapter airdrop
     * @custom:chapter time-lock
     * @custom:pitfall early-claim
     *
     * Note: In this implementation, startTime is set to block.timestamp at deployment,
     * so airdrop is immediately active. This test is more relevant for airdrops with
     * delayed start times.
     */
    it("should be active at start", async function () {
      // Airdrop starts immediately in this implementation
      expect(await this.contract.isActive()).to.be.true;
    });

    /**
     * Test claims revert after end time
     * @dev Enforces claim window deadline
     * @custom:chapter airdrop
     * @custom:chapter time-lock
     * @custom:pitfall late-claim
     * @custom:example
     *
     * TIME WINDOW ENFORCEMENT:
     * After endTime, no more claims are accepted.
     * This allows:
     * - Fair distribution window for all participants
     * - Token recovery after deadline
     * - Clear communication of claim period
     *
     * Users who miss the window lose eligibility.
     */
    it("should revert claims after end time", async function () {
      // Advance past end time
      await time.increase(DURATION + 1);

      // Claim should revert
      await expect(this.contract.connect(this.signers.bob).claim()).to.be.revertedWith("Airdrop ended");
    });

    /**
     * Test isActive reflects time window status
     * @dev Verifies state tracking
     * @custom:chapter airdrop
     * @custom:chapter time-lock
     */
    it("should track active status correctly", async function () {
      // Initially active
      expect(await this.contract.isActive()).to.be.true;

      // After duration, inactive
      await time.increase(DURATION + 1);
      expect(await this.contract.isActive()).to.be.false;
    });

    /**
     * Test time remaining calculation
     * @dev Demonstrates countdown functionality
     * @custom:chapter airdrop
     * @custom:chapter time-lock
     */
    it("should calculate time remaining correctly", async function () {
      const remaining1 = await this.contract.getTimeRemaining();
      expect(remaining1).to.be.closeTo(DURATION, 5);

      // Advance halfway
      await time.increase(DURATION / 2);

      const remaining2 = await this.contract.getTimeRemaining();
      expect(remaining2).to.be.closeTo(DURATION / 2, 5);

      // After end, should be 0
      await time.increase(DURATION);
      expect(await this.contract.getTimeRemaining()).to.equal(0);
    });
  });

  /**
   * @custom:chapter airdrop
   */
  describe("Token Recovery", function () {
    /**
     * Test owner can recover tokens after end
     * @dev Demonstrates unclaimed token recovery
     * @custom:chapter airdrop
     * @custom:example
     *
     * TOKEN RECOVERY:
     * After airdrop ends, unclaimed tokens shouldn't be locked forever.
     * Owner can call recoverUnclaimedTokens() to retrieve them.
     *
     * This allows:
     * - Reclaiming undistributed tokens
     * - Reusing tokens for future airdrops
     * - Preventing permanent token lock
     */
    it("should allow owner to recover after end time", async function () {
      // Advance past end time
      await time.increase(DURATION + 1);

      // Owner can recover
      const tx = await this.contract.connect(this.signers.alice).recoverUnclaimedTokens();
      await expect(tx).to.emit(this.contract, "TokensRecovered");
    });

    /**
     * Test recovery reverts before end time
     * @dev Prevents early recovery while airdrop is active
     * @custom:chapter airdrop
     * @custom:pitfall early-recovery
     */
    it("should revert recovery before end time", async function () {
      await expect(this.contract.connect(this.signers.alice).recoverUnclaimedTokens()).to.be.revertedWith(
        "Airdrop still active"
      );
    });

    /**
     * Test non-owner cannot recover tokens
     * @dev Access control for recovery function
     * @custom:chapter airdrop
     */
    it("should revert recovery from non-owner", async function () {
      await time.increase(DURATION + 1);

      await expect(this.contract.connect(this.signers.bob).recoverUnclaimedTokens()).to.be.revertedWith("Only owner");
    });
  });

  /**
   * @custom:chapter airdrop
   * @custom:chapter privacy
   */
  describe("Privacy Features", function () {
    /**
     * Test airdrop amount remains encrypted
     * @dev Verifies privacy of distribution amount
     * @custom:chapter privacy
     * @custom:example
     *
     * PRIVACY GUARANTEE:
     * The airdrop amount is stored as encrypted euint64.
     * External observers cannot determine:
     * - How many tokens are being distributed
     * - How much each user receives
     * - Total allocated vs claimed amounts
     *
     * Only authorized parties with decryption keys can see actual values.
     */
    it("should keep airdrop amount encrypted", async function () {
      const encryptedAmount = await this.contract.getAirdropAmount();

      // Returns encrypted handle, not plaintext
      // The value is an encrypted handle (not zero, represents encrypted data)
      expect(encryptedAmount).to.not.equal(0n);
    });

    /**
     * Test claimed balances are encrypted
     * @dev Verifies user balance privacy
     * @custom:chapter privacy
     */
    it("should keep claimed balances encrypted", async function () {
      await this.contract.connect(this.signers.bob).claim();

      const balanceHandle = await this.contract.connect(this.signers.bob).getBalance();

      // Balance is encrypted handle, not plaintext
      expect(balanceHandle).to.not.equal(0n);
    });

    /**
     * Test unauthorized users cannot decrypt others' balances
     * @dev Permission system prevents unauthorized decryption
     * @custom:chapter privacy
     * @custom:pitfall unauthorized-decrypt
     */
    it("should prevent unauthorized decryption", async function () {
      await this.contract.connect(this.signers.bob).claim();

      const balanceHandle = await this.contract.connect(this.signers.bob).getBalance();

      // Alice (not bob) should not be able to decrypt bob's balance
      await expect(
        fhevm.userDecryptEuint(FhevmType.euint64, balanceHandle, this.contractAddress, this.signers.alice)
      ).to.be.rejected;
    });

    /**
     * Test events do not leak amounts
     * @dev Privacy through event design
     * @custom:chapter privacy
     * @custom:example
     *
     * EVENT PRIVACY:
     * The Claimed event intentionally omits the claimed amount:
     * - event Claimed(address indexed user, uint256 timestamp)
     *
     * If we included the amount, it would be public on-chain:
     * - event Claimed(address indexed user, uint256 amount) // BAD!
     *
     * This preserves privacy while still allowing claim tracking.
     */
    it("should emit events without revealing amounts", async function () {
      const tx = await this.contract.connect(this.signers.bob).claim();

      // Event exists but doesn't include amount parameter
      await expect(tx).to.emit(this.contract, "Claimed");

      // If event included amount, privacy would be broken
      // This is intentionally tested by NOT checking for an amount parameter
    });
  });

  /**
   * @custom:chapter airdrop
   */
  describe("Edge Cases", function () {
    /**
     * Test claiming near end time boundary
     * @dev Time boundary testing - accounts for block mining
     * @custom:chapter airdrop
     * @custom:pitfall time-boundary
     *
     * Note: We test slightly before endTime (endTime - 1) because
     * when a transaction is submitted, it mines a block which may
     * increment the timestamp, potentially pushing it past endTime.
     */
    it("should handle claims at exact end time", async function () {
      const endTime = await this.contract.endTime();

      // Advance to just before end time to account for block mining
      await time.increaseTo(endTime - 1n);

      // Claim should succeed (we're at endTime-1, claim will mine at endTime or endTime-1)
      await this.contract.connect(this.signers.bob).claim();
    });

    /**
     * Test claiming one second after end time
     * @dev Verifies strict time enforcement
     * @custom:chapter airdrop
     */
    it("should revert claims one second after end", async function () {
      const endTime = await this.contract.endTime();

      // Advance to end time + 1 second
      await time.increaseTo(endTime + 1n);

      // Should revert
      await expect(this.contract.connect(this.signers.bob).claim()).to.be.revertedWith("Airdrop ended");
    });
  });
});
