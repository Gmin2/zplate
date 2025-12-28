import { expect } from "chai";
import { ethers } from "hardhat";

import { createFhevmInstance } from "../utils/instance";
import { getSigners, initSigners } from "./signers";
import { deployFreezableComplianceFixture } from "./FreezableCompliance.fixture";
import type { FreezableCompliance } from "../types";
import type { Signers } from "./signers";

/**
 * @title FreezableCompliance Contract Tests
 * @notice Comprehensive test suite for compliance-enabled confidential tokens with encrypted freeze amounts
 * @dev Tests demonstrate regulatory compliance patterns while maintaining balance privacy through FHE
 *
 * @custom:chapter compliance
 * @custom:chapter defi
 * @custom:chapter privacy
 *
 * This test suite validates a compliance layer for confidential tokens where regulatory authorities
 * can freeze portions of user balances while keeping both frozen amounts and total balances encrypted.
 * Traditional compliance mechanisms expose frozen amounts publicly, revealing sensitive financial
 * information about users under investigation. This creates privacy concerns where merely being frozen
 * signals regulatory action, potentially damaging reputation before any wrongdoing is proven.
 *
 * With FHE-based freezable compliance, the frozen amount remains encrypted. Observers can verify that
 * compliance mechanisms exist and that transfers respect frozen status, but they cannot determine how
 * much is frozen or even definitively whether a specific address is frozen. The user can decrypt their
 * own frozen amount to understand their available balance, while regulators with appropriate permissions
 * can verify compliance without exposing details publicly.
 *
 * The test architecture separates deployment concerns in the fixture from business logic validation in
 * the test specs. Each test focuses on a specific compliance scenario, documenting the expected behavior
 * and common pitfalls. The fixture establishes alice as the compliance authority, while bob and carol
 * represent regular users subject to compliance controls.
 *
 * Key testing patterns include:
 * - Authority role validation ensures only compliance authority can freeze/unfreeze
 * - Encrypted arithmetic validation confirms available balance calculations (total - frozen)
 * - Transfer capping validates that transfers cannot exceed available balance using FHE select
 * - Privacy guarantees verify frozen amounts remain encrypted and events don't leak sensitive data
 * - Permission grants ensure users can decrypt their own balances while maintaining privacy from others
 *
 * The mechanism works through encrypted balance partitioning. Each address has a total balance (encrypted)
 * and a frozen balance (encrypted). The available balance for transfers is calculated as total minus frozen
 * using FHE subtraction. When someone attempts a transfer, the contract checks that the transfer amount
 * doesn't exceed available balance. If it does, the transfer amount gets reduced to zero using encrypted
 * select operations, preventing any transfer of frozen funds.
 *
 * Compliance authorities submit encrypted freeze amounts through the standard FHE input pattern with proofs.
 * The contract stores this encrypted value as the frozen balance and emits an event. The event intentionally
 * omits the frozen amount to preserve privacy, including only the affected address and timestamp. This
 * demonstrates how regulatory compliance and financial privacy can coexist through careful system design.
 *
 * @custom:pitfall Freezing more than a user's total balance makes their entire balance unavailable but
 * doesn't revert. The available balance calculation (total - frozen) can underflow if frozen exceeds total,
 * requiring careful FHE arithmetic handling.
 *
 * @custom:pitfall Direct comparison of frozen amounts and balances is impossible without FHE operations.
 * All comparisons must use FHE.lte, FHE.gte, or other encrypted comparison operations.
 *
 * @custom:pitfall Missing permission grants for frozen amounts prevents users from seeing their available
 * balance. Must call FHE.allow for both the user and the compliance authority on frozen balances.
 *
 * @custom:pitfall Emitting frozen amounts in events defeats the privacy purpose by revealing sensitive
 * compliance information. Events should only include addresses and timestamps, never encrypted values.
 */
