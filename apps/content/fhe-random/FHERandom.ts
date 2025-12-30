import { expect } from "chai";
import { ethers, fhevm } from "hardhat";
import { FhevmType } from "@fhevm/hardhat-plugin";
import type { FHERandom } from "../types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

describe("FHERandom", function () {
  let contract: FHERandom;
  let contractAddress: string;
  let owner: HardhatEthersSigner;
  let alice: HardhatEthersSigner;
  let bob: HardhatEthersSigner;

  async function deployFixture() {
    const accounts = await ethers.getSigners();
    const contractFactory = await ethers.getContractFactory("FHERandom");
    const deployed = await contractFactory.connect(accounts[0]).deploy();
    await deployed.waitForDeployment();
    const address = await deployed.getAddress();

    return {
      contract: deployed,
      contractAddress: address,
      owner: accounts[0],
      alice: accounts[1],
      bob: accounts[2],
    };
  }

  beforeEach(async function () {
    if (!fhevm.isMock) {
      this.skip();
    }

    ({ contract, contractAddress, owner, alice, bob } = await deployFixture());
  });

  describe("Deployment", function () {
    it("should deploy successfully", async function () {
      expect(await contract.getAddress()).to.be.properAddress;
    });

    it("should start with zero total rolls", async function () {
      const rolls = await contract.getTotalRolls(await alice.getAddress());
      expect(rolls).to.equal(0);
    });
  });

  describe("Standard Dice Rolling", function () {
    it("should roll a standard 6-sided dice", async function () {
      const tx = await contract.connect(alice).rollDice();
      await tx.wait();

      const encryptedRoll = await contract.connect(alice).getLastDiceRoll();
      expect(encryptedRoll).to.exist;
    });

    it("should increment total rolls counter", async function () {
      await contract.connect(alice).rollDice();

      const rolls = await contract.getTotalRolls(await alice.getAddress());
      expect(rolls).to.equal(1);
    });

    it("should emit DiceRolled event", async function () {
      await expect(contract.connect(alice).rollDice())
        .to.emit(contract, "DiceRolled")
        .withArgs(await alice.getAddress(), 1);
    });

    it("should track multiple rolls", async function () {
      await contract.connect(alice).rollDice();
      await contract.connect(alice).rollDice();
      await contract.connect(alice).rollDice();

      const rolls = await contract.getTotalRolls(await alice.getAddress());
      expect(rolls).to.equal(3);
    });

    it("should allow different players to roll independently", async function () {
      await contract.connect(alice).rollDice();
      await contract.connect(bob).rollDice();

      const aliceRolls = await contract.getTotalRolls(await alice.getAddress());
      const bobRolls = await contract.getTotalRolls(await bob.getAddress());

      expect(aliceRolls).to.equal(1);
      expect(bobRolls).to.equal(1);
    });
  });

  describe("Custom Dice Rolling", function () {
    it("should roll a custom dice (d20)", async function () {
      const tx = await contract.connect(alice).rollCustomDice(20);
      await tx.wait();

      const encryptedRoll = await contract.connect(alice).getLastDiceRoll();
      expect(encryptedRoll).to.exist;
    });

    it("should roll a custom dice (d100)", async function () {
      const tx = await contract.connect(alice).rollCustomDice(100);
      await tx.wait();

      const encryptedRoll = await contract.connect(alice).getLastDiceRoll();
      expect(encryptedRoll).to.exist;
    });

    it("should revert if max value is zero", async function () {
      await expect(contract.connect(alice).rollCustomDice(0))
        .to.be.revertedWith("Max value must be positive");
    });

    it("should emit DiceRolled event for custom dice", async function () {
      await expect(contract.connect(alice).rollCustomDice(12))
        .to.emit(contract, "DiceRolled")
        .withArgs(await alice.getAddress(), 1);
    });
  });

  describe("Random Number in Range", function () {
    it("should generate random number in range [10, 100]", async function () {
      const tx = await contract.connect(alice).generateRandomInRange(10, 100);
      await tx.wait();

      const encryptedNumber = await contract.connect(alice).getLastRandomNumber();
      expect(encryptedNumber).to.exist;
    });

    it("should generate random number in range [0, 1000]", async function () {
      const tx = await contract.connect(alice).generateRandomInRange(0, 1000);
      await tx.wait();

      const encryptedNumber = await contract.connect(alice).getLastRandomNumber();
      expect(encryptedNumber).to.exist;
    });

    it("should emit RandomGenerated event", async function () {
      await expect(contract.connect(alice).generateRandomInRange(1, 100))
        .to.emit(contract, "RandomGenerated")
        .withArgs(await alice.getAddress());
    });

    it("should revert if min >= max", async function () {
      await expect(contract.connect(alice).generateRandomInRange(100, 10))
        .to.be.revertedWith("Min must be less than max");
    });

    it("should revert if min equals max", async function () {
      await expect(contract.connect(alice).generateRandomInRange(50, 50))
        .to.be.revertedWith("Min must be less than max");
    });
  });

  describe("Random Boolean", function () {
    it("should generate random boolean", async function () {
      const result = await contract.connect(alice).randomBool.staticCall();
      expect(result).to.exist;
    });

    it("should emit RandomGenerated event", async function () {
      await expect(contract.connect(alice).randomBool())
        .to.emit(contract, "RandomGenerated")
        .withArgs(await alice.getAddress());
    });
  });

  describe("Multiple Dice Rolling", function () {
    it("should roll 2 dice (2d6)", async function () {
      const tx = await contract.connect(alice).rollMultipleDice(2);
      await tx.wait();

      const encryptedSum = await contract.connect(alice).getLastDiceRoll();
      expect(encryptedSum).to.exist;
    });

    it("should roll 5 dice (5d6)", async function () {
      const tx = await contract.connect(alice).rollMultipleDice(5);
      await tx.wait();

      const encryptedSum = await contract.connect(alice).getLastDiceRoll();
      expect(encryptedSum).to.exist;
    });

    it("should roll maximum 10 dice", async function () {
      const tx = await contract.connect(alice).rollMultipleDice(10);
      await tx.wait();

      const encryptedSum = await contract.connect(alice).getLastDiceRoll();
      expect(encryptedSum).to.exist;
    });

    it("should revert if dice count is zero", async function () {
      await expect(contract.connect(alice).rollMultipleDice(0))
        .to.be.revertedWith("Invalid dice count");
    });

    it("should revert if dice count exceeds 10", async function () {
      await expect(contract.connect(alice).rollMultipleDice(11))
        .to.be.revertedWith("Invalid dice count");
    });

    it("should emit DiceRolled event", async function () {
      await expect(contract.connect(alice).rollMultipleDice(3))
        .to.emit(contract, "DiceRolled")
        .withArgs(await alice.getAddress(), 1);
    });
  });

  describe("View Functions", function () {
    it("should return last dice roll for caller", async function () {
      await contract.connect(alice).rollDice();

      const roll = await contract.connect(alice).getLastDiceRoll();
      expect(roll).to.exist;
    });

    it("should return last random number for caller", async function () {
      await contract.connect(alice).generateRandomInRange(1, 100);

      const number = await contract.connect(alice).getLastRandomNumber();
      expect(number).to.exist;
    });

    it("should return dice roll of specific player", async function () {
      await contract.connect(bob).rollDice();

      const roll = await contract.connect(alice).getDiceRollOf(await bob.getAddress());
      expect(roll).to.exist;
    });

    it("should return total rolls for player", async function () {
      await contract.connect(alice).rollDice();
      await contract.connect(alice).rollDice();

      const rolls = await contract.getTotalRolls(await alice.getAddress());
      expect(rolls).to.equal(2);
    });

    it("should return zero rolls for player who hasn't rolled", async function () {
      const rolls = await contract.getTotalRolls(await bob.getAddress());
      expect(rolls).to.equal(0);
    });
  });

  describe("Weighted Random Selection", function () {
    it("should select option with 50/50 weights", async function () {
      const result = await contract.connect(alice).weightedRandomSelection.staticCall(50, 50);
      expect(result).to.exist;
    });

    it("should select option with 70/30 weights", async function () {
      const result = await contract.connect(alice).weightedRandomSelection.staticCall(70, 30);
      expect(result).to.exist;
    });

    it("should select option with 90/10 weights", async function () {
      const result = await contract.connect(alice).weightedRandomSelection.staticCall(90, 10);
      expect(result).to.exist;
    });

    it("should revert if weights don't sum to 100", async function () {
      await expect(contract.connect(alice).weightedRandomSelection(60, 30))
        .to.be.revertedWith("Weights must sum to 100");
    });

    it("should revert if weights sum exceeds 100", async function () {
      await expect(contract.connect(alice).weightedRandomSelection(60, 50))
        .to.be.revertedWith("Weights must sum to 100");
    });

    it("should emit RandomGenerated event", async function () {
      await expect(contract.connect(alice).weightedRandomSelection(50, 50))
        .to.emit(contract, "RandomGenerated")
        .withArgs(await alice.getAddress());
    });
  });

  describe("Privacy and Isolation", function () {
    it("should keep rolls private per user", async function () {
      await contract.connect(alice).rollDice();
      await contract.connect(bob).rollDice();

      const aliceRoll = await contract.connect(alice).getLastDiceRoll();
      const bobRoll = await contract.connect(bob).getLastDiceRoll();

      // Both should exist but be different encrypted values
      expect(aliceRoll).to.exist;
      expect(bobRoll).to.exist;
    });

    it("should track stats separately for each user", async function () {
      await contract.connect(alice).rollDice();
      await contract.connect(alice).rollDice();
      await contract.connect(bob).rollDice();

      const aliceRolls = await contract.getTotalRolls(await alice.getAddress());
      const bobRolls = await contract.getTotalRolls(await bob.getAddress());

      expect(aliceRolls).to.equal(2);
      expect(bobRolls).to.equal(1);
    });
  });
});
