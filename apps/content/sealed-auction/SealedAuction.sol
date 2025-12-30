// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {FHE, euint64, externalEuint64} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

/**
 * @title SealedAuction
 * @notice NFT auction with encrypted bids - prevents bid sniping and strategic manipulation
 * @dev Demonstrates sealed-bid (Vickrey-style) auction pattern using FHE
 *
 * @custom:security-contact security@example.com
 * @custom:chapter auction
 * @custom:chapter privacy
 *
 * AUCTION MECHANICS:
 * ==================
 * 1. Auction created for NFT with reserve price (public) and duration
 * 2. Bidders submit encrypted bids during bidding period
 * 3. No one can see bid amounts (including auctioneer and other bidders)
 * 4. After auction ends, gateway decrypts winning bid
 * 5. Highest bidder wins NFT, pays their bid amount
 *
 * ADVANTAGES OVER TRADITIONAL AUCTIONS:
 * =====================================
 * - No bid sniping (last-second outbidding based on current high bid)
 * - No strategic bidding based on others' bids
 * - True market price discovery (bidders bid their actual valuation)
 * - Fair auction without trusted auctioneer
 * - MEV protection (bids cannot be front-run)
 *
 * IMPORTANT LIMITATIONS:
 * =====================
 * ⚠️ This is a DEMONSTRATION contract showing the sealed-bid pattern
 * ⚠️ Production use requires:
 *    - Gateway integration for winner determination
 *    - ERC721 integration for actual NFT transfer
 *    - Payment token integration (confidential ERC20)
 *    - Refund mechanism for losing bidders
 *    - Dispute resolution mechanism
 *
 * COMMON PITFALLS:
 * ===============
 * 1. ❌ Revealing bids too early breaks auction fairness
 * 2. ❌ Not using gateway for winner determination (can't compare encrypted values on-chain)
 * 3. ❌ Forgetting to grant FHE permissions to bidders
 * 4. ❌ Allowing seller to bid (creates perverse incentives)
 * 5. ❌ Not handling auction cancellation edge cases
 */
