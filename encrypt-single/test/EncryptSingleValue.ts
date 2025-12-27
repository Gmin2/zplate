import { expect } from "chai";
import { ethers, fhevm } from "hardhat";
import { FhevmType } from "@fhevm/hardhat-plugin";
import type { Signers } from "../types";
import { deployEncryptSingleValueFixture } from "./EncryptSingleValue.fixture";

describe("EncryptSingleValue", function () {
  before(async function () {
    this.signers = {} as Signers;
    const signers = await ethers.getSigners();
    this.signers.alice = signers[0];
    this.signers.bob = signers[1];
    this.signers.carol = signers[2];
  });

  beforeEach(async function () {
    const deployment = await deployEncryptSingleValueFixture();
    this.contractAddress = await deployment.contract.getAddress();
    this.contract = deployment.contract;
  });

  describe("Deployment", function () {
    it("should deploy successfully", async function () {
      expect(this.contractAddress).to.be.properAddress;
    });
  });

  describe("Store Encrypted Value", function () {
    it("should store encrypted value from user input", async function () {
      const valueToEncrypt = 42;

      // Create encrypted input with proof
      const encryptedInput = await fhevm
        .createEncryptedInput(this.contractAddress, this.signers.alice.address)
        .add32(valueToEncrypt)
        .encrypt();

      // Store the encrypted value
      const tx = await this.contract
        .connect(this.signers.alice)
        .storeEncryptedValue(encryptedInput.handles[0], encryptedInput.inputProof);

      await expect(tx).to.emit(this.contract, "ValueStored").withArgs(this.signers.alice.address);

      // Verify we can retrieve the encrypted handle
      const encryptedValue = await this.contract.connect(this.signers.alice).getValue();
      expect(encryptedValue).to.not.equal(0n);
    });

    it("should allow user to decrypt their own value", async function () {
      const valueToEncrypt = 12345;

      // Store encrypted value
      const encryptedInput = await fhevm
        .createEncryptedInput(this.contractAddress, this.signers.alice.address)
        .add32(valueToEncrypt)
        .encrypt();

      await this.contract
        .connect(this.signers.alice)
        .storeEncryptedValue(encryptedInput.handles[0], encryptedInput.inputProof);

      // Retrieve and decrypt
      const handle = await this.contract.connect(this.signers.alice).getValue();
      const decrypted = await fhevm.userDecryptEuint(
        FhevmType.euint32,
        handle,
        this.contractAddress,
        this.signers.alice
      );

      expect(decrypted).to.equal(valueToEncrypt);
    });

    it("should store different values for different users", async function () {
      const aliceValue = 100;
      const bobValue = 200;

      // Alice stores value
      const aliceInput = await fhevm
        .createEncryptedInput(this.contractAddress, this.signers.alice.address)
        .add32(aliceValue)
        .encrypt();

      await this.contract
        .connect(this.signers.alice)
        .storeEncryptedValue(aliceInput.handles[0], aliceInput.inputProof);

      // Bob stores value
      const bobInput = await fhevm
        .createEncryptedInput(this.contractAddress, this.signers.bob.address)
        .add32(bobValue)
        .encrypt();

      await this.contract
        .connect(this.signers.bob)
        .storeEncryptedValue(bobInput.handles[0], bobInput.inputProof);

      // Verify each user can decrypt their own value
      const aliceHandle = await this.contract.connect(this.signers.alice).getValue();
      const aliceDecrypted = await fhevm.userDecryptEuint(
        FhevmType.euint32,
        aliceHandle,
        this.contractAddress,
        this.signers.alice
      );
      expect(aliceDecrypted).to.equal(aliceValue);

      const bobHandle = await this.contract.connect(this.signers.bob).getValue();
      const bobDecrypted = await fhevm.userDecryptEuint(
        FhevmType.euint32,
        bobHandle,
        this.contractAddress,
        this.signers.bob
      );
      expect(bobDecrypted).to.equal(bobValue);
    });

    it("should allow overwriting previous value", async function () {
      const firstValue = 111;
      const secondValue = 222;

      // Store first value
      const firstInput = await fhevm
        .createEncryptedInput(this.contractAddress, this.signers.alice.address)
        .add32(firstValue)
        .encrypt();

      await this.contract
        .connect(this.signers.alice)
        .storeEncryptedValue(firstInput.handles[0], firstInput.inputProof);

      // Store second value (overwrite)
      const secondInput = await fhevm
        .createEncryptedInput(this.contractAddress, this.signers.alice.address)
        .add32(secondValue)
        .encrypt();

      await this.contract
        .connect(this.signers.alice)
        .storeEncryptedValue(secondInput.handles[0], secondInput.inputProof);

      // Verify latest value
      const handle = await this.contract.connect(this.signers.alice).getValue();
      const decrypted = await fhevm.userDecryptEuint(
        FhevmType.euint32,
        handle,
        this.contractAddress,
        this.signers.alice
      );

      expect(decrypted).to.equal(secondValue);
    });
  });

  describe("Initialize Value (Correct Pattern)", function () {
    it("should allow user to decrypt contract-initialized value", async function () {
      const valueToInitialize = 999;

      await this.contract.connect(this.signers.alice).initializeValueCorrect(valueToInitialize);

      // User should be able to decrypt
      const handle = await this.contract.connect(this.signers.alice).getValue();
      const decrypted = await fhevm.userDecryptEuint(
        FhevmType.euint32,
        handle,
        this.contractAddress,
        this.signers.alice
      );

      expect(decrypted).to.equal(valueToInitialize);
    });
  });

  describe("Initialize Value Wrong (Anti-Pattern)", function () {
    it("should NOT allow user to decrypt when permissions missing", async function () {
      const valueToInitialize = 777;

      await this.contract.connect(this.signers.alice).initializeValueWrong(valueToInitialize);

      // User CANNOT decrypt because FHE.allow() was not called
      const handle = await this.contract.connect(this.signers.alice).getValue();

      await expect(
        fhevm.userDecryptEuint(
          FhevmType.euint32,
          handle,
          this.contractAddress,
          this.signers.alice
        )
      ).to.be.rejected; // Decryption will fail due to missing permissions
    });
  });

  describe("Get Value Of Other User", function () {
    it("should return encrypted handle but user cannot decrypt without permission", async function () {
      const aliceValue = 555;

      // Alice stores value
      const aliceInput = await fhevm
        .createEncryptedInput(this.contractAddress, this.signers.alice.address)
        .add32(aliceValue)
        .encrypt();

      await this.contract
        .connect(this.signers.alice)
        .storeEncryptedValue(aliceInput.handles[0], aliceInput.inputProof);

      // Bob can get Alice's encrypted handle
      const aliceHandle = await this.contract.connect(this.signers.bob).getValueOf(this.signers.alice.address);
      expect(aliceHandle).to.not.equal(0n);

      // But Bob CANNOT decrypt it (no permission)
      await expect(
        fhevm.userDecryptEuint(
          FhevmType.euint32,
          aliceHandle,
          this.contractAddress,
          this.signers.bob
        )
      ).to.be.rejected;
    });

    it("should allow Alice to decrypt her own value via getValueOf", async function () {
      const aliceValue = 333;

      // Alice stores value
      const aliceInput = await fhevm
        .createEncryptedInput(this.contractAddress, this.signers.alice.address)
        .add32(aliceValue)
        .encrypt();

      await this.contract
        .connect(this.signers.alice)
        .storeEncryptedValue(aliceInput.handles[0], aliceInput.inputProof);

      // Alice can decrypt via getValueOf
      const aliceHandle = await this.contract.connect(this.signers.alice).getValueOf(this.signers.alice.address);
      const decrypted = await fhevm.userDecryptEuint(
        FhevmType.euint32,
        aliceHandle,
        this.contractAddress,
        this.signers.alice
      );

      expect(decrypted).to.equal(aliceValue);
    });
  });

  describe("Edge Cases", function () {
    it("should handle zero value", async function () {
      const valueToEncrypt = 0;

      const encryptedInput = await fhevm
        .createEncryptedInput(this.contractAddress, this.signers.alice.address)
        .add32(valueToEncrypt)
        .encrypt();

      await this.contract
        .connect(this.signers.alice)
        .storeEncryptedValue(encryptedInput.handles[0], encryptedInput.inputProof);

      const handle = await this.contract.connect(this.signers.alice).getValue();
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

      const encryptedInput = await fhevm
        .createEncryptedInput(this.contractAddress, this.signers.alice.address)
        .add32(maxUint32)
        .encrypt();

      await this.contract
        .connect(this.signers.alice)
        .storeEncryptedValue(encryptedInput.handles[0], encryptedInput.inputProof);

      const handle = await this.contract.connect(this.signers.alice).getValue();
      const decrypted = await fhevm.userDecryptEuint(
        FhevmType.euint32,
        handle,
        this.contractAddress,
        this.signers.alice
      );

      expect(decrypted).to.equal(maxUint32);
    });
  });
});
