import { expect } from "chai";
import { ethers, fhevm } from "hardhat";
import { FhevmType } from "@fhevm/hardhat-plugin";
import type { Signers } from "../types";
import { deploySealedAuctionFixture } from "./SealedAuction.fixture";
import { time } from "@nomicfoundation/hardhat-network-helpers";

/**
 * @title SealedAuction Test Suite
 * @notice Comprehensive tests for encrypted NFT auction contract
 * @dev Tests cover auction creation, bidding, finalization, and privacy features
 *
 * @custom:chapter auction
 * @custom:chapter privacy
 * @custom:chapter access-control
 */
describe("SealedAuction", function () {
  /**
   * Setup test signers
   * @dev alice = seller, bob = bidder 1, carol = bidder 2
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
    const deployment = await deploySealedAuctionFixture();
    this.contractAddress = await deployment.contract.getAddress();
    this.contract = deployment.contract;
  });

  /**
   * @custom:chapter auction
   */
  describe("Auction Creation", function () {
    /**
     * Test basic auction creation
     * @dev Verifies event emission and correct state initialization
     * @custom:chapter auction
     */
    it("should create a new auction", async function () {
      const nftId = 1;
      const reservePrice = 100n;
      const duration = 3600; // 1 hour

      const tx = await this.contract.connect(this.signers.alice).createAuction(nftId, reservePrice, duration);

      await expect(tx).to.emit(this.contract, "AuctionCreated");

      const auction = await this.contract.getAuction(0);
      expect(auction.seller).to.equal(this.signers.alice.address);
      expect(auction.nftId).to.equal(nftId);
      expect(auction.reservePrice).to.equal(reservePrice);
      expect(auction.isActive).to.be.true;
      expect(auction.isFinalized).to.be.false;
    });

    /**
     * Test validation of auction parameters
     * @dev COMMON PITFALL: Creating auction with zero duration
     * @custom:chapter auction
     * @custom:pitfall duration-validation
     */
    it("should revert with invalid duration", async function () {
      await expect(this.contract.createAuction(1, 100, 0)).to.be.revertedWith("Invalid duration");
    });

    /**
     * Test auction ID increment
     * @dev Ensures unique IDs for concurrent auctions
     * @custom:chapter auction
     */
    it("should increment auction ID", async function () {
      await this.contract.createAuction(1, 100, 3600);
      await this.contract.createAuction(2, 200, 3600);

      const auction0 = await this.contract.getAuction(0);
      const auction1 = await this.contract.getAuction(1);

      expect(auction0.nftId).to.equal(1);
      expect(auction1.nftId).to.equal(2);
    });
  });

  /**
   * @custom:chapter auction
   * @custom:chapter privacy
   * @custom:chapter access-control
   */
  describe("Bidding", function () {
    /**
     * Setup: Create auction before each bidding test
     */
    beforeEach(async function () {
      await this.contract.connect(this.signers.alice).createAuction(1, 100, 3600);
    });

    /**
     * Test encrypted bid submission
     * @dev Demonstrates core FHE pattern: createEncryptedInput + inputProof
     * @custom:chapter auction
     * @custom:chapter privacy
     * @custom:example
     *
     * PATTERN EXPLAINED:
     * 1. Create encrypted input with fhevm.createEncryptedInput()
     * 2. Add value with .add64()
     * 3. Generate proof with .encrypt()
     * 4. Submit handles[0] and inputProof to contract
     */
    it("should allow placing encrypted bid", async function () {
      const bidAmount = 500n;

      const input = await fhevm
        .createEncryptedInput(this.contractAddress, this.signers.bob.address)
        .add64(bidAmount)
        .encrypt();

      const tx = await this.contract.connect(this.signers.bob).placeBid(0, input.handles[0], input.inputProof);

      await expect(tx).to.emit(this.contract, "BidPlaced").withArgs(0, this.signers.bob.address);
    });

    /**
     * Test bidder can decrypt their own bid
     * @dev Demonstrates user decryption pattern with userDecryptEuint
     * @custom:chapter privacy
     * @custom:chapter access-control
     * @custom:example
     *
     * PERMISSION PATTERN:
     * - Contract granted permission via FHE.allowThis()
     * - Bidder granted permission via FHE.allow(encrypted, msg.sender)
     * - Only bidder can decrypt (not seller, not other bidders)
     */
    it("should allow bidder to decrypt their own bid", async function () {
      const bidAmount = 500n;

      const input = await fhevm
        .createEncryptedInput(this.contractAddress, this.signers.bob.address)
        .add64(bidAmount)
        .encrypt();

      await this.contract.connect(this.signers.bob).placeBid(0, input.handles[0], input.inputProof);

      const bidHandle = await this.contract.connect(this.signers.bob).getBid(0);
      const decryptedBid = await fhevm.userDecryptEuint(
        FhevmType.euint64,
        bidHandle,
        this.contractAddress,
        this.signers.bob
      );

      expect(decryptedBid).to.equal(bidAmount);
    });

    /**
     * Test bidder can update their bid
     * @dev Later bid overwrites earlier bid (no duplicate bids per user)
     * @custom:chapter auction
     */
    it("should allow multiple bids from same bidder", async function () {
      const input1 = await fhevm
        .createEncryptedInput(this.contractAddress, this.signers.bob.address)
        .add64(500)
        .encrypt();

      await this.contract.connect(this.signers.bob).placeBid(0, input1.handles[0], input1.inputProof);

      const input2 = await fhevm
        .createEncryptedInput(this.contractAddress, this.signers.bob.address)
        .add64(700)
        .encrypt();

      await this.contract.connect(this.signers.bob).placeBid(0, input2.handles[0], input2.inputProof);

      const bidHandle = await this.contract.connect(this.signers.bob).getBid(0);
      const decryptedBid = await fhevm.userDecryptEuint(
        FhevmType.euint64,
        bidHandle,
        this.contractAddress,
        this.signers.bob
      );

      expect(decryptedBid).to.equal(700n);
    });

    /**
     * Test multiple independent bidders
     * @dev Each bidder's bid is independent and private
     * @custom:chapter auction
     * @custom:chapter privacy
     */
    it("should allow multiple bidders", async function () {
      const bobInput = await fhevm
        .createEncryptedInput(this.contractAddress, this.signers.bob.address)
        .add64(500)
        .encrypt();

      await this.contract.connect(this.signers.bob).placeBid(0, bobInput.handles[0], bobInput.inputProof);

      const carolInput = await fhevm
        .createEncryptedInput(this.contractAddress, this.signers.carol.address)
        .add64(600)
        .encrypt();

      await this.contract.connect(this.signers.carol).placeBid(0, carolInput.handles[0], carolInput.inputProof);

      const bobBidHandle = await this.contract.connect(this.signers.bob).getBid(0);
      const bobBid = await fhevm.userDecryptEuint(
        FhevmType.euint64,
        bobBidHandle,
        this.contractAddress,
        this.signers.bob
      );

      const carolBidHandle = await this.contract.connect(this.signers.carol).getBid(0);
      const carolBid = await fhevm.userDecryptEuint(
        FhevmType.euint64,
        carolBidHandle,
        this.contractAddress,
        this.signers.carol
      );

      expect(bobBid).to.equal(500n);
      expect(carolBid).to.equal(600n);
    });

    /**
     * Test seller cannot bid on own auction
     * @dev SECURITY: Prevents shill bidding
     * @custom:chapter access-control
     * @custom:pitfall shill-bidding
     */
    it("should revert if seller tries to bid", async function () {
      const input = await fhevm
        .createEncryptedInput(this.contractAddress, this.signers.alice.address)
        .add64(500)
        .encrypt();

      await expect(
        this.contract.connect(this.signers.alice).placeBid(0, input.handles[0], input.inputProof)
      ).to.be.revertedWith("Seller cannot bid");
    });

    /**
     * Test cannot bid on cancelled auction
     * @dev EDGE CASE: Auction state validation
     * @custom:chapter auction
     * @custom:pitfall cancelled-auction
     */
    it("should revert if auction not active", async function () {
      await this.contract.connect(this.signers.alice).cancelAuction(0);

      const input = await fhevm
        .createEncryptedInput(this.contractAddress, this.signers.bob.address)
        .add64(500)
        .encrypt();

      await expect(
        this.contract.connect(this.signers.bob).placeBid(0, input.handles[0], input.inputProof)
      ).to.be.revertedWith("Auction not active");
    });

    /**
     * Test cannot bid after auction ends
     * @dev Uses hardhat-network-helpers to fast-forward time
     * @custom:chapter auction
     * @custom:pitfall late-bid
     * @custom:example
     *
     * TIME MANIPULATION IN TESTS:
     * - Use time.increase() to fast-forward blockchain time
     * - Useful for testing time-based logic without waiting
     */
    it("should revert if auction ended", async function () {
      await time.increase(3601); // Fast forward past auction end

      const input = await fhevm
        .createEncryptedInput(this.contractAddress, this.signers.bob.address)
        .add64(500)
        .encrypt();

      await expect(
        this.contract.connect(this.signers.bob).placeBid(0, input.handles[0], input.inputProof)
      ).to.be.revertedWith("Auction ended");
    });
  });

  /**
   * @custom:chapter auction
   * @custom:chapter gateway
   */
  describe("Auction Finalization", function () {
    /**
     * Setup: Create auction with multiple bids
     */
    beforeEach(async function () {
      await this.contract.connect(this.signers.alice).createAuction(1, 100, 3600);

      const bobInput = await fhevm
        .createEncryptedInput(this.contractAddress, this.signers.bob.address)
        .add64(500)
        .encrypt();

      await this.contract.connect(this.signers.bob).placeBid(0, bobInput.handles[0], bobInput.inputProof);

      const carolInput = await fhevm
        .createEncryptedInput(this.contractAddress, this.signers.carol.address)
        .add64(600)
        .encrypt();

      await this.contract.connect(this.signers.carol).placeBid(0, carolInput.handles[0], carolInput.inputProof);
    });

    /**
     * Test auction finalization after end time
     * @dev NOTE: This is simplified demo - production needs gateway
     * @custom:chapter auction
     * @custom:chapter gateway
     * @custom:limitation
     *
     * PRODUCTION REQUIREMENT:
     * Real implementation needs gateway integration to:
     * 1. Decrypt all bids off-chain
     * 2. Determine highest bidder
     * 3. Call back with winner
     *
     * Why: Cannot compare encrypted values on-chain!
     */
    it("should finalize auction after end time", async function () {
      await time.increase(3601);

      const tx = await this.contract.finalizeAuction(0);

      await expect(tx).to.emit(this.contract, "AuctionFinalized");

      const auction = await this.contract.getAuction(0);
      expect(auction.isFinalized).to.be.true;
      expect(auction.isActive).to.be.false;
    });

    /**
     * Test cannot finalize before end time
     * @dev SECURITY: Prevents premature revelation of bids
     * @custom:chapter auction
     * @custom:pitfall early-finalization
     */
    it("should revert finalization before end time", async function () {
      await expect(this.contract.finalizeAuction(0)).to.be.revertedWith("Auction still ongoing");
    });

    /**
     * Test cannot finalize twice
     * @dev EDGE CASE: Idempotency check
     * @custom:chapter auction
     */
    it("should revert double finalization", async function () {
      await time.increase(3601);
      await this.contract.finalizeAuction(0);

      await expect(this.contract.finalizeAuction(0)).to.be.revertedWith("Already finalized");
    });
  });

  /**
   * @custom:chapter access-control
   * @custom:chapter auction
   */
  describe("Auction Cancellation", function () {
    beforeEach(async function () {
      await this.contract.connect(this.signers.alice).createAuction(1, 100, 3600);
    });

    /**
     * Test seller can cancel auction
     * @dev LIMITATION: Should check for existing bids in production
     * @custom:chapter access-control
     */
    it("should allow seller to cancel auction", async function () {
      const tx = await this.contract.connect(this.signers.alice).cancelAuction(0);

      await expect(tx).to.emit(this.contract, "AuctionCancelled").withArgs(0);

      const auction = await this.contract.getAuction(0);
      expect(auction.isActive).to.be.false;
    });

    /**
     * Test only seller can cancel
     * @dev SECURITY: Access control enforcement
     * @custom:chapter access-control
     * @custom:pitfall unauthorized-cancel
     */
    it("should revert if non-seller tries to cancel", async function () {
      await expect(this.contract.connect(this.signers.bob).cancelAuction(0)).to.be.revertedWith(
        "Only seller can cancel"
      );
    });

    /**
     * Test cannot cancel twice
     * @dev EDGE CASE: State validation
     * @custom:chapter auction
     */
    it("should revert if auction already cancelled", async function () {
      await this.contract.connect(this.signers.alice).cancelAuction(0);

      await expect(this.contract.connect(this.signers.alice).cancelAuction(0)).to.be.revertedWith(
        "Auction not active"
      );
    });
  });

  /**
   * @custom:chapter privacy
   * @custom:chapter access-control
   */
  describe("Privacy Features", function () {
    beforeEach(async function () {
      await this.contract.connect(this.signers.alice).createAuction(1, 100, 3600);

      const bobInput = await fhevm
        .createEncryptedInput(this.contractAddress, this.signers.bob.address)
        .add64(500)
        .encrypt();

      await this.contract.connect(this.signers.bob).placeBid(0, bobInput.handles[0], bobInput.inputProof);
    });

    /**
     * Test bids are encrypted on-chain
     * @dev Verifies handle is not plaintext
     * @custom:chapter privacy
     * @custom:example
     *
     * PRIVACY GUARANTEE:
     * - Bid handle is encrypted ciphertext
     * - Cannot be read by examining blockchain state
     * - Requires decryption key to reveal value
     */
    it("should keep bids encrypted on-chain", async function () {
      const bidHandle = await this.contract.connect(this.signers.bob).getBid(0);

      // The bid handle is encrypted, not plaintext
      expect(bidHandle).to.not.equal(500n);
    });

    /**
     * Test unauthorized decryption fails
     * @dev SECURITY: Only bidder can decrypt their bid
     * @custom:chapter privacy
     * @custom:chapter access-control
     * @custom:pitfall unauthorized-decrypt
     *
     * PERMISSION MODEL:
     * - FHE.allow() grants decryption permission
     * - Only bidder was granted permission
     * - Other users (including seller) cannot decrypt
     */
    it("should prevent unauthorized bid decryption", async function () {
      const bobBidHandle = await this.contract.connect(this.signers.bob).getBid(0);

      // Carol cannot decrypt Bob's bid - she doesn't have permission
      await expect(
        fhevm.userDecryptEuint(FhevmType.euint64, bobBidHandle, this.contractAddress, this.signers.carol)
      ).to.be.rejected;
    });
  });

  /**
   * @custom:chapter auction
   */
  describe("Multiple Auctions", function () {
    /**
     * Test concurrent independent auctions
     * @dev Verifies state isolation between auctions
     * @custom:chapter auction
     */
    it("should handle multiple concurrent auctions", async function () {
      await this.contract.connect(this.signers.alice).createAuction(1, 100, 3600);
      await this.contract.connect(this.signers.bob).createAuction(2, 200, 7200);

      const auction0 = await this.contract.getAuction(0);
      const auction1 = await this.contract.getAuction(1);

      expect(auction0.seller).to.equal(this.signers.alice.address);
      expect(auction1.seller).to.equal(this.signers.bob.address);
      expect(auction0.nftId).to.equal(1);
      expect(auction1.nftId).to.equal(2);
    });
  });
});