contract SealedAuction is ZamaEthereumConfig {
    /**
     * @notice Auction state structure
     * @dev All bid amounts are encrypted - only metadata is public
     *
     * @param seller Address that created the auction (NFT owner)
     * @param nftId Token ID being auctioned (mock - not using real ERC721)
     * @param reservePrice Minimum acceptable bid (PUBLIC - visible to all)
     * @param startTime Timestamp when auction was created
     * @param endTime Timestamp when bidding closes
     * @param isActive Whether auction is accepting bids
     * @param isFinalized Whether winner has been determined
     * @param highestBidder Winner address (set after gateway callback)
     * @param winningBid Winning bid amount (set after gateway callback)
     */
    struct Auction {
        address seller;
        uint256 nftId;
        uint64 reservePrice;
        uint256 startTime;
        uint256 endTime;
        bool isActive;
        bool isFinalized;
        address highestBidder;
        uint64 winningBid;
    }

    // ============ State Variables ============

    /**
     * @notice Encrypted bids storage
     * @dev Mapping: auctionId => bidder => encrypted bid amount
     *
     * SECURITY: Only the bidder who placed the bid can decrypt it
     * WHY ENCRYPTED: Prevents bid sniping and strategic manipulation
     */
    mapping(uint256 => mapping(address => euint64)) private _bids;

    /**
     * @notice Auction storage
     * @dev Public mapping but bid amounts remain encrypted
     */
    mapping(uint256 => Auction) public auctions;

    /**
     * @notice Auto-incrementing auction ID counter
     */
    uint256 public nextAuctionId;

    /**
     * @notice Mock balances for demo
     * @dev Replace with confidential token integration in production
     */
    mapping(address => uint256) public balances;

    // ============ Events ============

    /**
     * @notice Emitted when new auction is created
     * @param auctionId Unique auction identifier
     * @param seller Address that created the auction
     * @param nftId Token being auctioned
     * @param reservePrice Minimum acceptable bid (public)
     * @param endTime When bidding closes
     */
    event AuctionCreated(
        uint256 indexed auctionId,
        address indexed seller,
        uint256 nftId,
        uint64 reservePrice,
        uint256 endTime
    );

    /**
     * @notice Emitted when a bid is placed
     * @param auctionId Auction being bid on
     * @param bidder Address placing the bid
     *
     * NOTE: Bid amount is NOT in event (it's encrypted!)
     */
    event BidPlaced(uint256 indexed auctionId, address indexed bidder);

    /**
     * @notice Emitted when auction is finalized and winner determined
     * @param auctionId Auction that was finalized
     * @param winner Winning bidder address
     * @param winningBid Winning bid amount (decrypted)
     */
    event AuctionFinalized(uint256 indexed auctionId, address indexed winner, uint64 winningBid);

    /**
     * @notice Emitted when auction is cancelled
     * @param auctionId Auction that was cancelled
     */
    event AuctionCancelled(uint256 indexed auctionId);

    // ============ Core Functions ============

    /**
     * @notice Create a new sealed-bid auction
     * @dev Reserve price is PUBLIC - consider if this reveals too much information
     *
     * @param nftId NFT token ID to auction (mock - not using actual ERC721)
     * @param reservePrice Minimum acceptable bid in plaintext (PUBLIC!)
     * @param duration Auction duration in seconds
     * @return auctionId The created auction's unique identifier
     *
     * @custom:chapter auction
     * @custom:example
     * ```solidity
     * // Create 24-hour auction with 100 token minimum bid
     * uint256 auctionId = createAuction(tokenId, 100, 86400);
     * ```
     *
     * SECURITY CONSIDERATIONS:
     * - Reserve price is PUBLIC (visible on-chain)
     * - Anyone can create auctions (add access control in production)
     * - No validation that seller owns the NFT (add ERC721 ownership check)
     *
     * COMMON PITFALLS:
     * ❌ Setting duration = 0 (reverts)
     * ❌ Not checking if you own the NFT before creating auction
     */
    function createAuction(uint256 nftId, uint64 reservePrice, uint256 duration) external returns (uint256) {
        require(duration > 0, "Invalid duration");

        uint256 auctionId = nextAuctionId++;

        auctions[auctionId] = Auction({
            seller: msg.sender,
            nftId: nftId,
            reservePrice: reservePrice,
            startTime: block.timestamp,
            endTime: block.timestamp + duration,
            isActive: true,
            isFinalized: false,
            highestBidder: address(0),
            winningBid: 0
        });

        emit AuctionCreated(auctionId, msg.sender, nftId, reservePrice, block.timestamp + duration);
        return auctionId;
    }

    /**
     * @notice Submit encrypted bid to auction
     * @dev Bidders can submit multiple bids - only the latest counts
     *
     * @param auctionId Auction to bid on
     * @param inputEuint64 Encrypted bid amount (use fhevm.createEncryptedInput)
     * @param inputProof Zero-knowledge proof binding bid to bidder
     *
     * @custom:chapter auction
     * @custom:chapter access-control
     * @custom:example
     * ```typescript
     * // Client-side: Create encrypted bid
     * const input = await fhevm
     *   .createEncryptedInput(contractAddress, bidderAddress)
     *   .add64(bidAmount)  // Your bid amount
     *   .encrypt();
     *
     * // Submit to contract
     * await auction.placeBid(auctionId, input.handles[0], input.inputProof);
     * ```
     *
     * WHY INPUT PROOFS:
     * Input proofs cryptographically bind the encrypted value to:
     * 1. The contract address (prevents replay to other contracts)
     * 2. The sender address (prevents bid stealing)
     * This prevents malicious actors from copying encrypted bids
     *
     * PERMISSION PATTERN:
     * - FHE.allowThis(bidAmount) - Contract can use the encrypted value
     * - FHE.allow(bidAmount, msg.sender) - Bidder can decrypt their bid
     *
     * SECURITY CONSIDERATIONS:
     * - Seller cannot bid (prevents shill bidding)
     * - Bids are APPEND-ONLY (can update but not delete)
     * - No refunds in this demo (add in production)
     *
     * COMMON PITFALLS:
     * ❌ Bidding after auction ends (reverts with "Auction ended")
     * ❌ Seller trying to bid (reverts with "Seller cannot bid")
     * ❌ Bidding on cancelled auction (reverts with "Auction not active")
     * ❌ Wrong proof (reverts during FHE.fromExternal)
     */
    function placeBid(uint256 auctionId, externalEuint64 inputEuint64, bytes calldata inputProof) external {
        Auction storage auction = auctions[auctionId];
        require(auction.isActive, "Auction not active");
        require(block.timestamp < auction.endTime, "Auction ended");
        require(msg.sender != auction.seller, "Seller cannot bid");

        // Convert external encrypted input to internal encrypted type
        // This validates the proof and binds the value to this contract
        euint64 bidAmount = FHE.fromExternal(inputEuint64, inputProof);

        // Store bid (overwrites previous bid if exists)
        _bids[auctionId][msg.sender] = bidAmount;

        // CRITICAL: Grant permissions for encrypted value
        // Step 1: Allow contract to use this encrypted value
        FHE.allowThis(bidAmount);
        // Step 2: Allow bidder to decrypt their own bid
        FHE.allow(bidAmount, msg.sender);

        emit BidPlaced(auctionId, msg.sender);
    }

    /**
     * @notice Finalize auction and determine winner
     * @dev ⚠️ SIMPLIFIED DEMO - Production requires gateway integration
     *
     * @param auctionId Auction to finalize
     *
     * @custom:chapter gateway
     * @custom:chapter relayer
     *
     * PRODUCTION IMPLEMENTATION:
     * =========================
     * This is a SIMPLIFIED demo. In production, you MUST:
     *
     * 1. Make bids publicly decryptable:
     *    ```solidity
     *    for each bidder:
     *        FHE.makePubliclyDecryptable(_bids[auctionId][bidder]);
     *    ```
     *
     * 2. Request gateway decryption:
     *    - Gateway is an off-chain service that decrypts FHE values
     *    - Returns decrypted values via callback
     *
     * 3. Implement callback function:
     *    ```solidity
     *    function gatewayCallback(uint256 auctionId, address[] bidders, uint64[] amounts) external {
     *        require(msg.sender == GATEWAY_ADDRESS);
     *        // Find highest bid
     *        // Transfer NFT to winner
     *        // Refund losing bidders
     *    }
     *    ```
     *
     * WHY GATEWAY NEEDED:
     * - Cannot compare encrypted values on-chain (euint64 comparison doesn't work)
     * - Gateway decrypts values off-chain and calls back with results
     * - Maintains privacy during bidding, reveals winner at end
     *
     * COMMON PITFALLS:
     * ❌ Trying to compare encrypted bids on-chain (impossible!)
     * ❌ Finalizing before auction ends (reverts "Auction still ongoing")
     * ❌ Double finalization (reverts "Already finalized")
     * ❌ Not implementing refund mechanism (bidders lose funds)
     */
    function finalizeAuction(uint256 auctionId) external {
        Auction storage auction = auctions[auctionId];
        require(!auction.isFinalized, "Already finalized");
        require(auction.isActive, "Auction not active");
        require(block.timestamp >= auction.endTime, "Auction still ongoing");

        // NOTE: This is a simplified demo implementation
        // In production, you would:
        // 1. Make all bids publicly decryptable via FHE.makePubliclyDecryptable()
        // 2. Request gateway decryption
        // 3. Determine winner in callback
        //
        // For this demo, we'll mark as finalized and emit event
        // Actual winner determination would require gateway integration

        auction.isFinalized = true;
        auction.isActive = false;

        emit AuctionFinalized(auctionId, address(0), 0);
    }

    /**
     * @notice Cancel auction before it ends
     * @dev Only seller can cancel, only if auction still active
     *
     * @param auctionId Auction to cancel
     *
     * @custom:chapter access-control
     *
     * SECURITY CONSIDERATIONS:
     * - Only seller can cancel
     * - Production should add: "only if no bids placed" check
     * - Should refund any existing bids
     *
     * COMMON PITFALLS:
     * ❌ Non-seller trying to cancel (reverts "Only seller can cancel")
     * ❌ Cancelling already finalized auction (reverts "Auction not active")
     */
    function cancelAuction(uint256 auctionId) external {
        Auction storage auction = auctions[auctionId];
        require(msg.sender == auction.seller, "Only seller can cancel");
        require(auction.isActive, "Auction not active");

        auction.isActive = false;

        emit AuctionCancelled(auctionId);
    }

    // ============ View Functions ============

    /**
     * @notice Get encrypted bid for caller's address
     * @dev Only returns caller's own bid - cannot see other bids
     *
     * @param auctionId Auction to query
     * @return Encrypted bid handle (decrypt client-side)
     *
     * @custom:chapter privacy
     * @custom:example
     * ```typescript
     * // Get your encrypted bid
     * const bidHandle = await auction.getBid(auctionId);
     *
     * // Decrypt client-side
     * const myBid = await fhevm.userDecryptEuint(
     *   FhevmType.euint64,
     *   bidHandle,
     *   contractAddress,
     *   signer
     * );
     * ```
     *
     * PRIVACY GUARANTEE:
     * - Returns YOUR bid only (msg.sender)
     * - Other bidders cannot decrypt your bid
     * - Even contract cannot see plaintext amount
     */
    function getBid(uint256 auctionId) external view returns (euint64) {
        return _bids[auctionId][msg.sender];
    }

    /**
     * @notice Get auction details
     * @dev All fields except bids are public
     *
     * @return seller Auction creator
     * @return nftId Token being auctioned
     * @return reservePrice Minimum bid (public)
     * @return startTime Auction start timestamp
     * @return endTime Auction end timestamp
     * @return isActive Whether accepting bids
     * @return isFinalized Whether winner determined
     * @return highestBidder Winner (address(0) until finalized)
     * @return winningBid Winning amount (0 until finalized)
     */
    function getAuction(
        uint256 auctionId
    )
        external
        view
        returns (
            address seller,
            uint256 nftId,
            uint64 reservePrice,
            uint256 startTime,
            uint256 endTime,
            bool isActive,
            bool isFinalized,
            address highestBidder,
            uint64 winningBid
        )
    {
        Auction storage auction = auctions[auctionId];
        return (
            auction.seller,
            auction.nftId,
            auction.reservePrice,
            auction.startTime,
            auction.endTime,
            auction.isActive,
            auction.isFinalized,
            auction.highestBidder,
            auction.winningBid
        );
    }

    // ============ Testing Utilities ============

    /**
     * @notice Initialize balance for testing
     * @dev Demo function - remove in production
     */
    function initializeBalance(uint256 amount) external {
        balances[msg.sender] = amount;
    }
}
