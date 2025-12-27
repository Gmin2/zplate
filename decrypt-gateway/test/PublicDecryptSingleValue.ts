import { expect } from "chai";
import { ethers } from "hardhat";
import type { Signers } from "../types";
import { deployPublicDecryptSingleValueFixture } from "./PublicDecryptSingleValue.fixture";

describe("PublicDecryptSingleValue", function () {
  before(async function () {
    this.signers = {} as Signers;
    const signers = await ethers.getSigners();
    this.signers.alice = signers[0];
    this.signers.bob = signers[1];
  });

  beforeEach(async function () {
    const deployment = await deployPublicDecryptSingleValueFixture();
    this.contractAddress = await deployment.contract.getAddress();
    this.contract = deployment.contract;
  });

  describe("Initialization", function () {
    it("should initialize with encrypted value", async function () {
      const valueToEncrypt = 12345;

      await this.contract.connect(this.signers.alice).initializeValue(valueToEncrypt);

      const encryptedValue = await this.contract.getEncryptedValue();
      expect(encryptedValue).to.not.equal(0n);
    });

    it("should start with decrypted status as false", async function () {
      await this.contract.connect(this.signers.alice).initializeValue(100);

      const [isDecrypted, value] = await this.contract.getDecryptionStatus();
      expect(isDecrypted).to.be.false;
      expect(value).to.equal(0);
    });
  });

  describe("Phase 1: Request Decryption", function () {
    it("should emit DecryptionRequested event", async function () {
      const valueToEncrypt = 42;

      await this.contract.connect(this.signers.alice).initializeValue(valueToEncrypt);

      const tx = await this.contract.connect(this.signers.alice).requestDecryption();

      await expect(tx).to.emit(this.contract, "DecryptionRequested");
    });

    it("should revert if value not initialized", async function () {
      await expect(
        this.contract.connect(this.signers.alice).requestDecryption()
      ).to.be.revertedWith("Value not initialized");
    });

    it("should revert if already decrypted", async function () {
      await this.contract.connect(this.signers.alice).initializeValue(100);
      await this.contract.connect(this.signers.alice).requestDecryption();
      await this.contract.connect(this.signers.alice).finalizeDecryption(100);

      await expect(
        this.contract.connect(this.signers.alice).requestDecryption()
      ).to.be.revertedWith("Already decrypted");
    });
  });

  describe("Phase 2: Finalize Decryption", function () {
    it("should store cleartext value after finalization", async function () {
      const originalValue = 9999;

      await this.contract.connect(this.signers.alice).initializeValue(originalValue);
      await this.contract.connect(this.signers.alice).requestDecryption();

      // Simulate gateway callback with decrypted value
      await this.contract.connect(this.signers.alice).finalizeDecryption(originalValue);

      const [isDecrypted, cleartextValue] = await this.contract.getDecryptionStatus();
      expect(isDecrypted).to.be.true;
      expect(cleartextValue).to.equal(originalValue);
    });

    it("should emit ValueDecrypted event", async function () {
      const valueToEncrypt = 777;

      await this.contract.connect(this.signers.alice).initializeValue(valueToEncrypt);
      await this.contract.connect(this.signers.alice).requestDecryption();

      const tx = await this.contract.connect(this.signers.alice).finalizeDecryption(valueToEncrypt);

      await expect(tx)
        .to.emit(this.contract, "ValueDecrypted")
        .withArgs(valueToEncrypt);
    });

    it("should revert if already finalized", async function () {
      await this.contract.connect(this.signers.alice).initializeValue(100);
      await this.contract.connect(this.signers.alice).requestDecryption();
      await this.contract.connect(this.signers.alice).finalizeDecryption(100);

      await expect(
        this.contract.connect(this.signers.alice).finalizeDecryption(200)
      ).to.be.revertedWith("Already finalized");
    });
  });

  describe("Complete Two-Phase Flow", function () {
    it("should complete full encrypted→public flow", async function () {
      const secretValue = 54321;

      // Step 1: Initialize with encrypted value
      await this.contract.connect(this.signers.alice).initializeValue(secretValue);

      // Verify encrypted
      let [isDecrypted, _] = await this.contract.getDecryptionStatus();
      expect(isDecrypted).to.be.false;

      // Step 2: Request decryption
      const requestTx = await this.contract.connect(this.signers.alice).requestDecryption();
      await expect(requestTx).to.emit(this.contract, "DecryptionRequested");

      // Step 3: Finalize with decrypted value (simulating gateway callback)
      const finalizeTx = await this.contract.connect(this.signers.alice).finalizeDecryption(secretValue);
      await expect(finalizeTx).to.emit(this.contract, "ValueDecrypted").withArgs(secretValue);

      // Verify decrypted
      const [finalIsDecrypted, finalValue] = await this.contract.getDecryptionStatus();
      expect(finalIsDecrypted).to.be.true;
      expect(finalValue).to.equal(secretValue);

      // Anyone can now read the cleartext value
      const publicValue = await this.contract.cleartextValue();
      expect(publicValue).to.equal(secretValue);
    });
  });

  describe("Edge Cases", function () {
    it("should handle zero value", async function () {
      await this.contract.connect(this.signers.alice).initializeValue(0);
      await this.contract.connect(this.signers.alice).requestDecryption();
      await this.contract.connect(this.signers.alice).finalizeDecryption(0);

      const [_, value] = await this.contract.getDecryptionStatus();
      expect(value).to.equal(0);
    });

    it("should handle maximum uint32 value", async function () {
      const maxUint32 = 2 ** 32 - 1;

      await this.contract.connect(this.signers.alice).initializeValue(maxUint32);
      await this.contract.connect(this.signers.alice).requestDecryption();
      await this.contract.connect(this.signers.alice).finalizeDecryption(maxUint32);

      const [_, value] = await this.contract.getDecryptionStatus();
      expect(value).to.equal(maxUint32);
    });
  });

  describe("Production Considerations", function () {
    it("demonstrates why gateway authorization is needed", async function () {
      await this.contract.connect(this.signers.alice).initializeValue(1000);
      await this.contract.connect(this.signers.alice).requestDecryption();

      // In this simplified version, Bob can finalize (BAD!)
      // Production contracts MUST verify msg.sender is the gateway
      await this.contract.connect(this.signers.bob).finalizeDecryption(999);

      const [_, value] = await this.contract.getDecryptionStatus();
      // Bob was able to submit wrong value - this shows why auth is critical!
      expect(value).to.equal(999); // Not 1000!
    });
  });
});
