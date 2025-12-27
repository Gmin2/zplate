import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { ethers, fhevm } from "hardhat";
import { FHESimpleVault, FHESimpleVault__factory } from "../types";
import { expect } from "chai";
import { FhevmType } from "@fhevm/hardhat-plugin";

type Signers = {
  deployer: HardhatEthersSigner;
  alice: HardhatEthersSigner;
  bob: HardhatEthersSigner;
};

async function deployFixture() {
  const factory = (await ethers.getContractFactory("FHESimpleVault")) as FHESimpleVault__factory;
  const vaultContract = (await factory.deploy()) as FHESimpleVault;
  const vaultAddress = await vaultContract.getAddress();

  return { vaultContract, vaultAddress };
}

describe("FHESimpleVault", function () {
  let signers: Signers;
  let vaultContract: FHESimpleVault;
  let vaultAddress: string;

  before(async function () {
    const ethSigners: HardhatEthersSigner[] = await ethers.getSigners();
    signers = { deployer: ethSigners[0], alice: ethSigners[1], bob: ethSigners[2] };
  });

  beforeEach(async function () {
    // Check whether the tests are running against an FHEVM mock environment
    if (!fhevm.isMock) {
      console.warn(`This hardhat test suite cannot run on Sepolia Testnet`);
      this.skip();
    }

    ({ vaultContract, vaultAddress } = await deployFixture());
  });

  describe("Deposits", function () {
    it("should have zero balance initially", async function () {
      const encryptedBalance = await vaultContract.connect(signers.alice).getBalance();
      // Initial balance should be bytes32(0) indicating uninitialized encrypted value
      expect(encryptedBalance).to.eq(ethers.ZeroHash);
    });

    it("should deposit encrypted amount successfully", async function () {
      const depositAmount = 100;

      // Encrypt the deposit amount
      const encryptedInput = await fhevm
        .createEncryptedInput(vaultAddress, signers.alice.address)
        .add32(depositAmount)
        .encrypt();

      // Perform deposit
      const tx = await vaultContract
        .connect(signers.alice)
        .deposit(encryptedInput.handles[0], encryptedInput.inputProof);
      await tx.wait();

      // Verify the balance
      const encryptedBalance = await vaultContract.connect(signers.alice).getBalance();
      const decryptedBalance = await fhevm.userDecryptEuint(
        FhevmType.euint32,
        encryptedBalance,
        vaultAddress,
        signers.alice
      );

      expect(decryptedBalance).to.eq(depositAmount);
    });

    it("should accumulate multiple deposits", async function () {
      const firstDeposit = 100;
      const secondDeposit = 50;

      // First deposit
      let encryptedInput = await fhevm
        .createEncryptedInput(vaultAddress, signers.alice.address)
        .add32(firstDeposit)
        .encrypt();

      let tx = await vaultContract
        .connect(signers.alice)
        .deposit(encryptedInput.handles[0], encryptedInput.inputProof);
      await tx.wait();

      // Second deposit
      encryptedInput = await fhevm
        .createEncryptedInput(vaultAddress, signers.alice.address)
        .add32(secondDeposit)
        .encrypt();

      tx = await vaultContract
        .connect(signers.alice)
        .deposit(encryptedInput.handles[0], encryptedInput.inputProof);
      await tx.wait();

      // Verify total balance
      const encryptedBalance = await vaultContract.connect(signers.alice).getBalance();
      const decryptedBalance = await fhevm.userDecryptEuint(
        FhevmType.euint32,
        encryptedBalance,
        vaultAddress,
        signers.alice
      );

      expect(decryptedBalance).to.eq(firstDeposit + secondDeposit);
    });

    it("should emit Deposit event", async function () {
      const depositAmount = 100;

      const encryptedInput = await fhevm
        .createEncryptedInput(vaultAddress, signers.alice.address)
        .add32(depositAmount)
        .encrypt();

      await expect(
        vaultContract.connect(signers.alice).deposit(encryptedInput.handles[0], encryptedInput.inputProof)
      )
        .to.emit(vaultContract, "Deposit")
        .withArgs(signers.alice.address);
    });
  });

  describe("Withdrawals", function () {
    beforeEach(async function () {
      // Setup: Alice deposits 100 units
      const depositAmount = 100;
      const encryptedInput = await fhevm
        .createEncryptedInput(vaultAddress, signers.alice.address)
        .add32(depositAmount)
        .encrypt();

      const tx = await vaultContract
        .connect(signers.alice)
        .deposit(encryptedInput.handles[0], encryptedInput.inputProof);
      await tx.wait();
    });

    it("should withdraw valid amount successfully", async function () {
      const withdrawAmount = 30;
      const expectedBalance = 70; // 100 - 30

      // Encrypt the withdrawal amount
      const encryptedInput = await fhevm
        .createEncryptedInput(vaultAddress, signers.alice.address)
        .add32(withdrawAmount)
        .encrypt();

      // Perform withdrawal
      const tx = await vaultContract
        .connect(signers.alice)
        .withdraw(encryptedInput.handles[0], encryptedInput.inputProof);
      await tx.wait();

      // Verify the remaining balance
      const encryptedBalance = await vaultContract.connect(signers.alice).getBalance();
      const decryptedBalance = await fhevm.userDecryptEuint(
        FhevmType.euint32,
        encryptedBalance,
        vaultAddress,
        signers.alice
      );

      expect(decryptedBalance).to.eq(expectedBalance);
    });

    it("should handle withdrawal of exact balance", async function () {
      const withdrawAmount = 100; // Withdraw entire balance

      const encryptedInput = await fhevm
        .createEncryptedInput(vaultAddress, signers.alice.address)
        .add32(withdrawAmount)
        .encrypt();

      const tx = await vaultContract
        .connect(signers.alice)
        .withdraw(encryptedInput.handles[0], encryptedInput.inputProof);
      await tx.wait();

      const encryptedBalance = await vaultContract.connect(signers.alice).getBalance();
      const decryptedBalance = await fhevm.userDecryptEuint(
        FhevmType.euint32,
        encryptedBalance,
        vaultAddress,
        signers.alice
      );

      expect(decryptedBalance).to.eq(0);
    });

    it("should not decrease balance when withdrawal exceeds available balance", async function () {
      const withdrawAmount = 150; // More than the 100 deposited
      const expectedBalance = 100; // Balance should remain unchanged

      const encryptedInput = await fhevm
        .createEncryptedInput(vaultAddress, signers.alice.address)
        .add32(withdrawAmount)
        .encrypt();

      const tx = await vaultContract
        .connect(signers.alice)
        .withdraw(encryptedInput.handles[0], encryptedInput.inputProof);
      await tx.wait();

      const encryptedBalance = await vaultContract.connect(signers.alice).getBalance();
      const decryptedBalance = await fhevm.userDecryptEuint(
        FhevmType.euint32,
        encryptedBalance,
        vaultAddress,
        signers.alice
      );

      // Balance should remain 100 (withdrawal was silently rejected)
      expect(decryptedBalance).to.eq(expectedBalance);
    });

    it("should emit Withdrawal event", async function () {
      const withdrawAmount = 30;

      const encryptedInput = await fhevm
        .createEncryptedInput(vaultAddress, signers.alice.address)
        .add32(withdrawAmount)
        .encrypt();

      await expect(
        vaultContract.connect(signers.alice).withdraw(encryptedInput.handles[0], encryptedInput.inputProof)
      )
        .to.emit(vaultContract, "Withdrawal")
        .withArgs(signers.alice.address);
    });
  });

  describe("Balance Queries", function () {
    it("should return user's own balance", async function () {
      const depositAmount = 75;

      const encryptedInput = await fhevm
        .createEncryptedInput(vaultAddress, signers.alice.address)
        .add32(depositAmount)
        .encrypt();

      const tx = await vaultContract
        .connect(signers.alice)
        .deposit(encryptedInput.handles[0], encryptedInput.inputProof);
      await tx.wait();

      const encryptedBalance = await vaultContract.connect(signers.alice).getBalance();
      const decryptedBalance = await fhevm.userDecryptEuint(
        FhevmType.euint32,
        encryptedBalance,
        vaultAddress,
        signers.alice
      );

      expect(decryptedBalance).to.eq(depositAmount);
    });

    it("should return balance for specific user using getBalanceOf", async function () {
      const depositAmount = 75;

      const encryptedInput = await fhevm
        .createEncryptedInput(vaultAddress, signers.alice.address)
        .add32(depositAmount)
        .encrypt();

      const tx = await vaultContract
        .connect(signers.alice)
        .deposit(encryptedInput.handles[0], encryptedInput.inputProof);
      await tx.wait();

      // Query Alice's balance using getBalanceOf
      const encryptedBalance = await vaultContract.getBalanceOf(signers.alice.address);
      const decryptedBalance = await fhevm.userDecryptEuint(
        FhevmType.euint32,
        encryptedBalance,
        vaultAddress,
        signers.alice
      );

      expect(decryptedBalance).to.eq(depositAmount);
    });
  });

  describe("Multi-User Isolation", function () {
    it("should maintain separate balances for different users", async function () {
      const aliceDeposit = 100;
      const bobDeposit = 200;

      // Alice deposits
      let encryptedInput = await fhevm
        .createEncryptedInput(vaultAddress, signers.alice.address)
        .add32(aliceDeposit)
        .encrypt();

      let tx = await vaultContract
        .connect(signers.alice)
        .deposit(encryptedInput.handles[0], encryptedInput.inputProof);
      await tx.wait();

      // Bob deposits
      encryptedInput = await fhevm
        .createEncryptedInput(vaultAddress, signers.bob.address)
        .add32(bobDeposit)
        .encrypt();

      tx = await vaultContract
        .connect(signers.bob)
        .deposit(encryptedInput.handles[0], encryptedInput.inputProof);
      await tx.wait();

      // Verify Alice's balance
      let encryptedBalance = await vaultContract.connect(signers.alice).getBalance();
      let decryptedBalance = await fhevm.userDecryptEuint(
        FhevmType.euint32,
        encryptedBalance,
        vaultAddress,
        signers.alice
      );
      expect(decryptedBalance).to.eq(aliceDeposit);

      // Verify Bob's balance
      encryptedBalance = await vaultContract.connect(signers.bob).getBalance();
      decryptedBalance = await fhevm.userDecryptEuint(
        FhevmType.euint32,
        encryptedBalance,
        vaultAddress,
        signers.bob
      );
      expect(decryptedBalance).to.eq(bobDeposit);
    });
  });
});