describe("FreezableCompliance", function () {
  before(async function () {
    await initSigners();
    this.signers = await getSigners();
    this.fhevm = await createFhevmInstance();
  });

  beforeEach(async function () {
    const deployment = await deployFreezableComplianceFixture();
    this.contract = deployment.contract;
    this.contractAddress = await this.contract.getAddress();
    this.complianceAuthority = deployment.complianceAuthority;

    // Initialize balances for testing
    await this.contract.connect(this.signers.bob).initializeBalance(1000);
    await this.contract.connect(this.signers.carol).initializeBalance(2000);
  });

  /**
   * @notice Validates constructor properly sets compliance authority
   * @dev Constructor must reject zero address and store authority as immutable
   *
   * @custom:chapter compliance
   *
   * The compliance authority is the only address with permission to freeze and unfreeze user balances.
   * This role is set at construction time and cannot be changed, providing certainty about who controls
   * compliance actions. The immutability prevents authority transfer that could be exploited.
   *
   * Constructor must validate that authority address is not zero, preventing deployment with invalid
   * configuration. A zero address authority would make freeze/unfreeze operations impossible since
   * no one could satisfy the authority check.
   *
   * @custom:pitfall Allowing zero address as authority would create an unusable compliance system where
   * freeze operations always fail.
   */
  describe("Deployment", function () {
    it("should set compliance authority correctly", async function () {
      expect(await this.contract.complianceAuthority()).to.equal(this.signers.alice.address);
    });

    it("should reject zero address as compliance authority", async function () {
      const contractFactory = await ethers.getContractFactory("FreezableCompliance");
      await expect(contractFactory.deploy(ethers.ZeroAddress)).to.be.revertedWith("Invalid authority");
    });
  });

  /**
   * @notice Validates freeze functionality and permission controls
   * @dev Only compliance authority can freeze balances with encrypted amounts
   *
   * @custom:chapter compliance
   * @custom:chapter privacy
   *
   * Freeze operations allow the compliance authority to restrict portions of user balances. The frozen
   * amount is submitted as an encrypted value with a zero-knowledge proof binding it to the contract
   * and sender. The contract stores this encrypted value without ever seeing the plaintext amount.
   *
   * The freeze function must verify caller is the compliance authority, preventing unauthorized freezes.
   * It must validate the account address is not zero to prevent misconfiguration. After storing the
   * encrypted frozen amount, it grants permissions allowing the contract, the user, and the authority
   * to perform operations on the encrypted value.
   *
   * Events emitted during freezing intentionally omit the frozen amount to preserve privacy. Only the
   * affected address and timestamp are included, allowing observers to see that a freeze occurred
   * without revealing how much was frozen. This prevents reputation damage from publicly visible
   * compliance actions while still maintaining transparency about the existence of controls.
   *
   * @custom:example Encrypting and submitting a freeze amount:
   * ```typescript
   * const input = await fhevm.createEncryptedInput(contractAddress, authorityAddress)
   *   .add64(500)
   *   .encrypt();
   * await contract.connect(authority).freeze(userAddress, input.handles[0], input.inputProof);
   * ```
   *
   * @custom:pitfall Not granting permissions to both the user and authority prevents decryption of
   * frozen amounts for verification purposes.
   */
  describe("Freeze Operations", function () {
    it("should allow compliance authority to freeze balances", async function () {
      const input = await this.fhevm
        .createEncryptedInput(this.contractAddress, this.signers.alice.address)
        .add64(500)
        .encrypt();

      const tx = await this.contract
        .connect(this.signers.alice)
        .freeze(this.signers.bob.address, input.handles[0], input.inputProof);

      await expect(tx).to.emit(this.contract, "TokensFrozen").withArgs(this.signers.bob.address, await ethers.provider.getBlock("latest").then(b => b!.timestamp));
    });

    it("should reject freeze from non-authority", async function () {
      const input = await this.fhevm
        .createEncryptedInput(this.contractAddress, this.signers.bob.address)
        .add64(500)
        .encrypt();

      await expect(
        this.contract.connect(this.signers.bob).freeze(this.signers.carol.address, input.handles[0], input.inputProof)
      ).to.be.revertedWith("Only authority");
    });

    it("should reject freeze of zero address", async function () {
      const input = await this.fhevm
        .createEncryptedInput(this.contractAddress, this.signers.alice.address)
        .add64(500)
        .encrypt();

      await expect(
        this.contract.connect(this.signers.alice).freeze(ethers.ZeroAddress, input.handles[0], input.inputProof)
      ).to.be.revertedWith("Invalid account");
    });

    it("should store encrypted frozen amount", async function () {
      const input = await this.fhevm
        .createEncryptedInput(this.contractAddress, this.signers.alice.address)
        .add64(500)
        .encrypt();

      await this.contract
        .connect(this.signers.alice)
        .freeze(this.signers.bob.address, input.handles[0], input.inputProof);

      const frozenHandle = await this.contract.connect(this.signers.bob).getFrozenBalance();
      const frozenAmount = await this.fhevm.userDecryptEuint(
        frozenHandle,
        this.contractAddress,
        this.signers.bob.address
      );

      expect(frozenAmount).to.equal(500);
    });

    it("should keep frozen amount encrypted from observers", async function () {
      const input = await this.fhevm
        .createEncryptedInput(this.contractAddress, this.signers.alice.address)
        .add64(500)
        .encrypt();

      await this.contract
        .connect(this.signers.alice)
        .freeze(this.signers.bob.address, input.handles[0], input.inputProof);

      const frozenHandle = await this.contract.connect(this.signers.bob).getFrozenBalance();

      // Handle should exist but value should not be publicly readable
      expect(frozenHandle).to.not.equal(0n);
    });

    it("should allow updating frozen amount", async function () {
      // Initial freeze
      const input1 = await this.fhevm
        .createEncryptedInput(this.contractAddress, this.signers.alice.address)
        .add64(500)
        .encrypt();

      await this.contract
        .connect(this.signers.alice)
        .freeze(this.signers.bob.address, input1.handles[0], input1.inputProof);

      // Update freeze
      const input2 = await this.fhevm
        .createEncryptedInput(this.contractAddress, this.signers.alice.address)
        .add64(300)
        .encrypt();

      await this.contract
        .connect(this.signers.alice)
        .freeze(this.signers.bob.address, input2.handles[0], input2.inputProof);

      const frozenHandle = await this.contract.connect(this.signers.bob).getFrozenBalance();
      const frozenAmount = await this.fhevm.userDecryptEuint(
        frozenHandle,
        this.contractAddress,
        this.signers.bob.address
      );

      expect(frozenAmount).to.equal(300);
    });
  });

  /**
   * @notice Validates unfreeze functionality and permission controls
   * @dev Only compliance authority can unfreeze by setting frozen amount to encrypted zero
   *
   * @custom:chapter compliance
   *
   * Unfreeze operations remove compliance restrictions by setting the frozen amount to encrypted zero.
   * After unfreezing, the user regains full access to their balance since available balance calculation
   * (total - frozen) will equal their total balance when frozen is zero.
   *
   * Like freeze operations, unfreeze must verify caller is the compliance authority. The function sets
   * frozen balance to FHE.asEuint64(0), creating an encrypted zero value. This maintains the invariant
   * that frozen amounts are always encrypted, even when zero.
   *
   * @custom:pitfall Setting frozen balance to a plaintext 0 instead of encrypted zero breaks the FHE
   * invariant and causes arithmetic operations to fail.
   */
  describe("Unfreeze Operations", function () {
    beforeEach(async function () {
      const input = await this.fhevm
        .createEncryptedInput(this.contractAddress, this.signers.alice.address)
        .add64(500)
        .encrypt();

      await this.contract
        .connect(this.signers.alice)
        .freeze(this.signers.bob.address, input.handles[0], input.inputProof);
    });

    it("should allow compliance authority to unfreeze balances", async function () {
      const tx = await this.contract.connect(this.signers.alice).unfreeze(this.signers.bob.address);

      await expect(tx).to.emit(this.contract, "TokensUnfrozen");
    });

    it("should reject unfreeze from non-authority", async function () {
      await expect(
        this.contract.connect(this.signers.bob).unfreeze(this.signers.bob.address)
      ).to.be.revertedWith("Only authority");
    });

    it("should set frozen amount to zero after unfreeze", async function () {
      await this.contract.connect(this.signers.alice).unfreeze(this.signers.bob.address);

      const frozenHandle = await this.contract.connect(this.signers.bob).getFrozenBalance();
      const frozenAmount = await this.fhevm.userDecryptEuint(
        frozenHandle,
        this.contractAddress,
        this.signers.bob.address
      );

      expect(frozenAmount).to.equal(0);
    });

    it("should restore full balance access after unfreeze", async function () {
      await this.contract.connect(this.signers.alice).unfreeze(this.signers.bob.address);

      const availableHandle = await this.contract.connect(this.signers.bob).getAvailableBalance();
      const availableAmount = await this.fhevm.userDecryptEuint(
        availableHandle,
        this.contractAddress,
        this.signers.bob.address
      );

      expect(availableAmount).to.equal(1000);
    });
  });

  /**
   * @notice Validates transfer operations respect frozen balances
   * @dev Transfers automatically cap at available balance using encrypted select operations
   *
   * @custom:chapter compliance
   * @custom:chapter defi
   *
   * Transfer operations respect frozen balances by calculating available balance (total - frozen) and
   * capping the transfer amount at available. This happens entirely on encrypted values using FHE
   * comparison and select operations, preventing any transfer of frozen funds while maintaining privacy.
   *
   * The mechanism checks if the requested transfer amount is less than or equal to available balance
   * using FHE.lte. If valid, the actual transfer amount equals the requested amount. If invalid (trying
   * to transfer more than available), the actual amount is set to encrypted zero using FHE.select,
   * preventing any transfer without revealing the frozen amount.
   *
   * This approach ensures compliance without explicit reverts. A user attempting to transfer frozen
   * funds doesn't get an error message revealing they're frozen. Instead, the transfer silently caps
   * at available balance, maintaining privacy about compliance status.
   *
   * @custom:example Transfer with frozen balance:
   * ```typescript
   * // User has balance=1000, frozen=500, available=500
   * // Attempting to transfer 600 will result in 0 transfer
   * const input = await fhevm.createEncryptedInput(contractAddress, userAddress)
   *   .add64(600)
   *   .encrypt();
   * await contract.transfer(recipientAddress, input.handles[0], input.inputProof);
   * // Balance remains 1000, recipient receives 0
   * ```
   *
   * @custom:pitfall Using FHE.gt instead of FHE.lte for the validity check would reverse the logic,
   * only allowing transfers that exceed available balance.
   *
   * @custom:pitfall Not initializing frozen balance to encrypted zero for new addresses causes FHE
   * arithmetic to fail when calculating available balance.
   */
  describe("Transfer Operations", function () {
    it("should allow transfers within available balance", async function () {
      // Freeze 500 of bob's 1000 balance
      const freezeInput = await this.fhevm
        .createEncryptedInput(this.contractAddress, this.signers.alice.address)
        .add64(500)
        .encrypt();

      await this.contract
        .connect(this.signers.alice)
        .freeze(this.signers.bob.address, freezeInput.handles[0], freezeInput.inputProof);

      // Transfer 300 (within available 500)
      const transferInput = await this.fhevm
        .createEncryptedInput(this.contractAddress, this.signers.bob.address)
        .add64(300)
        .encrypt();

      await this.contract
        .connect(this.signers.bob)
        .transfer(this.signers.carol.address, transferInput.handles[0], transferInput.inputProof);

      const bobBalanceHandle = await this.contract.connect(this.signers.bob).getBalance();
      const bobBalance = await this.fhevm.userDecryptEuint(
        bobBalanceHandle,
        this.contractAddress,
        this.signers.bob.address
      );

      expect(bobBalance).to.equal(700);
    });

    it("should prevent transfers exceeding available balance", async function () {
      // Freeze 500 of bob's 1000 balance
      const freezeInput = await this.fhevm
        .createEncryptedInput(this.contractAddress, this.signers.alice.address)
        .add64(500)
        .encrypt();

      await this.contract
        .connect(this.signers.alice)
        .freeze(this.signers.bob.address, freezeInput.handles[0], freezeInput.inputProof);

      // Attempt to transfer 600 (exceeds available 500)
      const transferInput = await this.fhevm
        .createEncryptedInput(this.contractAddress, this.signers.bob.address)
        .add64(600)
        .encrypt();

      await this.contract
        .connect(this.signers.bob)
        .transfer(this.signers.carol.address, transferInput.handles[0], transferInput.inputProof);

      const bobBalanceHandle = await this.contract.connect(this.signers.bob).getBalance();
      const bobBalance = await this.fhevm.userDecryptEuint(
        bobBalanceHandle,
        this.contractAddress,
        this.signers.bob.address
      );

      // Balance should remain 1000 since transfer was capped to 0
      expect(bobBalance).to.equal(1000);
    });

    it("should calculate available balance correctly", async function () {
      // Freeze 700 of bob's 1000 balance
      const freezeInput = await this.fhevm
        .createEncryptedInput(this.contractAddress, this.signers.alice.address)
        .add64(700)
        .encrypt();

      await this.contract
        .connect(this.signers.alice)
        .freeze(this.signers.bob.address, freezeInput.handles[0], freezeInput.inputProof);

      const availableHandle = await this.contract.connect(this.signers.bob).getAvailableBalance();
      const availableAmount = await this.fhevm.userDecryptEuint(
        availableHandle,
        this.contractAddress,
        this.signers.bob.address
      );

      expect(availableAmount).to.equal(300);
    });

    it("should allow full balance transfer when not frozen", async function () {
      const transferInput = await this.fhevm
        .createEncryptedInput(this.contractAddress, this.signers.bob.address)
        .add64(1000)
        .encrypt();

      await this.contract
        .connect(this.signers.bob)
        .transfer(this.signers.carol.address, transferInput.handles[0], transferInput.inputProof);

      const bobBalanceHandle = await this.contract.connect(this.signers.bob).getBalance();
      const bobBalance = await this.fhevm.userDecryptEuint(
        bobBalanceHandle,
        this.contractAddress,
        this.signers.bob.address
      );

      expect(bobBalance).to.equal(0);
    });

    it("should emit transfer event without revealing amounts", async function () {
      const transferInput = await this.fhevm
        .createEncryptedInput(this.contractAddress, this.signers.bob.address)
        .add64(100)
        .encrypt();

      const tx = await this.contract
        .connect(this.signers.bob)
        .transfer(this.signers.carol.address, transferInput.handles[0], transferInput.inputProof);

      await expect(tx).to.emit(this.contract, "Transfer");
    });
  });

  /**
   * @notice Validates balance query functions
   * @dev Users can query total, frozen, and available balances as encrypted values
   *
   * @custom:chapter privacy
   *
   * Balance query functions return encrypted handles that users can decrypt client-side to see their
   * plaintext values. The contract provides three query functions: getBalance (total), getFrozenBalance
   * (frozen amount), and getAvailableBalance (calculated as total - frozen).
   *
   * All queries return encrypted values, never plaintext. This maintains privacy guarantees where
   * observers cannot determine user balances by watching transaction responses. Only the user with
   * proper permissions can decrypt their own values.
   *
   * @custom:pitfall Returning plaintext values from these functions would expose all user balances
   * publicly, defeating the confidentiality purpose.
   */
  describe("Balance Queries", function () {
    it("should return encrypted total balance", async function () {
      const balanceHandle = await this.contract.connect(this.signers.bob).getBalance();
      const balance = await this.fhevm.userDecryptEuint(
        balanceHandle,
        this.contractAddress,
        this.signers.bob.address
      );

      expect(balance).to.equal(1000);
    });

    it("should return encrypted frozen balance", async function () {
      const freezeInput = await this.fhevm
        .createEncryptedInput(this.contractAddress, this.signers.alice.address)
        .add64(400)
        .encrypt();

      await this.contract
        .connect(this.signers.alice)
        .freeze(this.signers.bob.address, freezeInput.handles[0], freezeInput.inputProof);

      const frozenHandle = await this.contract.connect(this.signers.bob).getFrozenBalance();
      const frozen = await this.fhevm.userDecryptEuint(
        frozenHandle,
        this.contractAddress,
        this.signers.bob.address
      );

      expect(frozen).to.equal(400);
    });

    it("should return encrypted available balance", async function () {
      const freezeInput = await this.fhevm
        .createEncryptedInput(this.contractAddress, this.signers.alice.address)
        .add64(600)
        .encrypt();

      await this.contract
        .connect(this.signers.alice)
        .freeze(this.signers.bob.address, freezeInput.handles[0], freezeInput.inputProof);

      const availableHandle = await this.contract.connect(this.signers.bob).getAvailableBalance();
      const available = await this.fhevm.userDecryptEuint(
        availableHandle,
        this.contractAddress,
        this.signers.bob.address
      );

      expect(available).to.equal(400);
    });
  });

  /**
   * @notice Validates edge cases and boundary conditions
   * @dev Tests unusual scenarios like freezing entire balance or freezing zero address
   *
   * @custom:chapter compliance
   *
   * Edge case testing validates behavior under unusual but valid conditions. These tests ensure the
   * contract handles extreme inputs gracefully without reverting unexpectedly or exposing security
   * vulnerabilities.
   *
   * Key edge cases include freezing the entire balance (making available = 0), freezing more than
   * the balance (which would cause underflow in plaintext but FHE handles gracefully), and interactions
   * between multiple freeze/unfreeze operations.
   */
  describe("Edge Cases", function () {
    it("should handle freezing entire balance", async function () {
      const freezeInput = await this.fhevm
        .createEncryptedInput(this.contractAddress, this.signers.alice.address)
        .add64(1000)
        .encrypt();

      await this.contract
        .connect(this.signers.alice)
        .freeze(this.signers.bob.address, freezeInput.handles[0], freezeInput.inputProof);

      const availableHandle = await this.contract.connect(this.signers.bob).getAvailableBalance();
      const available = await this.fhevm.userDecryptEuint(
        availableHandle,
        this.contractAddress,
        this.signers.bob.address
      );

      expect(available).to.equal(0);
    });

    it("should handle zero frozen amount", async function () {
      const freezeInput = await this.fhevm
        .createEncryptedInput(this.contractAddress, this.signers.alice.address)
        .add64(0)
        .encrypt();

      await this.contract
        .connect(this.signers.alice)
        .freeze(this.signers.bob.address, freezeInput.handles[0], freezeInput.inputProof);

      const availableHandle = await this.contract.connect(this.signers.bob).getAvailableBalance();
      const available = await this.fhevm.userDecryptEuint(
        availableHandle,
        this.contractAddress,
        this.signers.bob.address
      );

      expect(available).to.equal(1000);
    });

    it("should handle transfer to zero address validation", async function () {
      const transferInput = await this.fhevm
        .createEncryptedInput(this.contractAddress, this.signers.bob.address)
        .add64(100)
        .encrypt();

      await expect(
        this.contract
          .connect(this.signers.bob)
          .transfer(ethers.ZeroAddress, transferInput.handles[0], transferInput.inputProof)
      ).to.be.revertedWith("Invalid recipient");
    });
  });
});
