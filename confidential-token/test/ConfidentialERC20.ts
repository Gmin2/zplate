import { expect } from "chai";
import { ethers, fhevm } from "hardhat";
import { FhevmType } from "@fhevm/hardhat-plugin";
import type { Signers } from "../types";
import { deployConfidentialERC20Fixture } from "./ConfidentialERC20.fixture";

describe("ConfidentialERC20", function () {
  before(async function () {
    this.signers = {} as Signers;
    const signers = await ethers.getSigners();
    this.signers.alice = signers[0];
    this.signers.bob = signers[1];
    this.signers.carol = signers[2];
  });

  beforeEach(async function () {
    const deployment = await deployConfidentialERC20Fixture();
    this.contractAddress = await deployment.contract.getAddress();
    this.contract = deployment.contract;
  });

  describe("Token Metadata", function () {
    it("should have correct name", async function () {
      expect(await this.contract.name()).to.equal("Confidential Token");
    });

    it("should have correct symbol", async function () {
      expect(await this.contract.symbol()).to.equal("CTKN");
    });

    it("should have correct decimals", async function () {
      expect(await this.contract.decimals()).to.equal(18);
    });

    it("should start with zero total supply", async function () {
      expect(await this.contract.totalSupply()).to.equal(0);
    });
  });

  describe("Minting", function () {
    it("should mint tokens to an address", async function () {
      const mintAmount = 1000n;

      await this.contract.mint(this.signers.alice.address, mintAmount);

      const totalSupply = await this.contract.totalSupply();
      expect(totalSupply).to.equal(mintAmount);
    });

    it("should allow user to decrypt minted balance", async function () {
      const mintAmount = 1000n;

      await this.contract.mint(this.signers.alice.address, mintAmount);

      const balanceHandle = await this.contract.balanceOf(this.signers.alice.address);
      const balance = await fhevm.userDecryptEuint(
        FhevmType.euint64,
        balanceHandle,
        this.contractAddress,
        this.signers.alice
      );

      expect(balance).to.equal(mintAmount);
    });

    it("should initialize balance for caller", async function () {
      const amount = 500n;

      await this.contract.connect(this.signers.alice).initializeBalance(amount);

      const balanceHandle = await this.contract.balanceOf(this.signers.alice.address);
      const balance = await fhevm.userDecryptEuint(
        FhevmType.euint64,
        balanceHandle,
        this.contractAddress,
        this.signers.alice
      );

      expect(balance).to.equal(amount);
    });

    it("should update total supply when minting", async function () {
      await this.contract.mint(this.signers.alice.address, 1000n);
      await this.contract.mint(this.signers.bob.address, 500n);

      const totalSupply = await this.contract.totalSupply();
      expect(totalSupply).to.equal(1500n);
    });
  });

  describe("Transfers", function () {
    beforeEach(async function () {
      await this.contract.mint(this.signers.alice.address, 1000n);
    });

    it("should transfer tokens between accounts", async function () {
      const transferAmount = 100n;

      const input = await fhevm
        .createEncryptedInput(this.contractAddress, this.signers.alice.address)
        .add64(transferAmount)
        .encrypt();

      await this.contract
        .connect(this.signers.alice)
        .transfer(this.signers.bob.address, input.handles[0], input.inputProof);

      // Verify Alice's balance decreased
      const aliceBalanceHandle = await this.contract.balanceOf(this.signers.alice.address);
      const aliceBalance = await fhevm.userDecryptEuint(
        FhevmType.euint64,
        aliceBalanceHandle,
        this.contractAddress,
        this.signers.alice
      );
      expect(aliceBalance).to.equal(900n);

      // Verify Bob's balance increased
      const bobBalanceHandle = await this.contract.balanceOf(this.signers.bob.address);
      const bobBalance = await fhevm.userDecryptEuint(
        FhevmType.euint64,
        bobBalanceHandle,
        this.contractAddress,
        this.signers.bob
      );
      expect(bobBalance).to.equal(100n);
    });

    it("should emit Transfer event", async function () {
      const transferAmount = 100n;

      const input = await fhevm
        .createEncryptedInput(this.contractAddress, this.signers.alice.address)
        .add64(transferAmount)
        .encrypt();

      const tx = await this.contract
        .connect(this.signers.alice)
        .transfer(this.signers.bob.address, input.handles[0], input.inputProof);

      await expect(tx).to.emit(this.contract, "Transfer");
    });

    it("should revert transfer to zero address", async function () {
      const input = await fhevm
        .createEncryptedInput(this.contractAddress, this.signers.alice.address)
        .add64(100)
        .encrypt();

      await expect(
        this.contract.connect(this.signers.alice).transfer(ethers.ZeroAddress, input.handles[0], input.inputProof)
      ).to.be.revertedWith("Transfer to zero address");
    });

    it("should handle multiple transfers", async function () {
      const input1 = await fhevm
        .createEncryptedInput(this.contractAddress, this.signers.alice.address)
        .add64(100)
        .encrypt();

      await this.contract
        .connect(this.signers.alice)
        .transfer(this.signers.bob.address, input1.handles[0], input1.inputProof);

      const input2 = await fhevm
        .createEncryptedInput(this.contractAddress, this.signers.alice.address)
        .add64(200)
        .encrypt();

      await this.contract
        .connect(this.signers.alice)
        .transfer(this.signers.carol.address, input2.handles[0], input2.inputProof);

      const aliceBalanceHandle = await this.contract.balanceOf(this.signers.alice.address);
      const aliceBalance = await fhevm.userDecryptEuint(
        FhevmType.euint64,
        aliceBalanceHandle,
        this.contractAddress,
        this.signers.alice
      );
      expect(aliceBalance).to.equal(700n);
    });
  });

  describe("Approvals", function () {
    beforeEach(async function () {
      await this.contract.mint(this.signers.alice.address, 1000n);
    });

    it("should approve spending allowance", async function () {
      const approvalAmount = 500n;

      const input = await fhevm
        .createEncryptedInput(this.contractAddress, this.signers.alice.address)
        .add64(approvalAmount)
        .encrypt();

      await this.contract
        .connect(this.signers.alice)
        .approve(this.signers.bob.address, input.handles[0], input.inputProof);

      const allowanceHandle = await this.contract.allowance(this.signers.alice.address, this.signers.bob.address);
      const allowance = await fhevm.userDecryptEuint(
        FhevmType.euint64,
        allowanceHandle,
        this.contractAddress,
        this.signers.alice
      );

      expect(allowance).to.equal(approvalAmount);
    });

    it("should emit Approval event", async function () {
      const input = await fhevm
        .createEncryptedInput(this.contractAddress, this.signers.alice.address)
        .add64(500)
        .encrypt();

      const tx = await this.contract
        .connect(this.signers.alice)
        .approve(this.signers.bob.address, input.handles[0], input.inputProof);

      await expect(tx).to.emit(this.contract, "Approval");
    });

    it("should revert approval to zero address", async function () {
      const input = await fhevm
        .createEncryptedInput(this.contractAddress, this.signers.alice.address)
        .add64(500)
        .encrypt();

      await expect(
        this.contract.connect(this.signers.alice).approve(ethers.ZeroAddress, input.handles[0], input.inputProof)
      ).to.be.revertedWith("Approve to zero address");
    });

    it("should allow spender to decrypt allowance", async function () {
      const approvalAmount = 500n;

      const input = await fhevm
        .createEncryptedInput(this.contractAddress, this.signers.alice.address)
        .add64(approvalAmount)
        .encrypt();

      await this.contract
        .connect(this.signers.alice)
        .approve(this.signers.bob.address, input.handles[0], input.inputProof);

      const allowanceHandle = await this.contract.allowance(this.signers.alice.address, this.signers.bob.address);
      const allowance = await fhevm.userDecryptEuint(
        FhevmType.euint64,
        allowanceHandle,
        this.contractAddress,
        this.signers.bob
      );

      expect(allowance).to.equal(approvalAmount);
    });
  });

  describe("TransferFrom", function () {
    beforeEach(async function () {
      await this.contract.mint(this.signers.alice.address, 1000n);

      const approvalInput = await fhevm
        .createEncryptedInput(this.contractAddress, this.signers.alice.address)
        .add64(500)
        .encrypt();

      await this.contract
        .connect(this.signers.alice)
        .approve(this.signers.bob.address, approvalInput.handles[0], approvalInput.inputProof);
    });

    it("should transfer from approved account", async function () {
      const transferAmount = 200n;

      const input = await fhevm
        .createEncryptedInput(this.contractAddress, this.signers.bob.address)
        .add64(transferAmount)
        .encrypt();

      await this.contract
        .connect(this.signers.bob)
        .transferFrom(this.signers.alice.address, this.signers.carol.address, input.handles[0], input.inputProof);

      // Verify Alice's balance decreased
      const aliceBalanceHandle = await this.contract.balanceOf(this.signers.alice.address);
      const aliceBalance = await fhevm.userDecryptEuint(
        FhevmType.euint64,
        aliceBalanceHandle,
        this.contractAddress,
        this.signers.alice
      );
      expect(aliceBalance).to.equal(800n);

      // Verify Carol's balance increased
      const carolBalanceHandle = await this.contract.balanceOf(this.signers.carol.address);
      const carolBalance = await fhevm.userDecryptEuint(
        FhevmType.euint64,
        carolBalanceHandle,
        this.contractAddress,
        this.signers.carol
      );
      expect(carolBalance).to.equal(200n);
    });

    it("should decrease allowance after transferFrom", async function () {
      const transferAmount = 200n;

      const input = await fhevm
        .createEncryptedInput(this.contractAddress, this.signers.bob.address)
        .add64(transferAmount)
        .encrypt();

      await this.contract
        .connect(this.signers.bob)
        .transferFrom(this.signers.alice.address, this.signers.carol.address, input.handles[0], input.inputProof);

      const allowanceHandle = await this.contract.allowance(this.signers.alice.address, this.signers.bob.address);
      const allowance = await fhevm.userDecryptEuint(
        FhevmType.euint64,
        allowanceHandle,
        this.contractAddress,
        this.signers.bob
      );

      expect(allowance).to.equal(300n);
    });

    it("should emit Transfer event", async function () {
      const input = await fhevm
        .createEncryptedInput(this.contractAddress, this.signers.bob.address)
        .add64(200)
        .encrypt();

      const tx = await this.contract
        .connect(this.signers.bob)
        .transferFrom(this.signers.alice.address, this.signers.carol.address, input.handles[0], input.inputProof);

      await expect(tx).to.emit(this.contract, "Transfer");
    });

    it("should revert transferFrom to zero address", async function () {
      const input = await fhevm
        .createEncryptedInput(this.contractAddress, this.signers.bob.address)
        .add64(200)
        .encrypt();

      await expect(
        this.contract
          .connect(this.signers.bob)
          .transferFrom(this.signers.alice.address, ethers.ZeroAddress, input.handles[0], input.inputProof)
      ).to.be.revertedWith("Transfer to zero address");
    });
  });

  describe("Privacy Features", function () {
    it("should keep balances encrypted on-chain", async function () {
      await this.contract.mint(this.signers.alice.address, 1000n);

      const balanceHandle = await this.contract.balanceOf(this.signers.alice.address);

      // The balance handle is an encrypted value, not plaintext
      expect(balanceHandle).to.not.equal(1000n);
    });

    it("should prevent unauthorized balance decryption", async function () {
      await this.contract.mint(this.signers.alice.address, 1000n);

      const aliceBalanceHandle = await this.contract.balanceOf(this.signers.alice.address);

      // Bob cannot decrypt Alice's balance - should throw error
      await expect(
        fhevm.userDecryptEuint(FhevmType.euint64, aliceBalanceHandle, this.contractAddress, this.signers.bob)
      ).to.be.rejected;
    });
  });

  describe("Complex Scenarios", function () {
    it("should handle circular transfers", async function () {
      await this.contract.mint(this.signers.alice.address, 1000n);

      const input1 = await fhevm
        .createEncryptedInput(this.contractAddress, this.signers.alice.address)
        .add64(300)
        .encrypt();

      await this.contract
        .connect(this.signers.alice)
        .transfer(this.signers.bob.address, input1.handles[0], input1.inputProof);

      const input2 = await fhevm
        .createEncryptedInput(this.contractAddress, this.signers.bob.address)
        .add64(100)
        .encrypt();

      await this.contract
        .connect(this.signers.bob)
        .transfer(this.signers.alice.address, input2.handles[0], input2.inputProof);

      const aliceBalanceHandle = await this.contract.balanceOf(this.signers.alice.address);
      const aliceBalance = await fhevm.userDecryptEuint(
        FhevmType.euint64,
        aliceBalanceHandle,
        this.contractAddress,
        this.signers.alice
      );

      expect(aliceBalance).to.equal(800n); // 1000 - 300 + 100
    });
  });
});
