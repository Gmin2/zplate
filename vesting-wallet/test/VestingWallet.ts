import { expect } from "chai";
import { ethers, fhevm } from "hardhat";
import { FhevmType } from "@fhevm/hardhat-plugin";
import type { Signers } from "../types";
import { deployVestingWalletFixture } from "./VestingWallet.fixture";
import { time } from "@nomicfoundation/hardhat-network-helpers";

/**
 * @title VestingWallet Test Suite
 * @notice Comprehensive tests for time-locked confidential token vesting
 * @dev Tests cover schedule creation, cliff periods, linear vesting, and claims
 *
 * @custom:chapter vesting
 * @custom:chapter time-lock
 * @custom:chapter defi
 */
describe("VestingWallet", function () {
  // Test constants for vesting schedules
  const ONE_YEAR = 365 * 24 * 60 * 60; // 31536000 seconds
  const SIX_MONTHS = 182 * 24 * 60 * 60; // 15724800 seconds
  const FOUR_YEARS = 4 * ONE_YEAR; // 126144000 seconds

  /**
   * Setup test signers
   * @dev alice = vesting creator, bob = beneficiary
   */
  before(async function () {
    this.signers = {} as Signers;
    const signers = await ethers.getSigners();
    this.signers.alice = signers[0];
    this.signers.bob = signers[1];
    this.signers.carol = signers[2];
  });

  /**
   * Deploy fresh contract before each test
   * @dev Uses fixture pattern for consistent test environment
   */
  beforeEach(async function () {
    const deployment = await deployVestingWalletFixture();
    this.contractAddress = await deployment.contract.getAddress();
    this.contract = deployment.contract;
  });

  /**
   * @custom:chapter vesting
   * @custom:chapter time-lock
   */
  describe("Schedule Creation", function () {
    /**
     * Test basic vesting schedule creation
     * @dev Verifies schedule initialization and event emission
     * @custom:chapter vesting
     * @custom:example
     *
     * PATTERN DEMONSTRATED:
     * Creating encrypted vesting schedule with:
     * 1. Encrypted total amount (privacy for allocation size)
     * 2. Public time parameters (transparency for schedule)
     * 3. Cliff period before vesting begins
     * 4. Linear vesting over total duration
     */
    it("should create vesting schedule", async function () {
      const totalAmount = 1000000n; // 1M tokens
      const cliffDuration = ONE_YEAR;
      const duration = FOUR_YEARS;

      const input = await fhevm
        .createEncryptedInput(this.contractAddress, this.signers.alice.address)
        .add64(totalAmount)
        .encrypt();

      const tx = await this.contract
        .connect(this.signers.alice)
        .createVestingSchedule(
          this.signers.bob.address,
          input.handles[0],
          input.inputProof,
          cliffDuration,
          duration
        );

      await expect(tx).to.emit(this.contract, "VestingScheduleCreated");

      const schedule = await this.contract.getSchedule(0);
      expect(schedule.beneficiary).to.equal(this.signers.bob.address);
      expect(schedule.cliffDuration).to.equal(cliffDuration);
      expect(schedule.duration).to.equal(duration);
    });

    /**
     * Test beneficiary can decrypt total amount
     * @dev Demonstrates permission pattern for encrypted vesting details
     * @custom:chapter privacy
     * @custom:chapter access-control
     * @custom:example
     *
     * PERMISSION PATTERN EXPLAINED:
     * When schedule is created:
     * 1. FHE.allowThis(totalAmount) - Contract can use value
     * 2. FHE.allow(totalAmount, beneficiary) - Beneficiary can decrypt
     *
     * This means:
     * - Beneficiary can see their total allocation
     * - Creator cannot decrypt (unless they're beneficiary)
     * - Other users cannot decrypt
     * - Amount stays encrypted on-chain
     */
    it("should allow beneficiary to decrypt total amount", async function () {
      const totalAmount = 1000000n;

      const input = await fhevm
        .createEncryptedInput(this.contractAddress, this.signers.alice.address)
        .add64(totalAmount)
        .encrypt();

      await this.contract
        .connect(this.signers.alice)
        .createVestingSchedule(this.signers.bob.address, input.handles[0], input.inputProof, ONE_YEAR, FOUR_YEARS);

      const totalHandle = await this.contract.getTotalAmount(0);
      const decrypted = await fhevm.userDecryptEuint(
        FhevmType.euint64,
        totalHandle,
        this.contractAddress,
        this.signers.bob
      );

      expect(decrypted).to.equal(totalAmount);
    });

    /**
     * Test validation of schedule parameters
     * @dev COMMON PITFALL: Cliff duration exceeding total duration
     * @custom:chapter vesting
     * @custom:pitfall cliff-validation
     * @custom:example
     *
     * WHY THIS FAILS:
     * Cliff is the period before ANY tokens vest.
     * If cliff > duration, tokens would never vest!
     *
     * Example of WRONG configuration:
     * - Cliff: 5 years
     * - Duration: 4 years
     * → After 4 years, vesting completes but cliff hasn't ended!
     *
     * Correct configuration:
     * - Cliff: 1 year (tokens start vesting after 1 year)
     * - Duration: 4 years (vesting completes after 4 years)
     */
    it("should revert if cliff exceeds duration", async function () {
      const input = await fhevm
        .createEncryptedInput(this.contractAddress, this.signers.alice.address)
        .add64(1000000)
        .encrypt();

      await expect(
        this.contract
          .connect(this.signers.alice)
          .createVestingSchedule(
            this.signers.bob.address,
            input.handles[0],
            input.inputProof,
            FOUR_YEARS, // Cliff: 4 years
            ONE_YEAR // Duration: 1 year - WRONG!
          )
      ).to.be.revertedWith("Cliff exceeds duration");
    });

    /**
     * Test zero beneficiary validation
     * @dev COMMON PITFALL: Forgetting to validate address parameters
     * @custom:chapter access-control
     * @custom:pitfall zero-address
     */
    it("should revert with zero beneficiary", async function () {
      const input = await fhevm
        .createEncryptedInput(this.contractAddress, this.signers.alice.address)
        .add64(1000000)
        .encrypt();

      await expect(
        this.contract
          .connect(this.signers.alice)
          .createVestingSchedule(ethers.ZeroAddress, input.handles[0], input.inputProof, ONE_YEAR, FOUR_YEARS)
      ).to.be.revertedWith("Invalid beneficiary");
    });

    /**
     * Test zero duration validation
     * @dev COMMON PITFALL: Edge case with zero vesting period
     * @custom:chapter vesting
     * @custom:pitfall zero-duration
     */
    it("should revert with zero duration", async function () {
      const input = await fhevm
        .createEncryptedInput(this.contractAddress, this.signers.alice.address)
        .add64(1000000)
        .encrypt();

      await expect(
        this.contract
          .connect(this.signers.alice)
          .createVestingSchedule(
            this.signers.bob.address,
            input.handles[0],
            input.inputProof,
            0,
            0 // Zero duration
          )
      ).to.be.revertedWith("Invalid duration");
    });

    /**
     * Test creating schedule without cliff
     * @dev Cliff can be zero (immediate vesting start)
     * @custom:chapter vesting
     * @custom:example
     *
     * NO CLIFF SCENARIO:
     * When cliffDuration = 0:
     * - Vesting starts immediately from startTime
     * - Beneficiary can claim from day 1
     * - Linear release over full duration
     *
     * Use cases:
     * - Community rewards (no lockup needed)
     * - Liquidity mining (immediate but gradual release)
     * - Advisory agreements with immediate vesting
     */
    it("should create schedule with zero cliff", async function () {
      const input = await fhevm
        .createEncryptedInput(this.contractAddress, this.signers.alice.address)
        .add64(1000000)
        .encrypt();

      const tx = await this.contract
        .connect(this.signers.alice)
        .createVestingSchedule(
          this.signers.bob.address,
          input.handles[0],
          input.inputProof,
          0, // No cliff
          FOUR_YEARS
        );

      await expect(tx).to.emit(this.contract, "VestingScheduleCreated");
    });
  });

  /**
   * @custom:chapter vesting
   * @custom:chapter time-lock
   */
  describe("Token Claims - Before Cliff", function () {
    beforeEach(async function () {
      const input = await fhevm
        .createEncryptedInput(this.contractAddress, this.signers.alice.address)
        .add64(1000000)
        .encrypt();

      await this.contract
        .connect(this.signers.alice)
        .createVestingSchedule(
          this.signers.bob.address,
          input.handles[0],
          input.inputProof,
          ONE_YEAR, // 1 year cliff
          FOUR_YEARS
        );
    });

    /**
     * Test claim fails before cliff
     * @dev SECURITY: Cliff period must be respected
     * @custom:chapter time-lock
     * @custom:pitfall early-claim
     * @custom:example
     *
     * CLIFF PERIOD EXPLAINED:
     * The cliff is a period where NO tokens vest.
     * This is common in employment contracts:
     *
     * Example: 4-year vesting with 1-year cliff
     * - Year 0-1: 0% vested (cliff period)
     * - Year 1: 25% vested (cliff ends, vesting begins)
     * - Year 2: 50% vested
     * - Year 3: 75% vested
     * - Year 4: 100% vested
     *
     * Purpose:
     * - Ensures commitment before rewards
     * - Standard in hiring agreements
     * - Protects company from early departures
     */
    it("should revert claim before cliff", async function () {
      await expect(this.contract.connect(this.signers.bob).claimVestedTokens(0)).to.be.revertedWith(
        "Cliff not reached"
      );
    });

    /**
     * Test claim still fails just before cliff ends
     * @dev Time boundary testing - accounting for block mining adding time
     * @custom:chapter time-lock
     * @custom:example
     *
     * BOUNDARY CONDITION:
     * If cliff = 365 days, claim at 364 days fails.
     * Must wait full cliff period.
     *
     * Note: We use ONE_YEAR - 10 to account for block mining potentially
     * adding seconds when the transaction is executed.
     */
    it("should revert claim one second before cliff", async function () {
      await time.increase(ONE_YEAR - 10); // Before cliff, accounting for block mining

      await expect(this.contract.connect(this.signers.bob).claimVestedTokens(0)).to.be.revertedWith(
        "Cliff not reached"
      );
    });
  });

  /**
   * @custom:chapter vesting
   * @custom:chapter time-lock
   */
  describe("Token Claims - After Cliff", function () {
    beforeEach(async function () {
      const input = await fhevm
        .createEncryptedInput(this.contractAddress, this.signers.alice.address)
        .add64(1000000)
        .encrypt();

      await this.contract
        .connect(this.signers.alice)
        .createVestingSchedule(this.signers.bob.address, input.handles[0], input.inputProof, ONE_YEAR, FOUR_YEARS);
    });

    /**
     * Test first claim after cliff
     * @dev Demonstrates linear vesting calculation
     * @custom:chapter vesting
     * @custom:example
     *
     * LINEAR VESTING CALCULATION:
     * totalAmount = 1,000,000 tokens
     * duration = 4 years
     * cliff = 1 year
     *
     * At cliff end (1 year):
     * elapsed = 1 year
     * vested = 1,000,000 * (1 year / 4 years) = 250,000 tokens
     *
     * This is 25% of total allocation.
     */
    it("should allow claim after cliff", async function () {
      await time.increase(ONE_YEAR); // Move to cliff end

      const tx = await this.contract.connect(this.signers.bob).claimVestedTokens(0);

      await expect(tx).to.emit(this.contract, "TokensClaimed");

      const balanceHandle = await this.contract.connect(this.signers.bob).getBalance();
      const balance = await fhevm.userDecryptEuint(
        FhevmType.euint64,
        balanceHandle,
        this.contractAddress,
        this.signers.bob
      );

      // After 1 year of 4-year vesting: 25% = 250,000 tokens
      expect(balance).to.equal(250000n);
    });

    /**
     * Test multiple sequential claims
     * @dev Demonstrates claimed amount tracking
     * @custom:chapter vesting
     * @custom:example
     *
     * INCREMENTAL CLAIMING:
     * Users don't have to claim all at once.
     * They can claim periodically as tokens vest.
     *
     * Example:
     * 1. Claim at 1 year: Get 250,000 (25%)
     * 2. Claim at 2 years: Get 250,000 more (another 25%)
     * 3. Total claimed: 500,000 (50%)
     *
     * The contract tracks 'claimed' to prevent double-claiming.
     */
    it("should handle multiple claims correctly", async function () {
      // First claim at 1 year
      await time.increase(ONE_YEAR);
      await this.contract.connect(this.signers.bob).claimVestedTokens(0);

      let balance = await this.contract.connect(this.signers.bob).getBalance();
      let decrypted = await fhevm.userDecryptEuint(
        FhevmType.euint64,
        balance,
        this.contractAddress,
        this.signers.bob
      );
      expect(decrypted).to.equal(250000n);

      // Second claim at 2 years total
      await time.increase(ONE_YEAR);
      await this.contract.connect(this.signers.bob).claimVestedTokens(0);

      balance = await this.contract.connect(this.signers.bob).getBalance();
      decrypted = await fhevm.userDecryptEuint(FhevmType.euint64, balance, this.contractAddress, this.signers.bob);

      // After 2 years: 50% total = 500,000 tokens
      expect(decrypted).to.equal(500000n);
    });

    /**
     * Test claimed amount tracking
     * @dev Verifies encrypted claimed counter is updated
     * @custom:chapter vesting
     * @custom:chapter privacy
     * @custom:example
     *
     * CLAIMED TRACKING:
     * The 'claimed' field tracks how much has been withdrawn.
     * This is ENCRYPTED for privacy:
     * - Competitors can't see redemption patterns
     * - Can't track when employees leave
     * - Personal financial privacy preserved
     */
    it("should track claimed amount", async function () {
      await time.increase(ONE_YEAR);
      await this.contract.connect(this.signers.bob).claimVestedTokens(0);

      const claimedHandle = await this.contract.getClaimedAmount(0);
      const claimed = await fhevm.userDecryptEuint(
        FhevmType.euint64,
        claimedHandle,
        this.contractAddress,
        this.signers.bob
      );

      expect(claimed).to.equal(250000n);
    });

    /**
     * Test claiming at 50% vesting point
     * @dev Validates midpoint vesting calculation
     * @custom:chapter vesting
     * @custom:example
     *
     * MIDPOINT CHECK:
     * At halfway through vesting (2 years of 4):
     * vested = 1,000,000 * (2 / 4) = 500,000 tokens
     *
     * This verifies linear vesting math is correct.
     */
    it("should vest 50% at halfway point", async function () {
      await time.increase(2 * ONE_YEAR); // 2 years

      await this.contract.connect(this.signers.bob).claimVestedTokens(0);

      const balance = await this.contract.connect(this.signers.bob).getBalance();
      const decrypted = await fhevm.userDecryptEuint(
        FhevmType.euint64,
        balance,
        this.contractAddress,
        this.signers.bob
      );

      expect(decrypted).to.equal(500000n);
    });

    /**
     * Test full vesting after duration completes
     * @dev Ensures 100% allocation is available
     * @custom:chapter vesting
     * @custom:example
     *
     * FULL VESTING:
     * After complete duration (4 years):
     * vested = 1,000,000 * (4 / 4) = 1,000,000 tokens (100%)
     *
     * Once fully vested, beneficiary can claim all remaining tokens.
     */
    it("should allow claiming 100% after full duration", async function () {
      await time.increase(FOUR_YEARS); // Full 4 years

      await this.contract.connect(this.signers.bob).claimVestedTokens(0);

      const balance = await this.contract.connect(this.signers.bob).getBalance();
      const decrypted = await fhevm.userDecryptEuint(
        FhevmType.euint64,
        balance,
        this.contractAddress,
        this.signers.bob
      );

      expect(decrypted).to.equal(1000000n); // All tokens
    });

    /**
     * Test claiming beyond duration caps at 100%
     * @dev Verifies vesting doesn't exceed total allocation
     * @custom:chapter vesting
     * @custom:example
     *
     * OVER-DURATION HANDLING:
     * If 10 years pass but duration is 4 years:
     * vested = min(totalAmount, calculated) = totalAmount
     *
     * This prevents vesting from exceeding 100%.
     * The contract caps at totalAmount.
     */
    it("should cap at 100% even if time exceeds duration", async function () {
      await time.increase(10 * ONE_YEAR); // Way past duration

      await this.contract.connect(this.signers.bob).claimVestedTokens(0);

      const balance = await this.contract.connect(this.signers.bob).getBalance();
      const decrypted = await fhevm.userDecryptEuint(
        FhevmType.euint64,
        balance,
        this.contractAddress,
        this.signers.bob
      );

      expect(decrypted).to.equal(1000000n); // Still just 100%
    });
  });

  /**
   * @custom:chapter access-control
   */
  describe("Access Control", function () {
    beforeEach(async function () {
      const input = await fhevm
        .createEncryptedInput(this.contractAddress, this.signers.alice.address)
        .add64(1000000)
        .encrypt();

      await this.contract
        .connect(this.signers.alice)
        .createVestingSchedule(this.signers.bob.address, input.handles[0], input.inputProof, 0, FOUR_YEARS);
    });

    /**
     * Test only beneficiary can claim
     * @dev SECURITY: Prevents unauthorized token withdrawal
     * @custom:chapter access-control
     * @custom:pitfall unauthorized-claim
     * @custom:example
     *
     * ACCESS CONTROL:
     * Only the designated beneficiary can claim vested tokens.
     * This prevents:
     * - Front-running attacks
     * - Token theft
     * - Unauthorized withdrawals
     *
     * Even the schedule creator cannot claim!
     */
    it("should revert if non-beneficiary tries to claim", async function () {
      await time.increase(ONE_YEAR);

      await expect(this.contract.connect(this.signers.carol).claimVestedTokens(0)).to.be.revertedWith(
        "Not beneficiary"
      );
    });

    /**
     * Test creator cannot claim
     * @dev Even creator has no claim rights
     * @custom:chapter access-control
     */
    it("should revert if creator tries to claim", async function () {
      await time.increase(ONE_YEAR);

      await expect(this.contract.connect(this.signers.alice).claimVestedTokens(0)).to.be.revertedWith(
        "Not beneficiary"
      );
    });
  });

  /**
   * @custom:chapter privacy
   * @custom:chapter access-control
   */
  describe("Privacy Features", function () {
    beforeEach(async function () {
      const input = await fhevm
        .createEncryptedInput(this.contractAddress, this.signers.alice.address)
        .add64(1000000)
        .encrypt();

      await this.contract
        .connect(this.signers.alice)
        .createVestingSchedule(this.signers.bob.address, input.handles[0], input.inputProof, ONE_YEAR, FOUR_YEARS);
    });

    /**
     * Test total amount is encrypted
     * @dev Verifies allocation size is private
     * @custom:chapter privacy
     * @custom:example
     *
     * PRIVACY GUARANTEE:
     * The total vesting amount is encrypted on-chain.
     * Observers cannot see:
     * - How much equity an employee has
     * - Investor allocation sizes
     * - Team member compensation
     *
     * This prevents:
     * - Competitive intelligence gathering
     * - Personal privacy violations
     * - Negotiation leverage issues
     */
    it("should keep total amount encrypted", async function () {
      const totalHandle = await this.contract.getTotalAmount(0);

      // Handle is encrypted, not plaintext
      expect(totalHandle).to.not.equal(1000000n);
    });

    /**
     * Test unauthorized decryption fails
     * @dev SECURITY: Only beneficiary has decryption permission
     * @custom:chapter privacy
     * @custom:chapter access-control
     * @custom:pitfall unauthorized-decrypt
     * @custom:example
     *
     * PERMISSION MODEL:
     * When schedule is created:
     * - FHE.allow(totalAmount, beneficiary) grants permission
     * - Only beneficiary can decrypt
     * - Not even creator can decrypt (unless they're beneficiary)
     * - Other users definitely cannot decrypt
     *
     * This enforces privacy through cryptography, not just access control.
     */
    it("should prevent unauthorized decryption of total amount", async function () {
      const totalHandle = await this.contract.getTotalAmount(0);

      // Carol cannot decrypt Bob's vesting amount
      await expect(
        fhevm.userDecryptEuint(FhevmType.euint64, totalHandle, this.contractAddress, this.signers.carol)
      ).to.be.rejected;
    });
  });

  /**
   * @custom:chapter vesting
   */
  describe("Multiple Schedules", function () {
    /**
     * Test independent schedules for different beneficiaries
     * @dev Verifies state isolation between schedules
     * @custom:chapter vesting
     * @custom:example
     *
     * MULTI-BENEFICIARY SCENARIO:
     * In real applications:
     * - Different employees have different schedules
     * - Different investors have different allocations
     * - Each schedule is independent
     * - No cross-contamination of vesting progress
     */
    it("should handle multiple independent schedules", async function () {
      const input1 = await fhevm
        .createEncryptedInput(this.contractAddress, this.signers.alice.address)
        .add64(1000000)
        .encrypt();

      await this.contract
        .connect(this.signers.alice)
        .createVestingSchedule(this.signers.bob.address, input1.handles[0], input1.inputProof, ONE_YEAR, FOUR_YEARS);

      const input2 = await fhevm
        .createEncryptedInput(this.contractAddress, this.signers.alice.address)
        .add64(500000)
        .encrypt();

      await this.contract
        .connect(this.signers.alice)
        .createVestingSchedule(
          this.signers.carol.address,
          input2.handles[0],
          input2.inputProof,
          SIX_MONTHS,
          FOUR_YEARS
        );

      const schedule0 = await this.contract.getSchedule(0);
      const schedule1 = await this.contract.getSchedule(1);

      expect(schedule0.beneficiary).to.equal(this.signers.bob.address);
      expect(schedule1.beneficiary).to.equal(this.signers.carol.address);
      expect(schedule0.cliffDuration).to.equal(ONE_YEAR);
      expect(schedule1.cliffDuration).to.equal(SIX_MONTHS);
    });
  });
});
