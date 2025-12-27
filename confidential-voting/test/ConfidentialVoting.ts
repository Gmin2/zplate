import { expect } from "chai";
import { ethers, fhevm } from "hardhat";
import { FhevmType } from "@fhevm/hardhat-plugin";
import type { Signers } from "../types";
import { deployConfidentialVotingFixture } from "./ConfidentialVoting.fixture";
import { time } from "@nomicfoundation/hardhat-network-helpers";

/**
 * @title ConfidentialVoting Test Suite
 * @notice Comprehensive tests for private DAO governance voting
 * @dev Tests cover proposal creation, encrypted voting, tallying, and privacy
 *
 * @custom:chapter voting
 * @custom:chapter governance
 * @custom:chapter privacy
 */
describe("ConfidentialVoting", function () {
  // Test constants
  const VOTING_DURATION = 3600; // 1 hour

  /**
   * Setup test signers
   * @dev alice = proposal creator, bob/carol/dave = voters
   */
  before(async function () {
    this.signers = {} as Signers;
    const signers = await ethers.getSigners();
    this.signers.alice = signers[0]; // Creator
    this.signers.bob = signers[1]; // Voter 1
    this.signers.carol = signers[2]; // Voter 2
    this.signers.dave = signers[3]; // Voter 3
  });

  /**
   * Deploy fresh contract for each test
   * @dev Uses fixture pattern for consistent deployment
   */
  beforeEach(async function () {
    const { contract } = await deployConfidentialVotingFixture();
    this.contract = contract;
    this.contractAddress = await contract.getAddress();
  });

  /**
   * @custom:chapter voting
   * @custom:chapter governance
   */
  describe("Proposal Creation", function () {
    /**
     * Test successful proposal creation
     * @dev Demonstrates proposal initialization with encrypted counters
     * @custom:chapter voting
     * @custom:chapter governance
     * @custom:example
     *
     * PROPOSAL STRUCTURE:
     * Each proposal contains:
     * - Title and description (public)
     * - Time window (start/end timestamps, public)
     * - Encrypted vote counters (yesVotes, noVotes)
     * - Active status (public)
     * - Creator address (public)
     *
     * Vote counters initialize to encrypted zero, keeping tallies
     * private throughout the voting process.
     */
    it("should create proposal with encrypted counters", async function () {
      const tx = await this.contract
        .connect(this.signers.alice)
        .createProposal("Proposal 1", "Description", VOTING_DURATION);

      // Event includes proposalId, title, and creator (timestamps vary due to block mining)
      await expect(tx).to.emit(this.contract, "ProposalCreated");
    });

    /**
     * Test proposal ID increments
     * @dev Verifies sequential proposal numbering
     * @custom:chapter voting
     */
    it("should increment proposal IDs", async function () {
      await this.contract.createProposal("Proposal 1", "Description 1", VOTING_DURATION);
      await this.contract.createProposal("Proposal 2", "Description 2", VOTING_DURATION);

      const nextId = await this.contract.nextProposalId();
      expect(nextId).to.equal(2);
    });

    /**
     * Test proposal details are stored correctly
     * @dev Verifies proposal data retrieval
     * @custom:chapter voting
     */
    it("should store proposal details correctly", async function () {
      const title = "Test Proposal";
      const description = "Test Description";

      await this.contract.createProposal(title, description, VOTING_DURATION);

      const proposal = await this.contract.getProposal(0);
      expect(proposal.title).to.equal(title);
      expect(proposal.description).to.equal(description);
      expect(proposal.creator).to.equal(this.signers.alice.address);
      expect(proposal.isActive).to.be.true;
    });

    /**
     * Test invalid duration reverts
     * @dev Validates proposal parameters
     * @custom:chapter voting
     * @custom:pitfall invalid-duration
     */
    it("should revert with zero duration", async function () {
      await expect(this.contract.createProposal("Proposal", "Description", 0)).to.be.revertedWith("Invalid duration");
    });

    /**
     * Test encrypted vote counters are initialized
     * @dev Verifies encrypted zero initialization
     * @custom:chapter voting
     * @custom:chapter privacy
     */
    it("should initialize encrypted vote counters", async function () {
      await this.contract.createProposal("Proposal", "Description", VOTING_DURATION);

      const yesVotes = await this.contract.getYesVotes(0);
      const noVotes = await this.contract.getNoVotes(0);

      // Encrypted handles are returned (not plaintext 0)
      expect(yesVotes).to.not.equal(0n);
      expect(noVotes).to.not.equal(0n);
    });
  });

  /**
   * @custom:chapter voting
   * @custom:chapter privacy
   */
  describe("Voting", function () {
    beforeEach(async function () {
      // Create a proposal for voting tests
      await this.contract
        .connect(this.signers.alice)
        .createProposal("Test Proposal", "Test Description", VOTING_DURATION);
    });

    /**
     * Test successful yes vote
     * @dev Demonstrates encrypted boolean vote submission
     * @custom:chapter voting
     * @custom:chapter privacy
     * @custom:example
     *
     * ENCRYPTED VOTING PROCESS:
     * 1. Voter creates encrypted boolean input (true = yes, false = no)
     * 2. Contract validates proof and converts to internal encrypted type
     * 3. Boolean converted to encrypted integer (true → 1, false → 0)
     * 4. Arithmetic determines which counter to increment:
     *    - If vote = 1: yesVotes += 1, noVotes += 0
     *    - If vote = 0: yesVotes += 0, noVotes += 1
     * 5. Vote and tally remain encrypted throughout
     *
     * PRIVACY: Individual votes never appear in plaintext on-chain
     */
    it("should accept encrypted yes vote", async function () {
      // Create encrypted true (yes vote)
      const input = await fhevm.createEncryptedInput(this.contractAddress, this.signers.bob.address).addBool(true).encrypt();

      const tx = await this.contract.connect(this.signers.bob).vote(0, input.handles[0], input.inputProof);

      await expect(tx).to.emit(this.contract, "VoteCast").withArgs(0, this.signers.bob.address);
    });

    /**
     * Test successful no vote
     * @dev Demonstrates encrypted false vote
     * @custom:chapter voting
     * @custom:chapter privacy
     */
    it("should accept encrypted no vote", async function () {
      // Create encrypted false (no vote)
      const input = await fhevm.createEncryptedInput(this.contractAddress, this.signers.bob.address).addBool(false).encrypt();

      const tx = await this.contract.connect(this.signers.bob).vote(0, input.handles[0], input.inputProof);

      await expect(tx).to.emit(this.contract, "VoteCast");
    });

    /**
     * Test multiple users can vote
     * @dev Demonstrates multi-voter participation
     * @custom:chapter voting
     * @custom:example
     *
     * MULTI-VOTER SCENARIO:
     * Each voter submits their encrypted vote independently.
     * Contract tracks who has voted to prevent double voting.
     * Vote tallies accumulate encrypted counts without revealing
     * individual positions or running totals.
     */
    it("should allow multiple users to vote", async function () {
      // Bob votes yes
      const input1 = await fhevm.createEncryptedInput(this.contractAddress, this.signers.bob.address).addBool(true).encrypt();
      await this.contract.connect(this.signers.bob).vote(0, input1.handles[0], input1.inputProof);

      // Carol votes no
      const input2 = await fhevm
        .createEncryptedInput(this.contractAddress, this.signers.carol.address)
        .addBool(false)
        .encrypt();
      await this.contract.connect(this.signers.carol).vote(0, input2.handles[0], input2.inputProof);

      // Both should be marked as voted
      expect(await this.contract.hasVotedOn(0, this.signers.bob.address)).to.be.true;
      expect(await this.contract.hasVotedOn(0, this.signers.carol.address)).to.be.true;
    });

    /**
     * Test vote tracking updates correctly
     * @dev Verifies hasVoted mapping
     * @custom:chapter voting
     */
    it("should track voting status", async function () {
      // Before voting
      expect(await this.contract.hasVotedOn(0, this.signers.bob.address)).to.be.false;

      // Vote
      const input = await fhevm.createEncryptedInput(this.contractAddress, this.signers.bob.address).addBool(true).encrypt();
      await this.contract.connect(this.signers.bob).vote(0, input.handles[0], input.inputProof);

      // After voting
      expect(await this.contract.hasVotedOn(0, this.signers.bob.address)).to.be.true;
    });

    /**
     * Test creator can decrypt vote counts
     * @dev Demonstrates result decryption by authorized party
     * @custom:chapter voting
     * @custom:chapter privacy
     * @custom:example
     *
     * RESULT DECRYPTION:
     * The proposal creator receives permissions to decrypt vote tallies.
     * After voting, they can fetch encrypted handles and decrypt locally:
     *
     * const yesHandle = await contract.getYesVotes(proposalId);
     * const yesCount = await fhevm.userDecryptEuint(yesHandle, ...);
     *
     * This reveals final results while keeping individual votes private.
     */
    it("should allow creator to decrypt vote counts", async function () {
      // Bob votes yes
      const input1 = await fhevm.createEncryptedInput(this.contractAddress, this.signers.bob.address).addBool(true).encrypt();
      await this.contract.connect(this.signers.bob).vote(0, input1.handles[0], input1.inputProof);

      // Carol votes yes
      const input2 = await fhevm
        .createEncryptedInput(this.contractAddress, this.signers.carol.address)
        .addBool(true)
        .encrypt();
      await this.contract.connect(this.signers.carol).vote(0, input2.handles[0], input2.inputProof);

      // Creator decrypts yes votes
      const yesVotesHandle = await this.contract.getYesVotes(0);
      const decryptedYesVotes = await fhevm.userDecryptEuint(
        FhevmType.euint32,
        yesVotesHandle,
        this.contractAddress,
        this.signers.alice
      );

      expect(decryptedYesVotes).to.equal(2n);
    });

    /**
     * Test vote arithmetic calculates correctly
     * @dev Verifies yes/no counter increments
     * @custom:chapter voting
     * @custom:example
     *
     * BOOLEAN TO INTEGER ARITHMETIC:
     * The clever trick for counting encrypted votes:
     *
     * voteAsInt = vote (1 if yes, 0 if no)
     * yesIncrement = voteAsInt (1 if yes, 0 if no)
     * noIncrement = 1 - voteAsInt (0 if yes, 1 if no)
     *
     * yesVotes += yesIncrement
     * noVotes += noIncrement
     *
     * This arithmetic works entirely on encrypted values!
     */
    it("should count yes and no votes correctly", async function () {
      // Two yes votes
      const input1 = await fhevm.createEncryptedInput(this.contractAddress, this.signers.bob.address).addBool(true).encrypt();
      await this.contract.connect(this.signers.bob).vote(0, input1.handles[0], input1.inputProof);

      const input2 = await fhevm
        .createEncryptedInput(this.contractAddress, this.signers.carol.address)
        .addBool(true)
        .encrypt();
      await this.contract.connect(this.signers.carol).vote(0, input2.handles[0], input2.inputProof);

      // One no vote
      const input3 = await fhevm.createEncryptedInput(this.contractAddress, this.signers.dave.address).addBool(false).encrypt();
      await this.contract.connect(this.signers.dave).vote(0, input3.handles[0], input3.inputProof);

      // Decrypt and verify
      const yesHandle = await this.contract.getYesVotes(0);
      const noHandle = await this.contract.getNoVotes(0);

      const yesCount = await fhevm.userDecryptEuint(FhevmType.euint32, yesHandle, this.contractAddress, this.signers.alice);
      const noCount = await fhevm.userDecryptEuint(FhevmType.euint32, noHandle, this.contractAddress, this.signers.alice);

      expect(yesCount).to.equal(2n);
      expect(noCount).to.equal(1n);
    });
  });

  /**
   * @custom:chapter voting
   */
  describe("Double Voting Prevention", function () {
    beforeEach(async function () {
      await this.contract.createProposal("Test Proposal", "Description", VOTING_DURATION);
    });

    /**
     * Test prevents double voting
     * @dev SECURITY: Critical protection against vote manipulation
     * @custom:chapter voting
     * @custom:pitfall double-vote
     * @custom:example
     *
     * DOUBLE VOTING ATTACK:
     * Without tracking, users could vote multiple times to manipulate results.
     * The contract uses mapping(proposalId => mapping(voter => bool)) to track votes.
     *
     * Before allowing vote:
     * require(!hasVoted[proposalId][msg.sender], "Already voted")
     *
     * This ensures one vote per address per proposal.
     */
    it("should revert on double vote attempt", async function () {
      // First vote succeeds
      const input1 = await fhevm.createEncryptedInput(this.contractAddress, this.signers.bob.address).addBool(true).encrypt();
      await this.contract.connect(this.signers.bob).vote(0, input1.handles[0], input1.inputProof);

      // Second vote reverts
      const input2 = await fhevm.createEncryptedInput(this.contractAddress, this.signers.bob.address).addBool(false).encrypt();
      await expect(this.contract.connect(this.signers.bob).vote(0, input2.handles[0], input2.inputProof)).to.be.revertedWith(
        "Already voted"
      );
    });

    /**
     * Test voting status persists
     * @dev Ensures vote tracking is permanent
     * @custom:chapter voting
     */
    it("should maintain voting status permanently", async function () {
      const input = await fhevm.createEncryptedInput(this.contractAddress, this.signers.bob.address).addBool(true).encrypt();
      await this.contract.connect(this.signers.bob).vote(0, input.handles[0], input.inputProof);

      // Status remains true even after time passes
      await time.increase(1000);

      expect(await this.contract.hasVotedOn(0, this.signers.bob.address)).to.be.true;
    });

    /**
     * Test can vote on different proposals
     * @dev Voting on one proposal doesn't affect others
     * @custom:chapter voting
     */
    it("should allow voting on different proposals", async function () {
      // Create second proposal
      await this.contract.createProposal("Proposal 2", "Description 2", VOTING_DURATION);

      // Vote on both proposals
      const input1 = await fhevm.createEncryptedInput(this.contractAddress, this.signers.bob.address).addBool(true).encrypt();
      await this.contract.connect(this.signers.bob).vote(0, input1.handles[0], input1.inputProof);

      const input2 = await fhevm.createEncryptedInput(this.contractAddress, this.signers.bob.address).addBool(false).encrypt();
      await this.contract.connect(this.signers.bob).vote(1, input2.handles[0], input2.inputProof);

      // Should be marked as voted on both
      expect(await this.contract.hasVotedOn(0, this.signers.bob.address)).to.be.true;
      expect(await this.contract.hasVotedOn(1, this.signers.bob.address)).to.be.true;
    });
  });

  /**
   * @custom:chapter voting
   * @custom:chapter governance
   */
  describe("Time Windows", function () {
    /**
     * Test voting is active during window
     * @dev Verifies time-based access control
     * @custom:chapter voting
     * @custom:chapter governance
     */
    it("should be active during voting period", async function () {
      await this.contract.createProposal("Test", "Description", VOTING_DURATION);

      expect(await this.contract.isVotingActive(0)).to.be.true;
    });

    /**
     * Test voting reverts after end time
     * @dev Enforces voting deadline
     * @custom:chapter voting
     * @custom:chapter governance
     * @custom:pitfall late-vote
     * @custom:example
     *
     * TIME ENFORCEMENT:
     * Voting has a defined window (startTime to endTime).
     * After endTime, votes are rejected:
     * require(block.timestamp <= endTime, "Voting ended")
     *
     * This prevents late voting and allows fair result finalization.
     */
    it("should revert votes after end time", async function () {
      await this.contract.createProposal("Test", "Description", VOTING_DURATION);

      // Advance past end time
      await time.increase(VOTING_DURATION + 1);

      const input = await fhevm.createEncryptedInput(this.contractAddress, this.signers.bob.address).addBool(true).encrypt();
      await expect(this.contract.connect(this.signers.bob).vote(0, input.handles[0], input.inputProof)).to.be.revertedWith(
        "Voting ended"
      );
    });

    /**
     * Test can end voting after period
     * @dev Demonstrates voting finalization
     * @custom:chapter voting
     * @custom:chapter governance
     */
    it("should allow ending voting after period", async function () {
      await this.contract.createProposal("Test", "Description", VOTING_DURATION);

      // Advance past end time
      await time.increase(VOTING_DURATION + 1);

      const tx = await this.contract.endVoting(0);
      await expect(tx).to.emit(this.contract, "VotingEnded").withArgs(0);
    });

    /**
     * Test cannot end voting before period ends
     * @dev Prevents premature finalization
     * @custom:chapter voting
     * @custom:pitfall early-end
     */
    it("should revert ending voting before period ends", async function () {
      await this.contract.createProposal("Test", "Description", VOTING_DURATION);

      await expect(this.contract.endVoting(0)).to.be.revertedWith("Voting period not ended");
    });

    /**
     * Test cannot vote after voting ended
     * @dev Ensures finalization prevents new votes
     * @custom:chapter voting
     */
    it("should prevent voting after ended", async function () {
      await this.contract.createProposal("Test", "Description", VOTING_DURATION);

      // End voting
      await time.increase(VOTING_DURATION + 1);
      await this.contract.endVoting(0);

      // Try to vote
      const input = await fhevm.createEncryptedInput(this.contractAddress, this.signers.bob.address).addBool(true).encrypt();
      await expect(this.contract.connect(this.signers.bob).vote(0, input.handles[0], input.inputProof)).to.be.revertedWith(
        "Proposal not active"
      );
    });
  });

  /**
   * @custom:chapter voting
   * @custom:chapter privacy
   */
  describe("Privacy Features", function () {
    beforeEach(async function () {
      await this.contract.createProposal("Test", "Description", VOTING_DURATION);
    });

    /**
     * Test vote counts remain encrypted
     * @dev Verifies tally privacy
     * @custom:chapter privacy
     * @custom:example
     *
     * PRIVACY GUARANTEE:
     * Vote tallies are stored as encrypted euint32 values.
     * External observers cannot determine:
     * - Current vote counts
     * - Which side is winning
     * - Voting trends over time
     *
     * Only authorized parties with decryption permissions can reveal results.
     */
    it("should keep vote counts encrypted", async function () {
      const input = await fhevm.createEncryptedInput(this.contractAddress, this.signers.bob.address).addBool(true).encrypt();
      await this.contract.connect(this.signers.bob).vote(0, input.handles[0], input.inputProof);

      const yesVotes = await this.contract.getYesVotes(0);
      const noVotes = await this.contract.getNoVotes(0);

      // Returns encrypted handles, not plaintext counts
      expect(yesVotes).to.not.equal(0n);
      expect(noVotes).to.not.equal(0n);
    });

    /**
     * Test unauthorized cannot decrypt results
     * @dev Permission system prevents unauthorized access
     * @custom:chapter privacy
     * @custom:pitfall unauthorized-decrypt
     */
    it("should prevent unauthorized result decryption", async function () {
      const input = await fhevm.createEncryptedInput(this.contractAddress, this.signers.bob.address).addBool(true).encrypt();
      await this.contract.connect(this.signers.bob).vote(0, input.handles[0], input.inputProof);

      const yesVotesHandle = await this.contract.getYesVotes(0);

      // Bob (not creator) should not be able to decrypt
      await expect(
        fhevm.userDecryptEuint(FhevmType.euint32, yesVotesHandle, this.contractAddress, this.signers.bob)
      ).to.be.rejected;
    });

    /**
     * Test events do not leak vote values
     * @dev Privacy through event design
     * @custom:chapter privacy
     * @custom:example
     *
     * EVENT PRIVACY:
     * The VoteCast event intentionally omits the vote value:
     * - event VoteCast(uint256 indexed proposalId, address indexed voter)
     *
     * If we included the vote, it would be public:
     * - event VoteCast(uint256 proposalId, address voter, bool vote) // BAD!
     *
     * This preserves vote secrecy while allowing participation tracking.
     */
    it("should emit events without revealing vote values", async function () {
      const input = await fhevm.createEncryptedInput(this.contractAddress, this.signers.bob.address).addBool(true).encrypt();
      const tx = await this.contract.connect(this.signers.bob).vote(0, input.handles[0], input.inputProof);

      // Event exists but doesn't include vote value
      await expect(tx).to.emit(this.contract, "VoteCast").withArgs(0, this.signers.bob.address);
    });
  });

  /**
   * @custom:chapter voting
   */
  describe("Edge Cases", function () {
    /**
     * Test voting on non-existent proposal
     * @dev Handles invalid proposal ID
     * @custom:chapter voting
     */
    it("should handle voting on non-existent proposal", async function () {
      const input = await fhevm.createEncryptedInput(this.contractAddress, this.signers.bob.address).addBool(true).encrypt();

      // Proposal 0 doesn't exist, isActive is false
      await expect(this.contract.connect(this.signers.bob).vote(0, input.handles[0], input.inputProof)).to.be.revertedWith(
        "Proposal not active"
      );
    });

    /**
     * Test all-yes voting scenario
     * @dev Verifies counting with unanimous votes
     * @custom:chapter voting
     */
    it("should handle all-yes votes correctly", async function () {
      await this.contract.createProposal("Test", "Description", VOTING_DURATION);

      // Three yes votes
      for (const signer of [this.signers.bob, this.signers.carol, this.signers.dave]) {
        const input = await fhevm.createEncryptedInput(this.contractAddress, signer.address).addBool(true).encrypt();
        await this.contract.connect(signer).vote(0, input.handles[0], input.inputProof);
      }

      // Decrypt and verify
      const yesHandle = await this.contract.getYesVotes(0);
      const noHandle = await this.contract.getNoVotes(0);

      const yesCount = await fhevm.userDecryptEuint(FhevmType.euint32, yesHandle, this.contractAddress, this.signers.alice);
      const noCount = await fhevm.userDecryptEuint(FhevmType.euint32, noHandle, this.contractAddress, this.signers.alice);

      expect(yesCount).to.equal(3n);
      expect(noCount).to.equal(0n);
    });

    /**
     * Test all-no voting scenario
     * @dev Verifies counting with unanimous no votes
     * @custom:chapter voting
     */
    it("should handle all-no votes correctly", async function () {
      await this.contract.createProposal("Test", "Description", VOTING_DURATION);

      // Three no votes
      for (const signer of [this.signers.bob, this.signers.carol, this.signers.dave]) {
        const input = await fhevm.createEncryptedInput(this.contractAddress, signer.address).addBool(false).encrypt();
        await this.contract.connect(signer).vote(0, input.handles[0], input.inputProof);
      }

      // Decrypt and verify
      const yesHandle = await this.contract.getYesVotes(0);
      const noHandle = await this.contract.getNoVotes(0);

      const yesCount = await fhevm.userDecryptEuint(FhevmType.euint32, yesHandle, this.contractAddress, this.signers.alice);
      const noCount = await fhevm.userDecryptEuint(FhevmType.euint32, noHandle, this.contractAddress, this.signers.alice);

      expect(yesCount).to.equal(0n);
      expect(noCount).to.equal(3n);
    });
  });
});
