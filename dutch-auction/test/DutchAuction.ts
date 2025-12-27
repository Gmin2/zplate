import { expect } from "chai";
import { ethers, fhevm } from "hardhat";
import { FhevmType } from "@fhevm/hardhat-plugin";
import type { Signers } from "../types";
import { deployDutchAuctionFixture } from "./DutchAuction.fixture";
import { time } from "@nomicfoundation/hardhat-network-helpers";

/**
 * @title DutchAuction Test Suite
 * @notice Comprehensive tests for time-based descending price auction
 * @dev Tests cover price calculation, purchases, encrypted amounts, and timing
 *
 * @custom:chapter auction
 * @custom:chapter defi
 * @custom:chapter time-lock
 */
describe("DutchAuction", function () {
  // Test constants
  const TOTAL_TOKENS = 1000000;
  const START_PRICE = 100;
  const RESERVE_PRICE = 10;
  const DISCOUNT_RATE = 1; // Price decreases by 1 per second
  const DURATION = 3600; // 1 hour

  /**
   * Setup test signers
   * @dev alice = seller, bob = buyer
   */
  before(async function () {
    this.signers = {} as Signers;
    const signers = await ethers.getSigners();
    this.signers.alice = signers[0]; // Seller
    this.signers.bob = signers[1]; // Buyer
  });

  /**
   * Deploy fresh contract for each test
   * @dev Uses fixture pattern for consistent deployment
   */
  beforeEach(async function () {
    const { contract } = await deployDutchAuctionFixture();
    this.contract = contract;
    this.contractAddress = await contract.getAddress();
  });

  /**
   * @custom:chapter auction
   * @custom:chapter time-lock
   */
  describe("Price Calculation", function () {
    /**
     * Test initial price equals start price
     * @dev Verifies price starts at configured value
     * @custom:chapter auction
     * @custom:example
     *
     * DUTCH AUCTION PRICING:
     * At t=0 (auction start), price = startPrice
     * As time progresses, price decreases linearly
     * Price formula: startPrice - (discountRate * secondsElapsed)
     * Price floors at reservePrice (minimum)
     */
    it("should start at start price", async function () {
      const currentPrice = await this.contract.getCurrentPrice();
      expect(currentPrice).to.equal(START_PRICE);
    });

    /**
     * Test price decreases over time
     * @dev Demonstrates linear price decline mechanism
     * @custom:chapter auction
     * @custom:chapter time-lock
     * @custom:example
     *
     * TIME-BASED PRICING:
     * With discountRate = 1 per second:
     * - t=0s: price = 100
     * - t=10s: price = 90
     * - t=30s: price = 70
     *
     * This creates urgency for buyers - wait too long and price drops,
     * but risk auction selling out.
     */
    it("should decrease price over time", async function () {
      // Advance 10 seconds
      await time.increase(10);

      const currentPrice = await this.contract.getCurrentPrice();
      // Price should be START_PRICE - (DISCOUNT_RATE * 10)
      expect(currentPrice).to.equal(START_PRICE - DISCOUNT_RATE * 10);
    });

    /**
     * Test price floors at reserve price
     * @dev IMPORTANT: Price cannot go below reserve
     * @custom:chapter auction
     * @custom:example
     *
     * RESERVE PRICE PROTECTION:
     * Even if formula calculates price below reserve, contract returns reserve price.
     * This ensures seller doesn't sell below acceptable minimum.
     *
     * Example: Start=100, Reserve=10, Discount=1/sec
     * After 100 seconds: formula gives 0, but contract returns 10
     */
    it("should floor at reserve price", async function () {
      // Advance past the point where price would hit reserve
      // Price hits reserve at: (START_PRICE - RESERVE_PRICE) / DISCOUNT_RATE seconds
      const timeToReserve = (START_PRICE - RESERVE_PRICE) / DISCOUNT_RATE;
      await time.increase(timeToReserve + 100);

      const currentPrice = await this.contract.getCurrentPrice();
      expect(currentPrice).to.equal(RESERVE_PRICE);
    });

    /**
     * Test price remains constant after duration ends
     * @dev Auction duration acts as time cap
     * @custom:chapter auction
     * @custom:chapter time-lock
     * @custom:pitfall time-boundary
     */
    it("should cap elapsed time at duration", async function () {
      // Advance beyond auction duration
      await time.increase(DURATION + 1000);

      const currentPrice = await this.contract.getCurrentPrice();
      // Price at duration end: START_PRICE - (DISCOUNT_RATE * DURATION)
      const expectedPrice = Math.max(START_PRICE - DISCOUNT_RATE * DURATION, RESERVE_PRICE);
      expect(currentPrice).to.equal(expectedPrice);
    });
  });

  /**
   * @custom:chapter auction
   * @custom:chapter defi
   */
  describe("Purchasing Tokens", function () {
    beforeEach(async function () {
      // Give bob payment tokens for purchases
      // Enough for multiple purchases at start price (100 per token)
      await this.contract.connect(this.signers.bob).initializePaymentBalance(200000);
    });

    /**
     * Test successful purchase with encrypted amount
     * @dev Demonstrates core FHE pattern for auction purchases
     * @custom:chapter auction
     * @custom:chapter defi
     * @custom:example
     *
     * ENCRYPTED PURCHASE FLOW:
     * 1. Buyer creates encrypted input for desired quantity
     * 2. Contract validates proof and converts to internal encrypted type
     * 3. Contract calculates payment (public price * encrypted quantity)
     * 4. Contract transfers payment and auction tokens (all encrypted)
     * 5. Buyer can decrypt their purchase details client-side
     *
     * PRIVACY: Only buyer knows exact purchase quantity
     */
    it("should allow purchasing tokens", async function () {
      const purchaseAmount = 1000;

      // Create encrypted input for purchase amount
      const input = await fhevm
        .createEncryptedInput(this.contractAddress, this.signers.bob.address)
        .add64(purchaseAmount)
        .encrypt();

      // Submit purchase
      const tx = await this.contract
        .connect(this.signers.bob)
        .buy(input.handles[0], input.inputProof);

      await expect(tx).to.emit(this.contract, "TokensPurchased");
    });

    /**
     * Test buyer can decrypt purchase information
     * @dev Verifies permission grants allow decryption
     * @custom:chapter auction
     * @custom:chapter privacy
     * @custom:example
     *
     * DECRYPTION PATTERN:
     * After purchase, buyer receives permissions to decrypt:
     * - tokenAmount: how many tokens purchased
     * - paidAmount: how much they paid
     *
     * This allows buyer to verify transaction privately.
     */
    it("should allow buyer to decrypt purchase info", async function () {
      const purchaseAmount = 1000;

      const input = await fhevm
        .createEncryptedInput(this.contractAddress, this.signers.bob.address)
        .add64(purchaseAmount)
        .encrypt();

      await this.contract.connect(this.signers.bob).buy(input.handles[0], input.inputProof);

      // Get encrypted purchase info
      const purchaseInfo = await this.contract.connect(this.signers.bob).getPurchaseInfo();

      // Decrypt token amount
      const decryptedTokenAmount = await fhevm.userDecryptEuint(
        FhevmType.euint64,
        purchaseInfo[0],
        this.contractAddress,
        this.signers.bob
      );

      expect(decryptedTokenAmount).to.equal(BigInt(purchaseAmount));
    });

    /**
     * Test payment calculation with current price
     * @dev Demonstrates price * quantity arithmetic on encrypted values
     * @custom:chapter auction
     * @custom:chapter defi
     * @custom:example
     *
     * PAYMENT CALCULATION:
     * payment = currentPrice (public) * quantity (encrypted)
     *
     * Uses FHE.mul to multiply encrypted quantity by plaintext price.
     * Result is encrypted payment amount.
     *
     * Example: 1000 tokens at price 90 = 90,000 payment
     *
     * Note: We get the price AFTER purchasing to account for block mining time
     */
    it("should calculate correct payment at current price", async function () {
      // Advance 10 seconds
      await time.increase(10);

      const purchaseAmount = 1000;

      const input = await fhevm
        .createEncryptedInput(this.contractAddress, this.signers.bob.address)
        .add64(purchaseAmount)
        .encrypt();

      // Buy transaction mines a block, which advances time slightly
      await this.contract.connect(this.signers.bob).buy(input.handles[0], input.inputProof);

      // Get the price at purchase time (after the buy transaction mined)
      const priceAtPurchase = await this.contract.getCurrentPrice();

      // Decrypt paid amount
      const purchaseInfo = await this.contract.connect(this.signers.bob).getPurchaseInfo();
      const decryptedPaidAmount = await fhevm.userDecryptEuint(
        FhevmType.euint64,
        purchaseInfo[1],
        this.contractAddress,
        this.signers.bob
      );

      const expectedPayment = BigInt(priceAtPurchase) * BigInt(purchaseAmount);
      expect(decryptedPaidAmount).to.equal(expectedPayment);
    });

    /**
     * Test multiple purchases accumulate
     * @dev Verifies purchase tracking over multiple transactions
     * @custom:chapter auction
     * @custom:example
     *
     * ACCUMULATION PATTERN:
     * If buyer purchases multiple times, contract tracks total:
     * - First purchase: 1000 tokens
     * - Second purchase: 500 tokens
     * - Total tracked: 1500 tokens
     */
    it("should accumulate multiple purchases", async function () {
      const firstPurchase = 1000;
      const secondPurchase = 500;

      // First purchase
      const input1 = await fhevm
        .createEncryptedInput(this.contractAddress, this.signers.bob.address)
        .add64(firstPurchase)
        .encrypt();
      const tx1 = await this.contract.connect(this.signers.bob).buy(input1.handles[0], input1.inputProof);
      await tx1.wait();

      // Second purchase
      const input2 = await fhevm
        .createEncryptedInput(this.contractAddress, this.signers.bob.address)
        .add64(secondPurchase)
        .encrypt();
      const tx2 = await this.contract.connect(this.signers.bob).buy(input2.handles[0], input2.inputProof);
      await tx2.wait();

      // Check total
      const purchaseInfo = await this.contract.connect(this.signers.bob).getPurchaseInfo();
      const decryptedTokenAmount = await fhevm.userDecryptEuint(
        FhevmType.euint64,
        purchaseInfo[0],
        this.contractAddress,
        this.signers.bob
      );

      expect(decryptedTokenAmount).to.equal(BigInt(firstPurchase + secondPurchase));
    });

    /**
     * Test purchase caps at remaining supply
     * @dev Demonstrates FHE.min for supply constraints
     * @custom:chapter auction
     * @custom:pitfall supply-cap
     * @custom:example
     *
     * SUPPLY CAPPING:
     * If buyer requests more than available, contract caps at supply:
     * - Remaining: 100 tokens
     * - Requested: 200 tokens
     * - Actual: 100 tokens (uses FHE.min)
     *
     * This happens on encrypted values, so exact supply isn't revealed.
     */
    it("should cap purchase at remaining tokens", async function () {
      // Give bob enough payment for all tokens (1M tokens at price 100 = 100M payment)
      await this.contract.connect(this.signers.bob).initializePaymentBalance(100000000);

      // Request more than available
      const requestAmount = TOTAL_TOKENS + 1000;

      const input = await fhevm
        .createEncryptedInput(this.contractAddress, this.signers.bob.address)
        .add64(requestAmount)
        .encrypt();

      await this.contract.connect(this.signers.bob).buy(input.handles[0], input.inputProof);

      // Should receive all available tokens, not more
      const purchaseInfo = await this.contract.connect(this.signers.bob).getPurchaseInfo();
      const decryptedTokenAmount = await fhevm.userDecryptEuint(
        FhevmType.euint64,
        purchaseInfo[0],
        this.contractAddress,
        this.signers.bob
      );

      expect(decryptedTokenAmount).to.equal(BigInt(TOTAL_TOKENS));
    });
  });

  /**
   * @custom:chapter auction
   * @custom:chapter time-lock
   */
  describe("Auction Timing", function () {
    /**
     * Test auction ends after duration
     * @dev Time-based state transition
     * @custom:chapter auction
     * @custom:chapter time-lock
     */
    it("should end after duration", async function () {
      expect(await this.contract.hasEnded()).to.be.false;

      // Advance past duration
      await time.increase(DURATION + 1);

      expect(await this.contract.hasEnded()).to.be.true;
    });

    /**
     * Test time remaining calculation
     * @dev Demonstrates time tracking
     * @custom:chapter auction
     * @custom:chapter time-lock
     */
    it("should track time remaining", async function () {
      const remaining1 = await this.contract.getTimeRemaining();
      expect(remaining1).to.be.closeTo(DURATION, 5); // Within 5 seconds

      await time.increase(1800); // 30 minutes

      const remaining2 = await this.contract.getTimeRemaining();
      expect(remaining2).to.be.closeTo(DURATION - 1800, 5);
    });

    /**
     * Test purchases revert after auction ends
     * @dev Enforces auction deadline
     * @custom:chapter auction
     * @custom:chapter time-lock
     * @custom:pitfall late-purchase
     */
    it("should revert purchases after auction ends", async function () {
      await time.increase(DURATION + 1);

      const input = await fhevm
        .createEncryptedInput(this.contractAddress, this.signers.bob.address)
        .add64(1000)
        .encrypt();

      await expect(
        this.contract.connect(this.signers.bob).buy(input.handles[0], input.inputProof)
      ).to.be.revertedWith("Auction ended");
    });
  });

  /**
   * @custom:chapter auction
   * @custom:chapter privacy
   */
  describe("Privacy Features", function () {
    beforeEach(async function () {
      await this.contract.connect(this.signers.bob).initializePaymentBalance(100000);
    });

    /**
     * Test token amounts remain encrypted
     * @dev Verifies privacy of purchase quantities
     * @custom:chapter privacy
     * @custom:example
     *
     * PRIVACY GUARANTEE:
     * Purchase amounts are encrypted values (euint64).
     * External observers cannot determine:
     * - How many tokens were purchased
     * - How much was paid
     * - Remaining supply
     *
     * Only authorized parties with decryption keys can see these values.
     */
    it("should keep purchase amounts encrypted", async function () {
      const input = await fhevm
        .createEncryptedInput(this.contractAddress, this.signers.bob.address)
        .add64(1000)
        .encrypt();

      await this.contract.connect(this.signers.bob).buy(input.handles[0], input.inputProof);

      const purchaseInfo = await this.contract.connect(this.signers.bob).getPurchaseInfo();

      // Purchase info returns encrypted handles (bigint type in ethers v6)
      // The values are handles, not plaintext amounts
      expect(purchaseInfo[0]).to.not.equal(0n);
      expect(purchaseInfo[1]).to.not.equal(0n);
    });

    /**
     * Test unauthorized users cannot decrypt purchases
     * @dev Permission system prevents unauthorized decryption
     * @custom:chapter privacy
     * @custom:pitfall unauthorized-decrypt
     */
    it("should prevent unauthorized decryption", async function () {
      const input = await fhevm
        .createEncryptedInput(this.contractAddress, this.signers.bob.address)
        .add64(1000)
        .encrypt();

      await this.contract.connect(this.signers.bob).buy(input.handles[0], input.inputProof);

      const purchaseInfo = await this.contract.connect(this.signers.bob).getPurchaseInfo();

      // Alice (not the buyer) should not be able to decrypt
      await expect(
        fhevm.userDecryptEuint(
          FhevmType.euint64,
          purchaseInfo[0],
          this.contractAddress,
          this.signers.alice
        )
      ).to.be.rejected;
    });
  });

  /**
   * @custom:chapter auction
   */
  describe("Configuration", function () {
    /**
     * Test invalid price range reverts
     * @dev Validates price parameters at deployment
     * @custom:pitfall invalid-config
     */
    it("should revert if start price <= reserve price", async function () {
      const contractFactory = await ethers.getContractFactory("DutchAuction");

      await expect(
        contractFactory.deploy(
          1000000,
          10, // start price
          100, // reserve price (higher!)
          1,
          3600
        )
      ).to.be.revertedWith("Invalid price range");
    });

    /**
     * Test zero discount rate reverts
     * @dev Validates discount rate
     * @custom:pitfall invalid-config
     */
    it("should revert with zero discount rate", async function () {
      const contractFactory = await ethers.getContractFactory("DutchAuction");

      await expect(
        contractFactory.deploy(
          1000000,
          100,
          10,
          0, // zero discount rate
          3600
        )
      ).to.be.revertedWith("Invalid discount rate");
    });
  });
});
