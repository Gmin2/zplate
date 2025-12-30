import { expect } from "chai";
import { ethers, fhevm } from "hardhat";
import { FhevmType } from "@fhevm/hardhat-plugin";
import type { FHEVoting } from "../types";
import { Signer } from "ethers";

describe("FHEVoting", function () {
  let votingContract: FHEVoting;
  let votingAddress: string;
  let signers: {
    owner: Signer;
    alice: Signer;
    bob: Signer;
    carol: Signer;
  };

  async function deployFixture() {
    const accounts = await ethers.getSigners();
    const contractFactory = await ethers.getContractFactory("FHEVoting");
    const contract = await contractFactory.connect(accounts[0]).deploy();
    await contract.waitForDeployment();
    const contractAddress = await contract.getAddress();

    return {
      votingContract: contract,
      votingAddress: contractAddress,
      signers: {
        owner: accounts[0],
        alice: accounts[1],
        bob: accounts[2],
        carol: accounts[3],
      },
    };
  }

  beforeEach(async function () {
    if (!fhevm.isMock) {
      this.skip();
    }

    ({ votingContract, votingAddress, signers } = await deployFixture());
  });

  describe("Deployment", function () {
    it("should set the deployer as owner", async function () {
      const owner = await votingContract.owner();
      expect(owner).to.equal(await signers.owner.getAddress());
    });

    it("should start with no active voting session", async function () {
      const isActive = await votingContract.isVotingActive();
      expect(isActive).to.be.false;
    });
  });

  describe("Creating Voting Session", function () {
    it("should create a voting session with correct deadline", async function () {
      const duration = 3600; // 1 hour
      const tx = await votingContract.connect(signers.owner).createVotingSession(duration);
      await tx.wait();

      const isActive = await votingContract.isVotingActive();
      expect(isActive).to.be.true;

      const deadline = await votingContract.getDeadline();
      const currentBlock = await ethers.provider.getBlock("latest");
      expect(Number(deadline)).to.be.approximately(currentBlock!.timestamp + duration, 5);
    });

    it("should emit VotingSessionCreated event", async function () {
      const duration = 3600;
      await expect(votingContract.connect(signers.owner).createVotingSession(duration))
        .to.emit(votingContract, "VotingSessionCreated");
    });

    it("should revert if non-owner tries to create session", async function () {
      await expect(
        votingContract.connect(signers.alice).createVotingSession(3600)
      ).to.be.revertedWith("Only owner can call this");
    });

    it("should revert if session already active", async function () {
      await votingContract.connect(signers.owner).createVotingSession(3600);
      await expect(
        votingContract.connect(signers.owner).createVotingSession(3600)
      ).to.be.revertedWith("A voting session is already active");
    });

    it("should revert if duration is zero", async function () {
      await expect(
        votingContract.connect(signers.owner).createVotingSession(0)
      ).to.be.revertedWith("Duration must be positive");
    });
  });

  describe("Voting", function () {
    beforeEach(async function () {
      // Create a voting session before each test
      const duration = 3600;
      const tx = await votingContract.connect(signers.owner).createVotingSession(duration);
      await tx.wait();
    });

    it("should allow voting yes (1)", async function () {
      const voteYes = 1;
      const encryptedInput = await fhevm
        .createEncryptedInput(votingAddress, await signers.alice.getAddress())
        .add32(voteYes)
        .encrypt();

      const tx = await votingContract
        .connect(signers.alice)
        .vote(encryptedInput.handles[0], encryptedInput.inputProof);
      await tx.wait();

      const hasVoted = await votingContract.hasVoted(await signers.alice.getAddress());
      expect(hasVoted).to.be.true;
    });

    it("should allow voting no (0)", async function () {
      const voteNo = 0;
      const encryptedInput = await fhevm
        .createEncryptedInput(votingAddress, await signers.bob.getAddress())
        .add32(voteNo)
        .encrypt();

      const tx = await votingContract
        .connect(signers.bob)
        .vote(encryptedInput.handles[0], encryptedInput.inputProof);
      await tx.wait();

      const hasVoted = await votingContract.hasVoted(await signers.bob.getAddress());
      expect(hasVoted).to.be.true;
    });

    it("should emit VoteCast event", async function () {
      const voteYes = 1;
      const encryptedInput = await fhevm
        .createEncryptedInput(votingAddress, await signers.alice.getAddress())
        .add32(voteYes)
        .encrypt();

      await expect(
        votingContract.connect(signers.alice).vote(encryptedInput.handles[0], encryptedInput.inputProof)
      ).to.emit(votingContract, "VoteCast")
        .withArgs(await signers.alice.getAddress());
    });

    it("should prevent double voting", async function () {
      const voteYes = 1;
      const encryptedInput = await fhevm
        .createEncryptedInput(votingAddress, await signers.alice.getAddress())
        .add32(voteYes)
        .encrypt();

      await votingContract
        .connect(signers.alice)
        .vote(encryptedInput.handles[0], encryptedInput.inputProof);

      const encryptedInput2 = await fhevm
        .createEncryptedInput(votingAddress, await signers.alice.getAddress())
        .add32(voteYes)
        .encrypt();

      await expect(
        votingContract.connect(signers.alice).vote(encryptedInput2.handles[0], encryptedInput2.inputProof)
      ).to.be.revertedWith("Already voted");
    });

    it("should track multiple voters independently", async function () {
      const voteYes = 1;
      const voteNo = 0;

      const aliceInput = await fhevm
        .createEncryptedInput(votingAddress, await signers.alice.getAddress())
        .add32(voteYes)
        .encrypt();

      const bobInput = await fhevm
        .createEncryptedInput(votingAddress, await signers.bob.getAddress())
        .add32(voteNo)
        .encrypt();

      await votingContract.connect(signers.alice).vote(aliceInput.handles[0], aliceInput.inputProof);
      await votingContract.connect(signers.bob).vote(bobInput.handles[0], bobInput.inputProof);

      const aliceVoted = await votingContract.hasVoted(await signers.alice.getAddress());
      const bobVoted = await votingContract.hasVoted(await signers.bob.getAddress());
      const carolVoted = await votingContract.hasVoted(await signers.carol.getAddress());

      expect(aliceVoted).to.be.true;
      expect(bobVoted).to.be.true;
      expect(carolVoted).to.be.false;
    });
  });

  describe("Vote Tallying", function () {
    beforeEach(async function () {
      const duration = 3600;
      await votingContract.connect(signers.owner).createVotingSession(duration);
    });

    it("should correctly tally yes votes", async function () {
      // Alice and Bob vote yes
      const voteYes = 1;

      const aliceInput = await fhevm
        .createEncryptedInput(votingAddress, await signers.alice.getAddress())
        .add32(voteYes)
        .encrypt();

      const bobInput = await fhevm
        .createEncryptedInput(votingAddress, await signers.bob.getAddress())
        .add32(voteYes)
        .encrypt();

      await votingContract.connect(signers.alice).vote(aliceInput.handles[0], aliceInput.inputProof);
      await votingContract.connect(signers.bob).vote(bobInput.handles[0], bobInput.inputProof);

      // Fast-forward time past deadline
      await ethers.provider.send("evm_increaseTime", [3601]);
      await ethers.provider.send("evm_mine", []);

      // End voting to grant owner permission
      await votingContract.connect(signers.owner).endVoting();

      // Decrypt results
      const encryptedYesVotes = await votingContract.getYesVotes();
      const yesVotes = await fhevm.userDecryptEuint(
        FhevmType.euint32,
        encryptedYesVotes,
        votingAddress,
        signers.owner
      );

      expect(yesVotes).to.equal(2);
    });

    it("should correctly tally no votes", async function () {
      // Alice votes no, Bob votes no
      const voteNo = 0;

      const aliceInput = await fhevm
        .createEncryptedInput(votingAddress, await signers.alice.getAddress())
        .add32(voteNo)
        .encrypt();

      const bobInput = await fhevm
        .createEncryptedInput(votingAddress, await signers.bob.getAddress())
        .add32(voteNo)
        .encrypt();

      await votingContract.connect(signers.alice).vote(aliceInput.handles[0], aliceInput.inputProof);
      await votingContract.connect(signers.bob).vote(bobInput.handles[0], bobInput.inputProof);

      await ethers.provider.send("evm_increaseTime", [3601]);
      await ethers.provider.send("evm_mine", []);

      await votingContract.connect(signers.owner).endVoting();

      const encryptedNoVotes = await votingContract.getNoVotes();
      const noVotes = await fhevm.userDecryptEuint(
        FhevmType.euint32,
        encryptedNoVotes,
        votingAddress,
        signers.owner
      );

      expect(noVotes).to.equal(2);
    });

    it("should correctly tally mixed votes", async function () {
      const voteYes = 1;
      const voteNo = 0;

      const aliceInput = await fhevm
        .createEncryptedInput(votingAddress, await signers.alice.getAddress())
        .add32(voteYes)
        .encrypt();

      const bobInput = await fhevm
        .createEncryptedInput(votingAddress, await signers.bob.getAddress())
        .add32(voteNo)
        .encrypt();

      const carolInput = await fhevm
        .createEncryptedInput(votingAddress, await signers.carol.getAddress())
        .add32(voteYes)
        .encrypt();

      await votingContract.connect(signers.alice).vote(aliceInput.handles[0], aliceInput.inputProof);
      await votingContract.connect(signers.bob).vote(bobInput.handles[0], bobInput.inputProof);
      await votingContract.connect(signers.carol).vote(carolInput.handles[0], carolInput.inputProof);

      await ethers.provider.send("evm_increaseTime", [3601]);
      await ethers.provider.send("evm_mine", []);

      await votingContract.connect(signers.owner).endVoting();

      const encryptedYesVotes = await votingContract.getYesVotes();
      const encryptedNoVotes = await votingContract.getNoVotes();
      const encryptedTotalVotes = await votingContract.getTotalVotes();

      const yesVotes = await fhevm.userDecryptEuint(FhevmType.euint32, encryptedYesVotes, votingAddress, signers.owner);
      const noVotes = await fhevm.userDecryptEuint(FhevmType.euint32, encryptedNoVotes, votingAddress, signers.owner);
      const totalVotes = await fhevm.userDecryptEuint(FhevmType.euint32, encryptedTotalVotes, votingAddress, signers.owner);

      expect(yesVotes).to.equal(2);
      expect(noVotes).to.equal(1);
      expect(totalVotes).to.equal(3);
    });
  });

  describe("Ending Voting", function () {
    beforeEach(async function () {
      const duration = 3600;
      await votingContract.connect(signers.owner).createVotingSession(duration);
    });

    it("should end voting after deadline", async function () {
      await ethers.provider.send("evm_increaseTime", [3601]);
      await ethers.provider.send("evm_mine", []);

      const tx = await votingContract.connect(signers.owner).endVoting();
      await tx.wait();

      const isActive = await votingContract.isVotingActive();
      expect(isActive).to.be.false;
    });

    it("should emit VotingEnded event", async function () {
      await ethers.provider.send("evm_increaseTime", [3601]);
      await ethers.provider.send("evm_mine", []);

      await expect(votingContract.connect(signers.owner).endVoting())
        .to.emit(votingContract, "VotingEnded");
    });

    it("should revert if called before deadline", async function () {
      await expect(
        votingContract.connect(signers.owner).endVoting()
      ).to.be.revertedWith("Voting period not ended");
    });

    it("should revert if non-owner tries to end voting", async function () {
      await ethers.provider.send("evm_increaseTime", [3601]);
      await ethers.provider.send("evm_mine", []);

      await expect(
        votingContract.connect(signers.alice).endVoting()
      ).to.be.revertedWith("Only owner can call this");
    });

    it("should revert if no active session", async function () {
      await ethers.provider.send("evm_increaseTime", [3601]);
      await ethers.provider.send("evm_mine", []);

      await votingContract.connect(signers.owner).endVoting();

      await expect(
        votingContract.connect(signers.owner).endVoting()
      ).to.be.revertedWith("No active voting session");
    });

    it("should prevent voting after session ends", async function () {
      await ethers.provider.send("evm_increaseTime", [3601]);
      await ethers.provider.send("evm_mine", []);

      await votingContract.connect(signers.owner).endVoting();

      const voteYes = 1;
      const encryptedInput = await fhevm
        .createEncryptedInput(votingAddress, await signers.alice.getAddress())
        .add32(voteYes)
        .encrypt();

      await expect(
        votingContract.connect(signers.alice).vote(encryptedInput.handles[0], encryptedInput.inputProof)
      ).to.be.revertedWith("Voting is not active");
    });
  });

  describe("View Functions", function () {
    beforeEach(async function () {
      const duration = 3600;
      await votingContract.connect(signers.owner).createVotingSession(duration);
    });

    it("should return encrypted vote counts", async function () {
      const yesVotes = await votingContract.getYesVotes();
      const noVotes = await votingContract.getNoVotes();
      const totalVotes = await votingContract.getTotalVotes();

      expect(yesVotes).to.exist;
      expect(noVotes).to.exist;
      expect(totalVotes).to.exist;
    });

    it("should return correct deadline", async function () {
      const deadline = await votingContract.getDeadline();
      expect(Number(deadline)).to.be.greaterThan(0);
    });

    it("should correctly report voting status", async function () {
      let isActive = await votingContract.isVotingActive();
      expect(isActive).to.be.true;

      await ethers.provider.send("evm_increaseTime", [3601]);
      await ethers.provider.send("evm_mine", []);

      isActive = await votingContract.isVotingActive();
      expect(isActive).to.be.false;
    });
  });
});
