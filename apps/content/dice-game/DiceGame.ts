import { expect } from "chai";
import { ethers, fhevm } from "hardhat";
import { FhevmType } from "@fhevm/hardhat-plugin";
import type { Signers } from "../types";
import { deployDiceGameFixture } from "./DiceGame.fixture";

describe("DiceGame", function () {
  before(async function () {
    this.signers = {} as Signers;
    const signers = await ethers.getSigners();
    this.signers.alice = signers[0];
    this.signers.bob = signers[1];
  });

  beforeEach(async function () {
    const deployment = await deployDiceGameFixture();
    this.contractAddress = await deployment.contract.getAddress();
    this.contract = deployment.contract;
  });

  describe("Deposits", function () {
    it("should allow player to deposit", async function () {
      const depositAmount = 1000;

      const input = await fhevm
        .createEncryptedInput(this.contractAddress, this.signers.alice.address)
        .add32(depositAmount)
        .encrypt();

      await this.contract
        .connect(this.signers.alice)
        .deposit(input.handles[0], input.inputProof);

      const balanceHandle = await this.contract.connect(this.signers.alice).getBalance();
      const balance = await fhevm.userDecryptEuint(
        FhevmType.euint32,
        balanceHandle,
        this.contractAddress,
        this.signers.alice
      );

      expect(balance).to.equal(depositAmount);
    });

    it("should accumulate multiple deposits", async function () {
      const deposit1 = 500;
      const deposit2 = 300;

      const input1 = await fhevm
        .createEncryptedInput(this.contractAddress, this.signers.alice.address)
        .add32(deposit1)
        .encrypt();

      await this.contract
        .connect(this.signers.alice)
        .deposit(input1.handles[0], input1.inputProof);

      const input2 = await fhevm
        .createEncryptedInput(this.contractAddress, this.signers.alice.address)
        .add32(deposit2)
        .encrypt();

      await this.contract
        .connect(this.signers.alice)
        .deposit(input2.handles[0], input2.inputProof);

      const balanceHandle = await this.contract.connect(this.signers.alice).getBalance();
      const balance = await fhevm.userDecryptEuint(
        FhevmType.euint32,
        balanceHandle,
        this.contractAddress,
        this.signers.alice
      );

      expect(balance).to.equal(deposit1 + deposit2);
    });
  });

  describe("Placing Bets", function () {
    beforeEach(async function () {
      // Give Alice some balance
      await this.contract.connect(this.signers.alice).initializeBalance(1000);
    });

    it("should allow placing a bet", async function () {
      const betAmount = 100;

      const input = await fhevm
        .createEncryptedInput(this.contractAddress, this.signers.alice.address)
        .add32(betAmount)
        .encrypt();

      const tx = await this.contract
        .connect(this.signers.alice)
        .placeBet(input.handles[0], input.inputProof);

      await expect(tx).to.emit(this.contract, "BetPlaced");

      const hasActiveBet = await this.contract.connect(this.signers.alice).hasActiveBet();
      expect(hasActiveBet).to.be.true;
    });

    it("should deduct bet from balance", async function () {
      const initialBalance = 1000;
      const betAmount = 100;

      const input = await fhevm
        .createEncryptedInput(this.contractAddress, this.signers.alice.address)
        .add32(betAmount)
        .encrypt();

      await this.contract
        .connect(this.signers.alice)
        .placeBet(input.handles[0], input.inputProof);

      const balanceHandle = await this.contract.connect(this.signers.alice).getBalance();
      const balance = await fhevm.userDecryptEuint(
        FhevmType.euint32,
        balanceHandle,
        this.contractAddress,
        this.signers.alice
      );

      expect(balance).to.equal(initialBalance - betAmount);
    });

    it("should revert if player already has active bet", async function () {
      const input = await fhevm
        .createEncryptedInput(this.contractAddress, this.signers.alice.address)
        .add32(100)
        .encrypt();

      await this.contract
        .connect(this.signers.alice)
        .placeBet(input.handles[0], input.inputProof);

      const input2 = await fhevm
        .createEncryptedInput(this.contractAddress, this.signers.alice.address)
        .add32(50)
        .encrypt();

      await expect(
        this.contract
          .connect(this.signers.alice)
          .placeBet(input2.handles[0], input2.inputProof)
      ).to.be.revertedWith("Finish current game first");
    });
  });

  describe("Rolling Dice", function () {
    beforeEach(async function () {
      await this.contract.connect(this.signers.alice).initializeBalance(1000);

      const input = await fhevm
        .createEncryptedInput(this.contractAddress, this.signers.alice.address)
        .add32(100)
        .encrypt();

      await this.contract
        .connect(this.signers.alice)
        .placeBet(input.handles[0], input.inputProof);
    });

    it("should roll dice and emit events", async function () {
      const guess = 3;

      const tx = await this.contract.connect(this.signers.alice).rollDice(guess);

      await expect(tx).to.emit(this.contract, "DiceRolled");
      await expect(tx).to.emit(this.contract, "PayoutCalculated");
    });

    it("should clear active bet after roll", async function () {
      await this.contract.connect(this.signers.alice).rollDice(3);

      const hasActiveBet = await this.contract.connect(this.signers.alice).hasActiveBet();
      expect(hasActiveBet).to.be.false;
    });

    it("should generate dice roll between 1 and 6", async function () {
      await this.contract.connect(this.signers.alice).rollDice(3);

      const rollHandle = await this.contract.connect(this.signers.alice).getLastRoll();
      const roll = await fhevm.userDecryptEuint(
        FhevmType.euint8,
        rollHandle,
        this.contractAddress,
        this.signers.alice
      );

      expect(roll).to.be.gte(1);
      expect(roll).to.be.lte(6);
    });

    it("should revert if no active bet", async function () {
      // Alice already rolled, so no active bet
      await this.contract.connect(this.signers.alice).rollDice(3);

      await expect(
        this.contract.connect(this.signers.alice).rollDice(3)
      ).to.be.revertedWith("No active bet");
    });

    it("should revert if guess is out of range", async function () {
      await expect(
        this.contract.connect(this.signers.alice).rollDice(0)
      ).to.be.revertedWith("Guess must be 1-6");

      await expect(
        this.contract.connect(this.signers.alice).rollDice(7)
      ).to.be.revertedWith("Guess must be 1-6");
    });

    it("should allow decrypting last payout", async function () {
      await this.contract.connect(this.signers.alice).rollDice(3);

      const payoutHandle = await this.contract.connect(this.signers.alice).getLastPayout();
      const payout = await fhevm.userDecryptEuint(
        FhevmType.euint32,
        payoutHandle,
        this.contractAddress,
        this.signers.alice
      );

      // Payout is either 0 (lost) or bet * 6 (won)
      expect(payout === 0n || payout === 600n).to.be.true;
    });
  });

  describe("Complete Game Flow", function () {
    it("should complete full game cycle", async function () {
      const initialBalance = 1000;
      const betAmount = 100;
      const guess = 4;

      // Step 1: Initialize balance
      await this.contract.connect(this.signers.alice).initializeBalance(initialBalance);

      // Step 2: Place bet
      const betInput = await fhevm
        .createEncryptedInput(this.contractAddress, this.signers.alice.address)
        .add32(betAmount)
        .encrypt();

      await this.contract
        .connect(this.signers.alice)
        .placeBet(betInput.handles[0], betInput.inputProof);

      // Step 3: Roll dice
      await this.contract.connect(this.signers.alice).rollDice(guess);

      // Step 4: Check results
      const rollHandle = await this.contract.connect(this.signers.alice).getLastRoll();
      const roll = await fhevm.userDecryptEuint(
        FhevmType.euint8,
        rollHandle,
        this.contractAddress,
        this.signers.alice
      );

      const payoutHandle = await this.contract.connect(this.signers.alice).getLastPayout();
      const payout = await fhevm.userDecryptEuint(
        FhevmType.euint32,
        payoutHandle,
        this.contractAddress,
        this.signers.alice
      );

      const balanceHandle = await this.contract.connect(this.signers.alice).getBalance();
      const finalBalance = await fhevm.userDecryptEuint(
        FhevmType.euint32,
        balanceHandle,
        this.contractAddress,
        this.signers.alice
      );

      // Verify results
      expect(roll).to.be.gte(1).and.lte(6);

      if (roll === guess) {
        // Won: balance should be initial - bet + (bet * 6)
        expect(payout).to.equal(betAmount * 6);
        expect(finalBalance).to.equal(initialBalance - betAmount + betAmount * 6);
      } else {
        // Lost: balance should be initial - bet
        expect(payout).to.equal(0);
        expect(finalBalance).to.equal(initialBalance - betAmount);
      }
    });
  });

  describe("Multiple Players", function () {
    it("should handle multiple players independently", async function () {
      // Alice and Bob both play
      await this.contract.connect(this.signers.alice).initializeBalance(1000);
      await this.contract.connect(this.signers.bob).initializeBalance(2000);

      const aliceBet = await fhevm
        .createEncryptedInput(this.contractAddress, this.signers.alice.address)
        .add32(100)
        .encrypt();

      const bobBet = await fhevm
        .createEncryptedInput(this.contractAddress, this.signers.bob.address)
        .add32(200)
        .encrypt();

      await this.contract
        .connect(this.signers.alice)
        .placeBet(aliceBet.handles[0], aliceBet.inputProof);

      await this.contract
        .connect(this.signers.bob)
        .placeBet(bobBet.handles[0], bobBet.inputProof);

      await this.contract.connect(this.signers.alice).rollDice(3);
      await this.contract.connect(this.signers.bob).rollDice(5);

      // Both should have results
      const aliceRollHandle = await this.contract.connect(this.signers.alice).getLastRoll();
      const aliceRoll = await fhevm.userDecryptEuint(
        FhevmType.euint8,
        aliceRollHandle,
        this.contractAddress,
        this.signers.alice
      );
      expect(aliceRoll).to.be.gte(1).and.lte(6);

      const bobRollHandle = await this.contract.connect(this.signers.bob).getLastRoll();
      const bobRoll = await fhevm.userDecryptEuint(
        FhevmType.euint8,
        bobRollHandle,
        this.contractAddress,
        this.signers.bob
      );
      expect(bobRoll).to.be.gte(1).and.lte(6);
    });
  });

  describe("Withdrawals", function () {
    it("should allow withdrawing balance", async function () {
      await this.contract.connect(this.signers.alice).initializeBalance(1000);

      const withdrawAmount = 300;
      const input = await fhevm
        .createEncryptedInput(this.contractAddress, this.signers.alice.address)
        .add32(withdrawAmount)
        .encrypt();

      await this.contract
        .connect(this.signers.alice)
        .withdraw(input.handles[0], input.inputProof);

      const balanceHandle = await this.contract.connect(this.signers.alice).getBalance();
      const balance = await fhevm.userDecryptEuint(
        FhevmType.euint32,
        balanceHandle,
        this.contractAddress,
        this.signers.alice
      );

      expect(balance).to.equal(700);
    });
  });
});
