// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {FHE, euint32, ebool, externalEbool} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

/**
 * @title ConfidentialVoting
 * @notice DAO proposal voting with encrypted vote counts
 * @dev Demonstrates private voting where individual votes and tallies remain confidential
 *
 * @custom:security-contact security@example.com
 * @custom:chapter voting
 * @custom:chapter governance
 * @custom:chapter privacy
 *
 * This contract implements confidential voting for DAO governance where votes and vote counts remain
 * encrypted throughout the voting process. Traditional on-chain voting exposes every vote publicly,
 * allowing anyone to see how each address voted and track voting patterns in real time. This creates
 * several problems for DAOs and governance systems.
 *
 * Public voting enables vote buying and coercion. If someone can verify how you voted, they can
 * pay you to vote a certain way or threaten consequences for voting against their interests. Voters
 * cannot safely vote their conscience when votes are transparent. Large token holders face pressure
 * when their voting positions become public knowledge. Political coalitions can track defections and
 * punish members who vote differently than the group.
 *
 * Transparent vote tallies also create bandwagon effects and strategic voting. When voters see early
 * results, they may change their vote to join the winning side rather than voting their true preference.
 * Proposals that appear to be losing may see reduced participation as voters assume their vote won't
 * matter. This reduces the legitimacy of outcomes and prevents true preference revelation.
 *
 * With FHE-based confidential voting, individual votes are encrypted and the running vote tally is
 * also encrypted. Voters submit encrypted true/false values representing their yes or no position.
 * The contract increments encrypted counters without ever seeing plaintext votes. Only after voting
 * closes can the final tally be revealed through a decryption process, preventing real-time tracking
 * of voting trends.
 *
 * The mechanism works through clever encrypted arithmetic. When a voter submits an encrypted boolean
 * (true for yes, false for no), the contract converts this to an encrypted integer where true becomes
 * 1 and false becomes 0. The yes counter increments by the vote value (1 if yes, 0 if no). The no
 * counter increments by (1 - vote value), which is 0 if yes and 1 if no. This arithmetic on encrypted
 * values allows counting without revealing individual votes.
 *
 * Time windows control when voting is active. Each proposal has a voting period defined by start and
 * end times. During this window, eligible voters can submit their encrypted votes once. After the
 * period ends, voting closes and results can be revealed. This ensures fair participation and prevents
 * manipulation through timing.
 *
 * This is a demonstration contract for educational purposes. Production DAO governance requires
 * token-weighted voting where vote power is proportional to token holdings rather than one-address-one-vote.
 * You would need delegation mechanisms allowing token holders to delegate voting power to representatives.
 * Quadratic voting could reduce plutocratic outcomes by making vote costs increase quadratically. Multi-sig
 * requirements for proposal creation prevent spam. Execution mechanisms automatically implement passing
 * proposals on-chain rather than requiring manual execution.
 *
 * Common mistakes include allowing users to vote multiple times by not tracking who has voted. Another
 * pitfall is revealing votes or tallies before voting closes, which enables strategic voting. Developers
 * sometimes forget that boolean to integer conversion requires specific arithmetic operations in FHE.
 * The contract must carefully grant permissions to encrypted values or operations will fail. Finally,
 * without proper access control, anyone could create proposals or end voting sessions prematurely.
 */
