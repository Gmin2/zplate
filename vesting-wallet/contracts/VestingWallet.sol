// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {FHE, euint64, externalEuint64} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

/**
 * @title VestingWallet
 * @notice Time-locked confidential token vesting with linear release schedules
 * @dev Demonstrates encrypted token vesting for team allocations, investor lockups, and grants
 *
 * @custom:security-contact security@example.com
 * @custom:chapter vesting
 * @custom:chapter time-lock
 * @custom:chapter defi
 *
 * This contract implements a vesting system where token allocations remain completely private through
 * encryption. Traditional vesting contracts expose all allocation amounts on-chain, allowing competitors
 * to analyze team equity distribution, investor positions, and employee compensation. This creates privacy
 * concerns and potential competitive disadvantages.
 *
 * With FHE-based vesting, the total amount being vested is encrypted and only the beneficiary can decrypt
 * their allocation details. Observers see that a vesting schedule exists and can see the time parameters,
 * but cannot determine how many tokens are involved. This is particularly valuable for team token allocations
 * where you want to maintain privacy around individual equity grants, investor lockups where the allocation
 * size might signal strategic information to the market, employee compensation where salary information should
 * remain private, and grant programs where distribution sizes might influence behavior.
 *
 * The core mechanism works through a cliff period followed by linear vesting. During the cliff, no tokens
 * are released. This ensures recipients have some commitment period before receiving any tokens. After the
 * cliff ends, tokens release linearly based on elapsed time. For example, if 100,000 tokens vest over
 * four years with a one-year cliff, then at the one-year mark, 25,000 tokens become available. At the
 * two-year mark, 50,000 total tokens are available, and so on until all tokens are fully vested.
 *
 * All calculations happen on encrypted values. The total amount is encrypted, the claimed amount tracking
 * is encrypted, and the available balance is encrypted. When a beneficiary wants to know their status,
 * they decrypt the values client-side. The contract itself never sees plaintext amounts during execution.
 *
 * This is a demonstration contract for educational purposes. Production use requires integration with
 * actual confidential ERC20 token contracts rather than the mock balance system shown here. You would
 * also want batch creation of vesting schedules for gas efficiency when onboarding many employees,
 * revocation mechanisms for terminated employees, emergency pause functionality for security incidents,
 * and multi-signature requirements for creating high-value vesting schedules.
 *
 * Common mistakes developers make include setting a cliff duration that exceeds the total duration,
 * which would mean tokens never vest. Another pitfall is attempting to claim tokens before the cliff
 * period ends, which will revert. Developers also sometimes forget to grant FHE decryption permissions
 * to the beneficiary, preventing them from seeing their vesting details. Time calculations must be in
 * seconds not days or months, so a one-year cliff is 31,536,000 seconds not 365. Integer division in
 * the vesting calculation truncates fractional tokens, so beneficiaries lose small amounts due to
 * rounding. Finally, edge cases like zero-amount vestings need proper validation.
 */
