// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {FHE, euint32, externalEuint32, ebool} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

/// @title FHE Voting
/// @author ZCraft Examples
/// @notice A confidential voting system where votes and results remain encrypted
/// @dev Demonstrates encrypted boolean operations, vote counting, and the boolean→integer conversion pattern
contract FHEVoting is ZamaEthereumConfig {
    /// @notice Voting session structure with encrypted vote tallies
    struct VotingSession {
        euint32 yesVotes;      // Encrypted count of yes votes
        euint32 noVotes;       // Encrypted count of no votes
        euint32 totalVotes;    // Encrypted total number of votes
        uint64 deadline;       // Plaintext deadline timestamp
        bool isActive;         // Whether voting is currently open
    }

    /// @notice The current voting session
    VotingSession public session;

    /// @notice Owner of the contract (can view results)
    address public owner;

    /// @notice Tracks whether an address has already voted
    mapping(address => bool) public hasVoted;

    /// @notice Emitted when a new voting session is created
    /// @param deadline The deadline for the voting session
    event VotingSessionCreated(uint64 deadline);

    /// @notice Emitted when a user casts a vote
    /// @param voter The address of the voter
    event VoteCast(address indexed voter);

    /// @notice Emitted when voting session ends
    event VotingEnded();

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner can call this");
        _;
    }

    modifier votingActive() {
        require(session.isActive, "Voting is not active");
        require(block.timestamp < session.deadline, "Voting period has ended");
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    /// @notice Creates a new voting session
    /// @param durationInSeconds How long the voting period will last
    /// @dev Can only be called by owner when no active session exists
    function createVotingSession(uint64 durationInSeconds) external onlyOwner {
        require(!session.isActive, "A voting session is already active");
        require(durationInSeconds > 0, "Duration must be positive");

        uint64 deadline = uint64(block.timestamp) + durationInSeconds;

        // Initialize encrypted counters to 0
        session.yesVotes = FHE.asEuint32(0);
        session.noVotes = FHE.asEuint32(0);
        session.totalVotes = FHE.asEuint32(0);
        session.deadline = deadline;
        session.isActive = true;

        // Set permissions for the contract to use these values
        FHE.allowThis(session.yesVotes);
        FHE.allowThis(session.noVotes);
        FHE.allowThis(session.totalVotes);

        emit VotingSessionCreated(deadline);
    }

    /// @notice Cast an encrypted vote (true = yes, false = no)
    /// @param encryptedVote The encrypted boolean vote
    /// @param inputProof The proof for the encrypted input
    /// @dev Uses the boolean→integer conversion trick to update vote counts
    function vote(externalEuint32 encryptedVote, bytes calldata inputProof) external votingActive {
        require(!hasVoted[msg.sender], "Already voted");

        // Convert external encrypted input to internal type
        // Expected to be 0 (no) or 1 (yes)
        euint32 voteValue = FHE.fromExternal(encryptedVote, inputProof);

        // Boolean to integer conversion trick:
        // If vote is 1 (yes): yesIncrement = 1, noIncrement = 1 - 1 = 0
        // If vote is 0 (no):  yesIncrement = 0, noIncrement = 1 - 0 = 1
        euint32 one = FHE.asEuint32(1);
        euint32 yesIncrement = voteValue;                    // 1 if yes, 0 if no
        euint32 noIncrement = FHE.sub(one, voteValue);       // 0 if yes, 1 if no

        // Update vote tallies
        session.yesVotes = FHE.add(session.yesVotes, yesIncrement);
        session.noVotes = FHE.add(session.noVotes, noIncrement);
        session.totalVotes = FHE.add(session.totalVotes, one);

        // Update permissions
        FHE.allowThis(session.yesVotes);
        FHE.allowThis(session.noVotes);
        FHE.allowThis(session.totalVotes);

        // Mark as voted
        hasVoted[msg.sender] = true;

        emit VoteCast(msg.sender);
    }

    /// @notice Ends the current voting session
    /// @dev Can only be called by owner after deadline has passed
    function endVoting() external onlyOwner {
        require(session.isActive, "No active voting session");
        require(block.timestamp >= session.deadline, "Voting period not ended");

        session.isActive = false;

        // Grant owner permission to view results
        FHE.allow(session.yesVotes, owner);
        FHE.allow(session.noVotes, owner);
        FHE.allow(session.totalVotes, owner);

        emit VotingEnded();
    }

    /// @notice Returns the encrypted yes vote count
    /// @return The encrypted yes votes (only owner can decrypt after voting ends)
    function getYesVotes() external view returns (euint32) {
        return session.yesVotes;
    }

    /// @notice Returns the encrypted no vote count
    /// @return The encrypted no votes (only owner can decrypt after voting ends)
    function getNoVotes() external view returns (euint32) {
        return session.noVotes;
    }

    /// @notice Returns the encrypted total vote count
    /// @return The encrypted total votes (only owner can decrypt after voting ends)
    function getTotalVotes() external view returns (euint32) {
        return session.totalVotes;
    }

    /// @notice Returns the voting deadline
    /// @return The deadline timestamp
    function getDeadline() external view returns (uint64) {
        return session.deadline;
    }

    /// @notice Returns whether voting is currently active
    /// @return True if voting is active, false otherwise
    function isVotingActive() external view returns (bool) {
        return session.isActive && block.timestamp < session.deadline;
    }
}