contract ConfidentialVoting is ZamaEthereumConfig {
    /**
     * @notice Proposal structure
     * @dev Vote counts are encrypted, timing and status are public
     */
    struct Proposal {
        string title;
        string description;
        uint256 startTime;
        uint256 endTime;
        euint32 yesVotes;
        euint32 noVotes;
        bool isActive;
        address creator;
    }

    /**
     * @notice Proposal storage
     */
    mapping(uint256 => Proposal) public proposals;

    /**
     * @notice Tracks who has voted on each proposal
     * @dev Prevents double voting
     */
    mapping(uint256 => mapping(address => bool)) public hasVoted;

    /**
     * @notice Next proposal ID
     */
    uint256 public nextProposalId;

    /**
     * @notice Emitted when a proposal is created
     */
    event ProposalCreated(
        uint256 indexed proposalId,
        string title,
        address indexed creator,
        uint256 startTime,
        uint256 endTime
    );

    /**
     * @notice Emitted when a vote is cast
     * @dev Vote value is intentionally omitted to preserve privacy
     */
    event VoteCast(uint256 indexed proposalId, address indexed voter);

    /**
     * @notice Emitted when voting ends
     */
    event VotingEnded(uint256 indexed proposalId);

    /**
     * @notice Create a new proposal with voting period
     * @dev Initializes encrypted vote counters at zero
     *
     * @custom:chapter voting
     * @custom:chapter governance
     *
     * Creates a governance proposal with an encrypted vote tally system. The vote counts start
     * at encrypted zero and increment as votes come in, keeping running totals private until
     * the voting period ends.
     */
    function createProposal(string memory title, string memory description, uint256 duration) external returns (uint256) {
        require(duration > 0, "Invalid duration");

        uint256 proposalId = nextProposalId++;

        // Initialize encrypted vote counters at zero
        euint32 zeroVotes = FHE.asEuint32(0);

        proposals[proposalId] = Proposal({
            title: title,
            description: description,
            startTime: block.timestamp,
            endTime: block.timestamp + duration,
            yesVotes: zeroVotes,
            noVotes: FHE.asEuint32(0),
            isActive: true,
            creator: msg.sender
        });

        // Grant contract permission to operate on encrypted values
        FHE.allowThis(proposals[proposalId].yesVotes);
        FHE.allowThis(proposals[proposalId].noVotes);

        // Grant creator permission to decrypt results (for demonstration)
        FHE.allow(proposals[proposalId].yesVotes, msg.sender);
        FHE.allow(proposals[proposalId].noVotes, msg.sender);

        emit ProposalCreated(proposalId, title, msg.sender, block.timestamp, block.timestamp + duration);

        return proposalId;
    }

    /**
     * @notice Cast encrypted vote on proposal
     * @dev Converts boolean vote to integer increments using FHE arithmetic
     *
     * @custom:chapter voting
     * @custom:chapter privacy
     *
     * Accepts an encrypted boolean vote and uses arithmetic to increment the appropriate counter.
     * The clever trick: if vote is true (yes), add 1 to yes and 0 to no. If vote is false (no),
     * add 0 to yes and 1 to no. This calculation happens entirely on encrypted values.
     */
    function vote(uint256 proposalId, externalEbool encryptedVote, bytes calldata inputProof) external {
        Proposal storage proposal = proposals[proposalId];

        // Verify voting conditions
        require(proposal.isActive, "Proposal not active");
        require(block.timestamp >= proposal.startTime, "Voting not started");
        require(block.timestamp <= proposal.endTime, "Voting ended");
        require(!hasVoted[proposalId][msg.sender], "Already voted");

        // Mark as voted
        hasVoted[proposalId][msg.sender] = true;

        // Convert external encrypted boolean to internal type and validate proof
        ebool encryptedVoteBool = FHE.fromExternal(encryptedVote, inputProof);

        // Convert boolean to integer: true = 1, false = 0
        // This allows us to use arithmetic for counting
        euint32 voteAsInt = FHE.asEuint32(encryptedVoteBool);

        // Calculate increments using encrypted arithmetic
        // If vote is 1 (yes): yesIncrement = 1, noIncrement = 1 - 1 = 0
        // If vote is 0 (no): yesIncrement = 0, noIncrement = 1 - 0 = 1
        euint32 one = FHE.asEuint32(1);
        euint32 yesIncrement = voteAsInt;
        euint32 noIncrement = FHE.sub(one, voteAsInt);

        // Increment encrypted vote counters
        proposal.yesVotes = FHE.add(proposal.yesVotes, yesIncrement);
        proposal.noVotes = FHE.add(proposal.noVotes, noIncrement);

        // Update permissions for modified values
        FHE.allowThis(proposal.yesVotes);
        FHE.allowThis(proposal.noVotes);
        FHE.allow(proposal.yesVotes, proposal.creator);
        FHE.allow(proposal.noVotes, proposal.creator);

        emit VoteCast(proposalId, msg.sender);
    }

    /**
     * @notice End voting on proposal
     * @dev Only callable after voting period ends
     *
     * @custom:chapter voting
     * @custom:chapter governance
     *
     * Marks the proposal as inactive, preventing further votes. After this, results can be
     * revealed through decryption. This ensures vote tallies remain secret during voting.
     */
    function endVoting(uint256 proposalId) external {
        Proposal storage proposal = proposals[proposalId];

        require(proposal.isActive, "Proposal not active");
        require(block.timestamp > proposal.endTime, "Voting period not ended");

        proposal.isActive = false;

        emit VotingEnded(proposalId);
    }

    /**
     * @notice Get encrypted yes votes for proposal
     * @dev Returns encrypted handle - creator can decrypt to see result
     */
    function getYesVotes(uint256 proposalId) external view returns (euint32) {
        return proposals[proposalId].yesVotes;
    }

    /**
     * @notice Get encrypted no votes for proposal
     * @dev Returns encrypted handle - creator can decrypt to see result
     */
    function getNoVotes(uint256 proposalId) external view returns (euint32) {
        return proposals[proposalId].noVotes;
    }

    /**
     * @notice Get proposal details
     * @dev Returns public information (excludes encrypted vote counts)
     */
    function getProposal(uint256 proposalId)
        external
        view
        returns (
            string memory title,
            string memory description,
            uint256 startTime,
            uint256 endTime,
            bool isActive,
            address creator
        )
    {
        Proposal storage proposal = proposals[proposalId];
        return (
            proposal.title,
            proposal.description,
            proposal.startTime,
            proposal.endTime,
            proposal.isActive,
            proposal.creator
        );
    }

    /**
     * @notice Check if address has voted on proposal
     */
    function hasVotedOn(uint256 proposalId, address voter) external view returns (bool) {
        return hasVoted[proposalId][voter];
    }

    /**
     * @notice Check if voting is currently active for proposal
     */
    function isVotingActive(uint256 proposalId) external view returns (bool) {
        Proposal storage proposal = proposals[proposalId];
        return proposal.isActive && block.timestamp >= proposal.startTime && block.timestamp <= proposal.endTime;
    }
}