contract VestingWallet is ZamaEthereumConfig {
    /**
     * @notice Vesting schedule structure
     * @dev All token amounts are encrypted for privacy
     *
     * The structure separates public timing information from private allocation details. Anyone can see
     * when a vesting schedule starts and how long it runs, providing transparency about the time-lock
     * mechanism. However, the actual token amounts involved remain encrypted. The beneficiary field is
     * public so you can verify who owns each schedule, but the totalAmount and claimed fields are
     * encrypted euint64 values that only the beneficiary can decrypt using their private key.
     */
    struct VestingSchedule {
        address beneficiary;
        euint64 totalAmount;
        uint256 startTime;
        uint256 cliffDuration;
        uint256 duration;
        euint64 claimed;
    }

    mapping(uint256 => VestingSchedule) public vestingSchedules;
    uint256 public nextScheduleId;
    mapping(address => euint64) private _balances;

    /**
     * @notice Emitted when new vesting schedule is created
     *
     * The total amount is intentionally omitted from the event because it is encrypted. Emitting
     * encrypted values in events would leak information through transaction analysis. Instead, the
     * beneficiary can query the contract directly and decrypt their allocation client-side.
     */
    event VestingScheduleCreated(
        uint256 indexed scheduleId,
        address indexed beneficiary,
        uint256 startTime,
        uint256 cliffDuration,
        uint256 duration
    );

    /**
     * @notice Emitted when tokens are claimed from vesting
     *
     * Similar to the creation event, we don't include the claimed amount because it is encrypted.
     * The timestamp provides transparency about when claims occur without revealing how much was claimed.
     */
    event TokensClaimed(uint256 indexed scheduleId, address indexed beneficiary, uint256 timestamp);

    /**
     * @notice Create a new vesting schedule with encrypted total amount
     * @dev Linear vesting after cliff period
     *
     * @custom:chapter vesting
     * @custom:chapter time-lock
     *
     * Creates a time-locked vesting schedule where the total token amount remains encrypted. The schedule
     * consists of a cliff period where no tokens vest, followed by linear vesting over the remaining duration.
     * Only the beneficiary can decrypt their allocation amount using their private key.
     */
    function createVestingSchedule(
        address beneficiary,
        externalEuint64 inputEuint64,
        bytes calldata inputProof,
        uint256 cliffDuration,
        uint256 duration
    ) external returns (uint256) {
        // Validate beneficiary exists (zero address would lock tokens forever)
        require(beneficiary != address(0), "Invalid beneficiary");

        // Duration must be positive (zero-duration vesting makes no sense)
        require(duration > 0, "Invalid duration");

        // Cliff cannot exceed total duration (tokens would never vest)
        require(cliffDuration <= duration, "Cliff exceeds duration");

        // Convert external encrypted input to internal type and validate proof
        // This cryptographically verifies the encrypted value is bound to this contract and sender
        euint64 totalAmount = FHE.fromExternal(inputEuint64, inputProof);

        // Assign unique ID for this vesting schedule
        uint256 scheduleId = nextScheduleId++;

        // Initialize claimed amount as encrypted zero
        euint64 zeroClaimed = FHE.asEuint64(0);

        // Store the vesting schedule with public time params and encrypted amounts
        vestingSchedules[scheduleId] = VestingSchedule({
            beneficiary: beneficiary,
            totalAmount: totalAmount,        // Encrypted - only beneficiary can decrypt
            startTime: block.timestamp,      // Public - anyone can see when vesting starts
            cliffDuration: cliffDuration,    // Public - anyone can see cliff duration
            duration: duration,              // Public - anyone can see total vesting period
            claimed: zeroClaimed             // Encrypted - tracks claimed tokens privately
        });

        // Grant contract permission to perform operations on encrypted values
        FHE.allowThis(totalAmount);
        FHE.allowThis(zeroClaimed);

        // Grant beneficiary permission to decrypt these values client-side
        FHE.allow(totalAmount, beneficiary);
        FHE.allow(zeroClaimed, beneficiary);

        emit VestingScheduleCreated(scheduleId, beneficiary, block.timestamp, cliffDuration, duration);
        return scheduleId;
    }

    /**
     * @notice Claim vested tokens from schedule
     * @dev Calculates vested amount, subtracts claimed, transfers remainder
     *
     * @custom:chapter vesting
     * @custom:chapter time-lock
     *
     * Allows the beneficiary to claim tokens that have vested according to the linear schedule.
     * All calculations happen on encrypted values to maintain privacy of token amounts.
     */
    function claimVestedTokens(uint256 scheduleId) external {
        VestingSchedule storage schedule = vestingSchedules[scheduleId];

        // Only the beneficiary can claim their tokens
        require(msg.sender == schedule.beneficiary, "Not beneficiary");

        // Cliff period must have passed before any tokens can be claimed
        // If cliff is 1 year and we're at 11 months, this will revert
        require(block.timestamp >= schedule.startTime + schedule.cliffDuration, "Cliff not reached");

        // Calculate how many tokens have vested so far using linear formula
        euint64 vestedAmount = _calculateVestedAmount(schedule);

        // Subtract what's already been claimed to get new claimable amount
        // Uses encrypted subtraction to keep amounts private
        euint64 claimableAmount = FHE.sub(vestedAmount, schedule.claimed);

        // Update claimed counter (encrypted addition)
        schedule.claimed = FHE.add(schedule.claimed, claimableAmount);

        // Transfer tokens to beneficiary's balance (in production this would be ERC20 transfer)
        _balances[msg.sender] = FHE.add(_balances[msg.sender], claimableAmount);

        // Grant permissions so beneficiary can decrypt updated values
        FHE.allowThis(schedule.claimed);
        FHE.allow(schedule.claimed, msg.sender);
        FHE.allowThis(_balances[msg.sender]);
        FHE.allow(_balances[msg.sender], msg.sender);

        emit TokensClaimed(scheduleId, msg.sender, block.timestamp);
    }

    /**
     * @notice Calculate vested amount for a schedule
     * @dev Uses encrypted arithmetic for privacy-preserving calculation
     *
     * @custom:chapter vesting
     *
     * Calculates how many tokens have vested based on elapsed time using linear vesting formula:
     * vested = totalAmount * elapsed / duration. All calculations happen on encrypted values.
     */
    function _calculateVestedAmount(VestingSchedule storage schedule) internal returns (euint64) {
        // Calculate time elapsed since vesting started
        uint256 elapsed = block.timestamp - schedule.startTime;

        // If vesting period is complete, all tokens are vested
        if (elapsed >= schedule.duration) {
            return schedule.totalAmount;
        }

        // Linear vesting formula: vested = totalAmount * elapsed / duration
        // Example: 100k tokens, 2 years elapsed, 4 year duration = 100k * 2 / 4 = 50k vested

        // Convert elapsed time to encrypted type
        euint64 elapsedEnc = FHE.asEuint64(uint64(elapsed));

        // Multiply encrypted totalAmount by elapsed time
        euint64 numerator = FHE.mul(schedule.totalAmount, elapsedEnc);

        // Divide by duration (plaintext) to get proportional vested amount
        // FHE.div requires plaintext divisor - duration is public so we use it directly
        // Note: Integer division truncates, so fractional tokens are lost to rounding
        euint64 vested = FHE.div(numerator, uint64(schedule.duration));

        return vested;
    }

    /**
     * @notice Get caller's encrypted token balance
     * @dev Beneficiary must decrypt client-side using fhevm.userDecryptEuint64
     */
    function getBalance() external view returns (euint64) {
        return _balances[msg.sender];
    }

    /**
     * @notice Get total amount for a vesting schedule
     * @dev Returns encrypted value - beneficiary can decrypt to see their allocation
     */
    function getTotalAmount(uint256 scheduleId) external view returns (euint64) {
        return vestingSchedules[scheduleId].totalAmount;
    }

    /**
     * @notice Get claimed amount for a vesting schedule
     * @dev Returns encrypted value - beneficiary can decrypt to track claimed tokens
     */
    function getClaimedAmount(uint256 scheduleId) external view returns (euint64) {
        return vestingSchedules[scheduleId].claimed;
    }

    /**
     * @notice Get public schedule details (time parameters only)
     * @dev Returns unencrypted timing info - amounts remain private
     */
    function getSchedule(
        uint256 scheduleId
    ) external view returns (address beneficiary, uint256 startTime, uint256 cliffDuration, uint256 duration) {
        VestingSchedule storage schedule = vestingSchedules[scheduleId];
        return (schedule.beneficiary, schedule.startTime, schedule.cliffDuration, schedule.duration);
    }

    /**
     * @notice Initialize balance for testing
     * @dev Demo function - production would integrate with confidential ERC20
     */
    function initializeBalance(uint64 amount) external {
        // Convert plaintext amount to encrypted type
        euint64 encAmount = FHE.asEuint64(amount);
        _balances[msg.sender] = encAmount;

        // Grant permissions for operations and decryption
        FHE.allowThis(encAmount);
        FHE.allow(encAmount, msg.sender);
    }
}
