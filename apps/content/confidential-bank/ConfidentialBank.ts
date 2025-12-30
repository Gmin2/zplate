import { expect } from "chai";
import { ethers, fhevm } from "hardhat";
import { FhevmType } from "@fhevm/hardhat-plugin";
import type { Signers } from "../types";
import { deployConfidentialBankFixture } from "./ConfidentialBank.fixture";

describe("ConfidentialBank", function () {
  before(async function () {
    this.signers = {} as Signers;
    const signers = await ethers.getSigners();
    this.signers.alice = signers[0];
    this.signers.bob = signers[1];
    this.signers.carol = signers[2];
  });

  beforeEach(async function () {
    const deployment = await deployConfidentialBankFixture();
    this.contractAddress = await deployment.contract.getAddress();
    this.contract = deployment.contract;
  });

  describe("Deposits", function () {
    it("should allow user to deposit encrypted amount", async function () {
      const depositAmount = 1000;

      const input = await fhevm
        .createEncryptedInput(this.contractAddress, this.signers.alice.address)
        .add64(depositAmount)
        .encrypt();

      const tx = await this.contract
        .connect(this.signers.alice)
        .deposit(input.handles[0], input.inputProof);

      await expect(tx).to.emit(this.contract, "Deposited");
    });

    it("should update balance after deposit", async function () {
      const depositAmount = 5000;

      const input = await fhevm
        .createEncryptedInput(this.contractAddress, this.signers.alice.address)
        .add64(depositAmount)
        .encrypt();

      await this.contract
        .connect(this.signers.alice)
        .deposit(input.handles[0], input.inputProof);

      const balanceHandle = await this.contract.connect(this.signers.alice).getBalance();
      const decryptedBalance = await fhevm.userDecryptEuint(
        FhevmType.euint64,
        balanceHandle,
        this.contractAddress,
        this.signers.alice
      );

      expect(decryptedBalance).to.equal(depositAmount);
    });

    it("should accumulate multiple deposits", async function () {
      const firstDeposit = 1000;
      const secondDeposit = 2000;

      // First deposit
      const input1 = await fhevm
        .createEncryptedInput(this.contractAddress, this.signers.alice.address)
        .add64(firstDeposit)
        .encrypt();

      await this.contract
        .connect(this.signers.alice)
        .deposit(input1.handles[0], input1.inputProof);

      // Second deposit
      const input2 = await fhevm
        .createEncryptedInput(this.contractAddress, this.signers.alice.address)
        .add64(secondDeposit)
        .encrypt();

      await this.contract
        .connect(this.signers.alice)
        .deposit(input2.handles[0], input2.inputProof);

      // Check total
      const balanceHandle = await this.contract.connect(this.signers.alice).getBalance();
      const decryptedBalance = await fhevm.userDecryptEuint(
        FhevmType.euint64,
        balanceHandle,
        this.contractAddress,
        this.signers.alice
      );

      expect(decryptedBalance).to.equal(firstDeposit + secondDeposit);
    });
  });

  describe("Withdrawals", function () {
    it("should allow user to withdraw encrypted amount", async function () {
      // Setup: deposit first
      await this.contract.connect(this.signers.alice).initializeBalance(10000);

      // Withdraw
      const withdrawAmount = 3000;
      const input = await fhevm
        .createEncryptedInput(this.contractAddress, this.signers.alice.address)
        .add64(withdrawAmount)
        .encrypt();

      const tx = await this.contract
        .connect(this.signers.alice)
        .withdraw(input.handles[0], input.inputProof);

      await expect(tx).to.emit(this.contract, "Withdrawn");
    });

    it("should decrease balance after withdrawal", async function () {
      const initialBalance = 10000;
      const withdrawAmount = 3000;

      await this.contract.connect(this.signers.alice).initializeBalance(initialBalance);

      const input = await fhevm
        .createEncryptedInput(this.contractAddress, this.signers.alice.address)
        .add64(withdrawAmount)
        .encrypt();

      await this.contract
        .connect(this.signers.alice)
        .withdraw(input.handles[0], input.inputProof);

      const balanceHandle = await this.contract.connect(this.signers.alice).getBalance();
      const decryptedBalance = await fhevm.userDecryptEuint(
        FhevmType.euint64,
        balanceHandle,
        this.contractAddress,
        this.signers.alice
      );

      expect(decryptedBalance).to.equal(initialBalance - withdrawAmount);
    });
  });

  describe("Transfers", function () {
    it("should transfer encrypted amount between users", async function () {
      const initialBalance = 10000;
      const transferAmount = 2000;

      // Alice has initial balance
      await this.contract.connect(this.signers.alice).initializeBalance(initialBalance);

      // Transfer to Bob
      const input = await fhevm
        .createEncryptedInput(this.contractAddress, this.signers.alice.address)
        .add64(transferAmount)
        .encrypt();

      const tx = await this.contract
        .connect(this.signers.alice)
        .transfer(this.signers.bob.address, input.handles[0], input.inputProof);

      await expect(tx).to.emit(this.contract, "Transferred");
    });

    it("should update both sender and recipient balances", async function () {
      const aliceInitial = 10000;
      const transferAmount = 3000;

      await this.contract.connect(this.signers.alice).initializeBalance(aliceInitial);

      const input = await fhevm
        .createEncryptedInput(this.contractAddress, this.signers.alice.address)
        .add64(transferAmount)
        .encrypt();

      await this.contract
        .connect(this.signers.alice)
        .transfer(this.signers.bob.address, input.handles[0], input.inputProof);

      // Check Alice's balance
      const aliceBalanceHandle = await this.contract.connect(this.signers.alice).getBalance();
      const aliceBalance = await fhevm.userDecryptEuint(
        FhevmType.euint64,
        aliceBalanceHandle,
        this.contractAddress,
        this.signers.alice
      );
      expect(aliceBalance).to.equal(aliceInitial - transferAmount);

      // Check Bob's balance
      const bobBalanceHandle = await this.contract.connect(this.signers.bob).getBalance();
      const bobBalance = await fhevm.userDecryptEuint(
        FhevmType.euint64,
        bobBalanceHandle,
        this.contractAddress,
        this.signers.bob
      );
      expect(bobBalance).to.equal(transferAmount);
    });

    it("should revert transfer to zero address", async function () {
      const input = await fhevm
        .createEncryptedInput(this.contractAddress, this.signers.alice.address)
        .add64(100)
        .encrypt();

      await expect(
        this.contract
          .connect(this.signers.alice)
          .transfer(ethers.ZeroAddress, input.handles[0], input.inputProof)
      ).to.be.revertedWith("Transfer to zero address");
    });

    it("should revert transfer to self", async function () {
      const input = await fhevm
        .createEncryptedInput(this.contractAddress, this.signers.alice.address)
        .add64(100)
        .encrypt();

      await expect(
        this.contract
          .connect(this.signers.alice)
          .transfer(this.signers.alice.address, input.handles[0], input.inputProof)
      ).to.be.revertedWith("Cannot transfer to self");
    });
  });

  describe("Permission Management", function () {
    it("should allow granting permission to view balance", async function () {
      const aliceBalance = 5000;

      await this.contract.connect(this.signers.alice).initializeBalance(aliceBalance);

      // Grant permission to Bob
      await this.contract.connect(this.signers.alice).grantPermission(this.signers.bob.address);

      // Bob can now decrypt Alice's balance
      const aliceBalanceHandle = await this.contract
        .connect(this.signers.bob)
        .getBalanceOf(this.signers.alice.address);

      const decryptedBalance = await fhevm.userDecryptEuint(
        FhevmType.euint64,
        aliceBalanceHandle,
        this.contractAddress,
        this.signers.bob
      );

      expect(decryptedBalance).to.equal(aliceBalance);
    });

    it("should revert when granting permission to zero address", async function () {
      await expect(
        this.contract.connect(this.signers.alice).grantPermission(ethers.ZeroAddress)
      ).to.be.revertedWith("Cannot grant to zero address");
    });
  });

  describe("Multi-User Scenarios", function () {
    it("should maintain separate balances for different users", async function () {
      const aliceBalance = 1000;
      const bobBalance = 2000;
      const carolBalance = 3000;

      await this.contract.connect(this.signers.alice).initializeBalance(aliceBalance);
      await this.contract.connect(this.signers.bob).initializeBalance(bobBalance);
      await this.contract.connect(this.signers.carol).initializeBalance(carolBalance);

      // Check each balance
      const aliceHandle = await this.contract.connect(this.signers.alice).getBalance();
      const aliceDecrypted = await fhevm.userDecryptEuint(
        FhevmType.euint64,
        aliceHandle,
        this.contractAddress,
        this.signers.alice
      );
      expect(aliceDecrypted).to.equal(aliceBalance);

      const bobHandle = await this.contract.connect(this.signers.bob).getBalance();
      const bobDecrypted = await fhevm.userDecryptEuint(
        FhevmType.euint64,
        bobHandle,
        this.contractAddress,
        this.signers.bob
      );
      expect(bobDecrypted).to.equal(bobBalance);

      const carolHandle = await this.contract.connect(this.signers.carol).getBalance();
      const carolDecrypted = await fhevm.userDecryptEuint(
        FhevmType.euint64,
        carolHandle,
        this.contractAddress,
        this.signers.carol
      );
      expect(carolDecrypted).to.equal(carolBalance);
    });

    it("should handle complex multi-user transfer chain", async function () {
      // Alice -> Bob -> Carol
      await this.contract.connect(this.signers.alice).initializeBalance(10000);

      // Alice transfers to Bob
      const input1 = await fhevm
        .createEncryptedInput(this.contractAddress, this.signers.alice.address)
        .add64(4000)
        .encrypt();

      await this.contract
        .connect(this.signers.alice)
        .transfer(this.signers.bob.address, input1.handles[0], input1.inputProof);

      // Bob transfers to Carol
      const input2 = await fhevm
        .createEncryptedInput(this.contractAddress, this.signers.bob.address)
        .add64(1500)
        .encrypt();

      await this.contract
        .connect(this.signers.bob)
        .transfer(this.signers.carol.address, input2.handles[0], input2.inputProof);

      // Verify final balances
      const aliceHandle = await this.contract.connect(this.signers.alice).getBalance();
      const aliceBalance = await fhevm.userDecryptEuint(
        FhevmType.euint64,
        aliceHandle,
        this.contractAddress,
        this.signers.alice
      );
      expect(aliceBalance).to.equal(6000); // 10000 - 4000

      const bobHandle = await this.contract.connect(this.signers.bob).getBalance();
      const bobBalance = await fhevm.userDecryptEuint(
        FhevmType.euint64,
        bobHandle,
        this.contractAddress,
        this.signers.bob
      );
      expect(bobBalance).to.equal(2500); // 4000 - 1500

      const carolHandle = await this.contract.connect(this.signers.carol).getBalance();
      const carolBalance = await fhevm.userDecryptEuint(
        FhevmType.euint64,
        carolHandle,
        this.contractAddress,
        this.signers.carol
      );
      expect(carolBalance).to.equal(1500);
    });
  });

  describe("Edge Cases", function () {
    it("should handle zero balance", async function () {
      // Initialize with zero
      await this.contract.connect(this.signers.alice).initializeBalance(0);

      const balanceHandle = await this.contract.connect(this.signers.alice).getBalance();
      const decryptedBalance = await fhevm.userDecryptEuint(
        FhevmType.euint64,
        balanceHandle,
        this.contractAddress,
        this.signers.alice
      );

      expect(decryptedBalance).to.equal(0);
    });

    it("should handle zero amount deposit", async function () {
      const input = await fhevm
        .createEncryptedInput(this.contractAddress, this.signers.alice.address)
        .add64(0)
        .encrypt();

      await this.contract
        .connect(this.signers.alice)
        .deposit(input.handles[0], input.inputProof);

      const balanceHandle = await this.contract.connect(this.signers.alice).getBalance();
      const balance = await fhevm.userDecryptEuint(
        FhevmType.euint64,
        balanceHandle,
        this.contractAddress,
        this.signers.alice
      );

      expect(balance).to.equal(0);
    });

    it("should handle maximum uint64 value", async function () {
      const maxUint64 = 2n ** 64n - 1n;

      await this.contract.connect(this.signers.alice).initializeBalance(maxUint64);

      const balanceHandle = await this.contract.connect(this.signers.alice).getBalance();
      const balance = await fhevm.userDecryptEuint(
        FhevmType.euint64,
        balanceHandle,
        this.contractAddress,
        this.signers.alice
      );

      expect(balance).to.equal(maxUint64);
    });
  });
});
