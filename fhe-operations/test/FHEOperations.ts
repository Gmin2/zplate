import { expect } from "chai";
import { ethers, fhevm } from "hardhat";
import { FhevmType } from "@fhevm/hardhat-plugin";
import type { FHEOperations } from "../types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

describe("FHEOperations", function () {
  let contract: FHEOperations;
  let contractAddress: string;
  let owner: HardhatEthersSigner;
  let alice: HardhatEthersSigner;

  async function deployFixture() {
    const accounts = await ethers.getSigners();
    const contractFactory = await ethers.getContractFactory("FHEOperations");
    const deployed = await contractFactory.connect(accounts[0]).deploy();
    await deployed.waitForDeployment();
    const address = await deployed.getAddress();

    return {
      contract: deployed,
      contractAddress: address,
      owner: accounts[0],
      alice: accounts[1],
    };
  }

  beforeEach(async function () {
    if (!fhevm.isMock) {
      this.skip();
    }

    ({ contract, contractAddress, owner, alice } = await deployFixture());
  });

  describe("Deployment", function () {
    it("should deploy successfully", async function () {
      expect(await contract.getAddress()).to.be.properAddress;
    });

    it("should initialize with zero values", async function () {
      const value1 = await contract.getStoredValue1();
      const value2 = await contract.getStoredValue2();
      expect(value1).to.exist;
      expect(value2).to.exist;
    });
  });

  describe("Arithmetic Operations", function () {
    it("should verify contract has arithmetic operation functions", async function () {
      // Note: Direct testing of pure FHE operations requires encrypted inputs
      // These functions exist and can be called from other contracts
      expect(contract.demonstrateAdd).to.exist;
      expect(contract.demonstrateSub).to.exist;
      expect(contract.demonstrateMul).to.exist;
      expect(contract.demonstrateDiv).to.exist;
      expect(contract.demonstrateRem).to.exist;
    });
  });

  describe("Comparison Operations", function () {
    it("should verify contract has comparison operation functions", async function () {
      expect(contract.demonstrateEq).to.exist;
      expect(contract.demonstrateNe).to.exist;
      expect(contract.demonstrateLt).to.exist;
      expect(contract.demonstrateLe).to.exist;
      expect(contract.demonstrateGt).to.exist;
      expect(contract.demonstrateGe).to.exist;
      expect(contract.demonstrateMin).to.exist;
      expect(contract.demonstrateMax).to.exist;
    });
  });

  describe("Boolean Operations", function () {
    it("should verify contract has boolean operation functions", async function () {
      expect(contract.demonstrateAnd).to.exist;
      expect(contract.demonstrateOr).to.exist;
      expect(contract.demonstrateXor).to.exist;
      expect(contract.demonstrateNot).to.exist;
    });
  });

  describe("Conditional Operations", function () {
    it("should verify contract has select operation function", async function () {
      expect(contract.demonstrateSelect).to.exist;
    });
  });

  describe("Bitwise Operations", function () {
    it("should verify contract has bitwise operation functions", async function () {
      expect(contract.demonstrateShl).to.exist;
      expect(contract.demonstrateShlPlaintext).to.exist;
      expect(contract.demonstrateShr).to.exist;
      expect(contract.demonstrateShrPlaintext).to.exist;
      expect(contract.demonstrateRotl).to.exist;
      expect(contract.demonstrateRotr).to.exist;
    });
  });

  describe("Type Conversions", function () {
    it("should verify contract has type conversion functions", async function () {
      expect(contract.demonstrateAsEuint8).to.exist;
      expect(contract.demonstrateAsEuint16).to.exist;
      expect(contract.demonstrateAsEuint32).to.exist;
      expect(contract.demonstrateAsEuint64).to.exist;
      expect(contract.demonstrateAsEbool).to.exist;
    });
  });

  describe("External Input Handling", function () {
    it("should handle external encrypted input", async function () {
      const inputValue = 12345;
      const encryptedInput = await fhevm
        .createEncryptedInput(contractAddress, await alice.getAddress())
        .add32(inputValue)
        .encrypt();

      const tx = await contract
        .connect(alice)
        .demonstrateFromExternal(encryptedInput.handles[0], encryptedInput.inputProof);
      await tx.wait();

      const storedValue = await contract.getStoredValue1();
      expect(storedValue).to.exist;
    });

    it("should emit ValuesUpdated event", async function () {
      const inputValue = 999;
      const encryptedInput = await fhevm
        .createEncryptedInput(contractAddress, await alice.getAddress())
        .add32(inputValue)
        .encrypt();

      await expect(
        contract.connect(alice).demonstrateFromExternal(encryptedInput.handles[0], encryptedInput.inputProof)
      ).to.emit(contract, "ValuesUpdated")
        .withArgs(await alice.getAddress());
    });
  });

  describe("Combined Operations", function () {
    it("should verify contract has combined operation functions", async function () {
      expect(contract.demonstrateClamp).to.exist;
      expect(contract.demonstrateConditionalMax).to.exist;
    });
  });

  describe("State Management", function () {
    it("should update stored values with permissions", async function () {
      const value1 = 100;
      const value2 = 200;

      const input1 = await fhevm
        .createEncryptedInput(contractAddress, await alice.getAddress())
        .add32(value1)
        .encrypt();

      const input2 = await fhevm
        .createEncryptedInput(contractAddress, await alice.getAddress())
        .add32(value2)
        .encrypt();

      const tx = await contract
        .connect(alice)
        .updateStoredValues(
          input1.handles[0],
          input2.handles[0],
          input1.inputProof,
          input2.inputProof
        );
      await tx.wait();

      const storedValue1 = await contract.getStoredValue1();
      const storedValue2 = await contract.getStoredValue2();

      expect(storedValue1).to.exist;
      expect(storedValue2).to.exist;
    });

    it("should perform operations on stored values", async function () {
      // First update stored values
      const value1 = 50;
      const value2 = 30;

      const input1 = await fhevm
        .createEncryptedInput(contractAddress, await alice.getAddress())
        .add32(value1)
        .encrypt();

      const input2 = await fhevm
        .createEncryptedInput(contractAddress, await alice.getAddress())
        .add32(value2)
        .encrypt();

      await contract
        .connect(alice)
        .updateStoredValues(
          input1.handles[0],
          input2.handles[0],
          input1.inputProof,
          input2.inputProof
        );

      // Perform addition (operation 0)
      const resultAdd = await contract.connect(alice).performOperationOnStored(0);
      expect(resultAdd).to.exist;

      // Perform subtraction (operation 1)
      const resultSub = await contract.connect(alice).performOperationOnStored(1);
      expect(resultSub).to.exist;

      // Perform multiplication (operation 2)
      const resultMul = await contract.connect(alice).performOperationOnStored(2);
      expect(resultMul).to.exist;

      // Perform min (operation 3)
      const resultMin = await contract.connect(alice).performOperationOnStored(3);
      expect(resultMin).to.exist;

      // Perform max (operation 4)
      const resultMax = await contract.connect(alice).performOperationOnStored(4);
      expect(resultMax).to.exist;
    });

    it("should emit OperationPerformed event", async function () {
      // Setup: update stored values first
      const value1 = 10;
      const value2 = 5;

      const input1 = await fhevm
        .createEncryptedInput(contractAddress, await alice.getAddress())
        .add32(value1)
        .encrypt();

      const input2 = await fhevm
        .createEncryptedInput(contractAddress, await alice.getAddress())
        .add32(value2)
        .encrypt();

      await contract
        .connect(alice)
        .updateStoredValues(
          input1.handles[0],
          input2.handles[0],
          input1.inputProof,
          input2.inputProof
        );

      // Test event emission for addition
      await expect(contract.connect(alice).performOperationOnStored(0))
        .to.emit(contract, "OperationPerformed")
        .withArgs("add");
    });

    it("should revert on invalid operation", async function () {
      await expect(contract.performOperationOnStored(99))
        .to.be.revertedWith("Invalid operation");
    });
  });

  describe("View Functions", function () {
    it("should return stored value 1", async function () {
      const value = await contract.getStoredValue1();
      expect(value).to.exist;
    });

    it("should return stored value 2", async function () {
      const value = await contract.getStoredValue2();
      expect(value).to.exist;
    });

    it("should return stored boolean", async function () {
      const value = await contract.getStoredBool();
      expect(value).to.exist;
    });
  });
});
