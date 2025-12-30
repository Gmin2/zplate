import { expect } from "chai";
import { ethers, fhevm } from "hardhat";
import { FhevmType } from "@fhevm/hardhat-plugin";
import type { Signers } from "../types";
import { deployRockPaperScissorsFixture } from "./RockPaperScissors.fixture";

describe("RockPaperScissors", function () {
  before(async function () {
    this.signers = {} as Signers;
    const signers = await ethers.getSigners();
    this.signers.alice = signers[0];
    this.signers.bob = signers[1];
  });

  beforeEach(async function () {
    const deployment = await deployRockPaperScissorsFixture();
    this.contractAddress = await deployment.contract.getAddress();
    this.contract = deployment.contract;

    // Initialize balances for both players
    await this.contract.connect(this.signers.alice).initializeBalance(1000);
    await this.contract.connect(this.signers.bob).initializeBalance(1000);
  });

  describe("Game Creation", function () {
    it("should allow creating a new game", async function () {
      const betAmount = 100;

      const tx = await this.contract.connect(this.signers.alice).createGame(betAmount);

      await expect(tx).to.emit(this.contract, "GameCreated").withArgs(0, this.signers.alice.address, betAmount);

      const balance = await this.contract.connect(this.signers.alice).getBalance();
      expect(balance).to.equal(900); // 1000 - 100
    });

    it("should revert if insufficient balance", async function () {
      await expect(this.contract.connect(this.signers.alice).createGame(2000)).to.be.revertedWith(
        "Insufficient balance"
      );
    });

    it("should increment game ID", async function () {
      await this.contract.connect(this.signers.alice).createGame(100);
      await this.contract.connect(this.signers.alice).createGame(100);

      const game0 = await this.contract.getGame(0);
      const game1 = await this.contract.getGame(1);

      expect(game0.player1).to.equal(this.signers.alice.address);
      expect(game1.player1).to.equal(this.signers.alice.address);
    });
  });

  describe("Joining Games", function () {
    beforeEach(async function () {
      await this.contract.connect(this.signers.alice).createGame(100);
    });

    it("should allow player 2 to join", async function () {
      const tx = await this.contract.connect(this.signers.bob).joinGame(0);

      await expect(tx).to.emit(this.contract, "PlayerJoined").withArgs(0, this.signers.bob.address);

      const game = await this.contract.getGame(0);
      expect(game.player2).to.equal(this.signers.bob.address);

      const balance = await this.contract.connect(this.signers.bob).getBalance();
      expect(balance).to.equal(900);
    });

    it("should revert if player 1 tries to join own game", async function () {
      await expect(this.contract.connect(this.signers.alice).joinGame(0)).to.be.revertedWith(
        "Cannot play against yourself"
      );
    });

    it("should revert if game already full", async function () {
      await this.contract.connect(this.signers.bob).joinGame(0);

      const signers = await ethers.getSigners();
      await this.contract.connect(signers[2]).initializeBalance(1000);

      await expect(this.contract.connect(signers[2]).joinGame(0)).to.be.revertedWith("Game already full");
    });

    it("should revert if insufficient balance", async function () {
      const signers = await ethers.getSigners();
      await this.contract.connect(signers[2]).initializeBalance(50);

      await expect(this.contract.connect(signers[2]).joinGame(0)).to.be.revertedWith("Insufficient balance");
    });
  });

  describe("Committing Moves", function () {
    beforeEach(async function () {
      await this.contract.connect(this.signers.alice).createGame(100);
      await this.contract.connect(this.signers.bob).joinGame(0);
    });

    it("should allow player 1 to commit move", async function () {
      const move = 1; // Rock

      const input = await fhevm
        .createEncryptedInput(this.contractAddress, this.signers.alice.address)
        .add8(move)
        .encrypt();

      const tx = await this.contract
        .connect(this.signers.alice)
        .commitMove(0, input.handles[0], input.inputProof);

      await expect(tx).to.emit(this.contract, "MoveCommitted").withArgs(0, this.signers.alice.address);

      const game = await this.contract.getGame(0);
      expect(game.player1Committed).to.be.true;
    });

    it("should allow player 2 to commit move", async function () {
      const move = 2; // Paper

      const input = await fhevm
        .createEncryptedInput(this.contractAddress, this.signers.bob.address)
        .add8(move)
        .encrypt();

      const tx = await this.contract.connect(this.signers.bob).commitMove(0, input.handles[0], input.inputProof);

      await expect(tx).to.emit(this.contract, "MoveCommitted").withArgs(0, this.signers.bob.address);

      const game = await this.contract.getGame(0);
      expect(game.player2Committed).to.be.true;
    });

    it("should revert if player already committed", async function () {
      const input1 = await fhevm
        .createEncryptedInput(this.contractAddress, this.signers.alice.address)
        .add8(1)
        .encrypt();

      await this.contract.connect(this.signers.alice).commitMove(0, input1.handles[0], input1.inputProof);

      const input2 = await fhevm
        .createEncryptedInput(this.contractAddress, this.signers.alice.address)
        .add8(2)
        .encrypt();

      await expect(
        this.contract.connect(this.signers.alice).commitMove(0, input2.handles[0], input2.inputProof)
      ).to.be.revertedWith("Already committed");
    });

    it("should revert if not a player", async function () {
      const signers = await ethers.getSigners();

      const input = await fhevm
        .createEncryptedInput(this.contractAddress, signers[2].address)
        .add8(1)
        .encrypt();

      await expect(
        this.contract.connect(signers[2]).commitMove(0, input.handles[0], input.inputProof)
      ).to.be.revertedWith("Not a player");
    });
  });

  describe("Complete Game Flow", function () {
    beforeEach(async function () {
      await this.contract.connect(this.signers.alice).createGame(100);
      await this.contract.connect(this.signers.bob).joinGame(0);
    });

    it("should complete game when both players commit", async function () {
      // Alice commits Rock (1)
      const aliceInput = await fhevm
        .createEncryptedInput(this.contractAddress, this.signers.alice.address)
        .add8(1)
        .encrypt();

      await this.contract.connect(this.signers.alice).commitMove(0, aliceInput.handles[0], aliceInput.inputProof);

      // Bob commits Paper (2) - Bob should win
      const bobInput = await fhevm
        .createEncryptedInput(this.contractAddress, this.signers.bob.address)
        .add8(2)
        .encrypt();

      const tx = await this.contract.connect(this.signers.bob).commitMove(0, bobInput.handles[0], bobInput.inputProof);

      await expect(tx).to.emit(this.contract, "GameResult");

      const game = await this.contract.getGame(0);
      expect(game.isActive).to.be.false;
    });

    it("should allow players to decrypt their moves", async function () {
      // Alice commits Rock (1)
      const aliceInput = await fhevm
        .createEncryptedInput(this.contractAddress, this.signers.alice.address)
        .add8(1)
        .encrypt();

      await this.contract.connect(this.signers.alice).commitMove(0, aliceInput.handles[0], aliceInput.inputProof);

      // Get and decrypt Alice's move
      const aliceMoveHandle = await this.contract.connect(this.signers.alice).getMove(0);
      const aliceMove = await fhevm.userDecryptEuint(
        FhevmType.euint8,
        aliceMoveHandle,
        this.contractAddress,
        this.signers.alice
      );

      expect(aliceMove).to.equal(1);
    });
  });

  describe("Game Scenarios", function () {
    beforeEach(async function () {
      await this.contract.connect(this.signers.alice).createGame(100);
      await this.contract.connect(this.signers.bob).joinGame(0);
    });

    it("should handle Rock vs Scissors (Alice wins)", async function () {
      const aliceInput = await fhevm
        .createEncryptedInput(this.contractAddress, this.signers.alice.address)
        .add8(1) // Rock
        .encrypt();

      const bobInput = await fhevm
        .createEncryptedInput(this.contractAddress, this.signers.bob.address)
        .add8(3) // Scissors
        .encrypt();

      await this.contract.connect(this.signers.alice).commitMove(0, aliceInput.handles[0], aliceInput.inputProof);
      await this.contract.connect(this.signers.bob).commitMove(0, bobInput.handles[0], bobInput.inputProof);

      const game = await this.contract.getGame(0);
      expect(game.isActive).to.be.false;
    });

    it("should handle Paper vs Rock (Alice wins)", async function () {
      const aliceInput = await fhevm
        .createEncryptedInput(this.contractAddress, this.signers.alice.address)
        .add8(2) // Paper
        .encrypt();

      const bobInput = await fhevm
        .createEncryptedInput(this.contractAddress, this.signers.bob.address)
        .add8(1) // Rock
        .encrypt();

      await this.contract.connect(this.signers.alice).commitMove(0, aliceInput.handles[0], aliceInput.inputProof);
      await this.contract.connect(this.signers.bob).commitMove(0, bobInput.handles[0], bobInput.inputProof);

      const game = await this.contract.getGame(0);
      expect(game.isActive).to.be.false;
    });

    it("should handle Scissors vs Paper (Alice wins)", async function () {
      const aliceInput = await fhevm
        .createEncryptedInput(this.contractAddress, this.signers.alice.address)
        .add8(3) // Scissors
        .encrypt();

      const bobInput = await fhevm
        .createEncryptedInput(this.contractAddress, this.signers.bob.address)
        .add8(2) // Paper
        .encrypt();

      await this.contract.connect(this.signers.alice).commitMove(0, aliceInput.handles[0], aliceInput.inputProof);
      await this.contract.connect(this.signers.bob).commitMove(0, bobInput.handles[0], bobInput.inputProof);

      const game = await this.contract.getGame(0);
      expect(game.isActive).to.be.false;
    });

    it("should handle draw (same moves)", async function () {
      const aliceInput = await fhevm
        .createEncryptedInput(this.contractAddress, this.signers.alice.address)
        .add8(1) // Rock
        .encrypt();

      const bobInput = await fhevm
        .createEncryptedInput(this.contractAddress, this.signers.bob.address)
        .add8(1) // Rock
        .encrypt();

      await this.contract.connect(this.signers.alice).commitMove(0, aliceInput.handles[0], aliceInput.inputProof);
      await this.contract.connect(this.signers.bob).commitMove(0, bobInput.handles[0], bobInput.inputProof);

      const game = await this.contract.getGame(0);
      expect(game.isActive).to.be.false;
    });
  });

  describe("Multiple Games", function () {
    it("should handle multiple concurrent games", async function () {
      // Create two games
      await this.contract.connect(this.signers.alice).createGame(100);

      const signers = await ethers.getSigners();
      await this.contract.connect(signers[2]).initializeBalance(1000);
      await this.contract.connect(signers[2]).createGame(100);

      // Join both games
      await this.contract.connect(this.signers.bob).joinGame(0);
      await this.contract.connect(signers[3]).initializeBalance(1000);
      await this.contract.connect(signers[3]).joinGame(1);

      // Verify both games are independent
      const game0 = await this.contract.getGame(0);
      const game1 = await this.contract.getGame(1);

      expect(game0.player1).to.equal(this.signers.alice.address);
      expect(game0.player2).to.equal(this.signers.bob.address);

      expect(game1.player1).to.equal(signers[2].address);
      expect(game1.player2).to.equal(signers[3].address);
    });
  });
});
