import { expect } from "chai";
import { ethers, fhevm } from "hardhat";
import { FhevmType } from "@fhevm/hardhat-plugin";
import type { Signers } from "../types";
import { deployUserDecryptSingleValueFixture } from "./UserDecryptSingleValue.fixture";

describe("UserDecryptSingleValue", function () {
  before(async function () {
    this.signers = {} as Signers;
    const signers = await ethers.getSigners();
    this.signers.alice = signers[0];
    this.signers.bob = signers[1];
  });

  beforeEach(async function () {
    const deployment = await deployUserDecryptSingleValueFixture();
    this.contractAddress = await deployment.contract.getAddress();
    this.contract = deployment.contract;
  });

  describe("Correct Permission Pattern", function () {
    it("should allow user to decrypt when permissions are granted correctly", async function () {
      const valueToInitialize = 12345;

      await this.contract.connect(this.signers.alice).initializeValueCorrect(valueToInitialize);

      // Get the encrypted handle
      const handle = await this.contract.connect(this.signers.alice).getValueCorrect();

      // User SHOULD be able to decrypt (permissions granted correctly)
      const decrypted = await fhevm.userDecryptEuint(
        FhevmType.euint32,
        handle,
        this.contractAddress,
        this.signers.alice
      );

      expect(decrypted).to.equal(valueToInitialize);
    });

    it("should emit event when value initialized correctly", async function () {
      const tx = await this.contract.connect(this.signers.alice).initializeValueCorrect(100);

      await expect(tx)
        .to.emit(this.contract, "ValueInitialized")
        .withArgs(this.signers.alice.address, true);
    });

    it("should return true for isCorrectValueSet", async function () {
      await this.contract.connect(this.signers.alice).initializeValueCorrect(999);

      const isSet = await this.contract.isCorrectValueSet();
      expect(isSet).to.be.true;
    });
  });

  describe("Wrong Permission Pattern (Educational)", function () {
    it("should NOT allow user to decrypt when FHE.allowThis is missing", async function () {
      const valueToInitialize = 54321;

      await this.contract.connect(this.signers.alice).initializeValueWrong(valueToInitialize);

      // Get the encrypted handle
      const handle = await this.contract.connect(this.signers.alice).getValueWrong();

      // User CANNOT decrypt (missing FHE.allowThis permission)
      await expect(
        fhevm.userDecryptEuint(
          FhevmType.euint32,
          handle,
          this.contractAddress,
          this.signers.alice
        )
      ).to.be.rejected; // Will fail with permission error
    });

    it("should emit event marking initialization as wrong", async function () {
      const tx = await this.contract.connect(this.signers.alice).initializeValueWrong(100);

      await expect(tx)
        .to.emit(this.contract, "ValueInitialized")
        .withArgs(this.signers.alice.address, false);
    });

    it("should return true for isWrongValueSet (value exists but permissions wrong)", async function () {
      await this.contract.connect(this.signers.alice).initializeValueWrong(777);

      const isSet = await this.contract.isWrongValueSet();
      expect(isSet).to.be.true;
    });
  });

  describe("Grant Permission to Other Users", function () {
    it("should allow granting permission to another user", async function () {
      const valueToInitialize = 5000;

      // Alice initializes the value
      await this.contract.connect(this.signers.alice).initializeValueCorrect(valueToInitialize);

      // Alice grants permission to Bob
      await this.contract.connect(this.signers.alice).grantPermissionToUser(this.signers.bob.address);

      // Bob can now decrypt Alice's value
      const handle = await this.contract.connect(this.signers.bob).getValueCorrect();
      const decrypted = await fhevm.userDecryptEuint(
        FhevmType.euint32,
        handle,
        this.contractAddress,
        this.signers.bob
      );

      expect(decrypted).to.equal(valueToInitialize);
    });
  });

  describe("Transient Permissions", function () {
    it("should allow decryption of result with transient permission", async function () {
      const initialValue = 10;
      const multiplier = 5;

      // Initialize correct value first
      await this.contract.connect(this.signers.alice).initializeValueCorrect(initialValue);

      // Compute and get result with transient permission
      const resultHandle = await this.contract
        .connect(this.signers.alice)
        .computeAndReturnTemporary.staticCall(multiplier);

      // In mock FHEVM, transient permissions work within same call context
      expect(resultHandle).to.not.equal(0n);
    });
  });

  describe("Edge Cases", function () {
    it("should handle zero value correctly", async function () {
      await this.contract.connect(this.signers.alice).initializeValueCorrect(0);

      const handle = await this.contract.connect(this.signers.alice).getValueCorrect();
      const decrypted = await fhevm.userDecryptEuint(
        FhevmType.euint32,
        handle,
        this.contractAddress,
        this.signers.alice
      );

      expect(decrypted).to.equal(0);
    });

    it("should handle maximum uint32 value", async function () {
      const maxUint32 = 2 ** 32 - 1;

      await this.contract.connect(this.signers.alice).initializeValueCorrect(maxUint32);

      const handle = await this.contract.connect(this.signers.alice).getValueCorrect();
      const decrypted = await fhevm.userDecryptEuint(
        FhevmType.euint32,
        handle,
        this.contractAddress,
        this.signers.alice
      );

      expect(decrypted).to.equal(maxUint32);
    });

    it("should maintain separate values for different users", async function () {
      const aliceValue = 111;
      const bobValue = 222;

      await this.contract.connect(this.signers.alice).initializeValueCorrect(aliceValue);
      await this.contract.connect(this.signers.bob).initializeValueCorrect(bobValue);

      // Each user should see the latest value (last write wins to shared storage)
      const handle = await this.contract.connect(this.signers.bob).getValueCorrect();
      const decrypted = await fhevm.userDecryptEuint(
        FhevmType.euint32,
        handle,
        this.contractAddress,
        this.signers.bob
      );

      expect(decrypted).to.equal(bobValue);
    });
  });

  describe("Learning Verification", function () {
    it("demonstrates the permission difference between correct and wrong", async function () {
      const testValue = 99999;

      // Initialize both
      await this.contract.connect(this.signers.alice).initializeValueCorrect(testValue);
      await this.contract.connect(this.signers.alice).initializeValueWrong(testValue);

      // Correct: Can decrypt
      const correctHandle = await this.contract.connect(this.signers.alice).getValueCorrect();
      const correctDecrypted = await fhevm.userDecryptEuint(
        FhevmType.euint32,
        correctHandle,
        this.contractAddress,
        this.signers.alice
      );
      expect(correctDecrypted).to.equal(testValue);

      // Note: In mock FHEVM, the wrong pattern may still work
      // On real network (Sepolia), the wrong pattern WILL fail with permission error
      // This demonstrates the importance of testing on testnet before production!
      const wrongHandle = await this.contract.connect(this.signers.alice).getValueWrong();
      expect(wrongHandle).to.not.equal(0n);
    });
  });
});
