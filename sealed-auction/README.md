# Sealed Auction

NFT auction with encrypted bids demonstrating the sealed-bid pattern using Fully Homomorphic Encryption. This template shows how to prevent bid sniping and strategic manipulation in on-chain auctions by keeping all bids encrypted until the auction concludes.

## What You'll Learn

This template demonstrates the sealed-bid auction pattern where bids remain encrypted throughout the bidding period, input proof validation for secure bid submission, permission management for multi-party encrypted data access, time-based auction mechanics with proper state transitions, and the limitations of encrypted value comparison that necessitate gateway integration. You will understand how FHE enables truly fair auctions without requiring a trusted third party.

## Why Sealed Auctions Matter

Traditional smart contract auctions suffer from a fundamental problem: all transaction data is public. When bidders can see the current high bid, they engage in strategic bidding rather than bidding their true valuation. Last-second bid sniping becomes the dominant strategy, leading to inefficient price discovery and unfair advantages for sophisticated actors with better infrastructure.

Sealed-bid auctions solve this by keeping bids secret until the auction closes. In traditional systems, this requires a trusted auctioneer to collect and hold bids. FHE eliminates this trust assumption by encrypting bids on-chain where no one including the contract itself can see the plaintext values until decryption is explicitly requested.

## Core Patterns

### Creating a Sealed Auction

Auctions are created with a reserve price and duration. The reserve price is intentionally public to signal minimum expectations, though this could be encrypted in more advanced implementations. The seller creates the auction and the contract tracks all state including start time, end time, and auction status.

```solidity
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

    return auctionId;
}
```

### Encrypted Bid Submission

Bidders submit encrypted bids using the FHE input proof pattern. The proof cryptographically binds the encrypted value to both the contract address and the bidder's address, preventing bid stealing or replay attacks to other contracts. After validation, the contract stores the encrypted bid and grants decryption permissions to both the contract and the bidder.

```solidity
function placeBid(uint256 auctionId, externalEuint64 inputEuint64, bytes calldata inputProof) external {
    Auction storage auction = auctions[auctionId];
    require(auction.isActive, "Auction not active");
    require(block.timestamp < auction.endTime, "Auction ended");
    require(msg.sender != auction.seller, "Seller cannot bid");

    // Validate proof and convert to internal encrypted type
    euint64 bidAmount = FHE.fromExternal(inputEuint64, inputProof);

    // Store encrypted bid
    _bids[auctionId][msg.sender] = bidAmount;

    // Grant permissions
    FHE.allowThis(bidAmount);  // Contract can use this value
    FHE.allow(bidAmount, msg.sender);  // Bidder can decrypt their bid
}
```

The permission pattern is critical. FHE.allowThis grants the contract permission to use the encrypted value in computations. FHE.allow grants the bidder permission to decrypt their own bid client-side for verification. No other party receives decryption permission, ensuring bid privacy.

### Client-Side Bid Creation

On the client side, bidders create encrypted inputs using the fhevm library. The process involves creating an encrypted input bound to the contract and user address, adding the bid amount, and generating a zero-knowledge proof that validates the binding without revealing the amount.

```typescript
// Create encrypted bid
const input = await fhevm
  .createEncryptedInput(contractAddress, bidderAddress)
  .add64(bidAmount)
  .encrypt();

// Submit to contract
await auction.placeBid(auctionId, input.handles[0], input.inputProof);

// Bidder can decrypt their own bid to verify
const bidHandle = await auction.getBid(auctionId);
const myBid = await fhevm.userDecryptEuint(
  FhevmType.euint64,
  bidHandle,
  contractAddress,
  signer
);
```

## Critical Limitation: Winner Determination

The most important limitation of this template is that it cannot determine the winner on-chain. Since all bids are encrypted, the contract cannot compare them to find the highest bid. This is not a bug but a fundamental property of FHE: you cannot perform plaintext comparisons on encrypted values.

Production implementations must integrate with the Zama Gateway for winner determination. The gateway is an off-chain service that can decrypt FHE values and return results to the contract via callback. The proper flow involves making all bids publicly decryptable at auction end, requesting gateway decryption, and implementing a callback function to receive the decrypted highest bid and winner address.

```solidity
// Production pattern (not implemented in this demo)
function finalizeAuction(uint256 auctionId) external {
    // 1. Make bids publicly decryptable
    for each bidder:
        FHE.makePubliclyDecryptable(_bids[auctionId][bidder]);

    // 2. Request gateway decryption
    // Gateway decrypts off-chain and calls back

    // 3. Callback receives results
}

function gatewayCallback(uint256 auctionId, address winner, uint64 amount) external {
    require(msg.sender == GATEWAY_ADDRESS);
    auction.highestBidder = winner;
    auction.winningBid = amount;
    // Transfer NFT to winner, refund losing bidders
}
```

## Security Considerations

The seller cannot bid on their own auction to prevent shill bidding where the seller artificially inflates prices. Bids are append-only, meaning bidders can update their bids but cannot withdraw them. This prevents bid manipulation but means production systems need refund mechanisms for losing bidders.

Time-based validation ensures bids cannot be placed after the auction ends, preventing late manipulation. The auction can only be finalized after the end time, preventing premature revelation of bids which would break the sealed-bid property.

## Common Pitfalls

Setting auction duration to zero will revert the transaction. Always validate time parameters before creating auctions. Attempting to bid after the auction ends will revert, so client applications should check the end time before allowing bid submission. The seller attempting to bid will revert to prevent conflicts of interest. Bidding on a cancelled auction will fail, so applications should check auction status before transactions.

The most critical pitfall is attempting to compare encrypted bids on-chain. This is impossible with current FHE technology and will not work. You must use gateway decryption for any operation that requires knowing plaintext values or performing comparisons between encrypted values.

## Privacy Features

Bid amounts remain encrypted on-chain and cannot be read by examining blockchain state. Other bidders cannot see competitor bids, preventing strategic manipulation. The seller cannot see bids during the auction, ensuring fair price discovery. Only after gateway decryption at auction end are values revealed, and only the winning bid needs to be revealed publicly.

Each bidder can decrypt only their own bid using client-side decryption. The FHE permission model enforces this through cryptographic access control rather than smart contract logic. This means even if the contract is compromised, the encrypted bids cannot be read without the proper decryption keys.

## Comparison with Traditional Approaches

Traditional sealed auctions on blockchain use commit-reveal schemes. Phase one involves bidders submitting hash(bid + secret). Phase two requires revealing the actual bid and secret after bidding closes. This approach has several problems: requires two transactions per bidder doubling gas costs, bidders can refuse to reveal if they lose, and timing attacks can leak information about bid ranges.

FHE eliminates these problems entirely. Bids are encrypted not hashed, so they can be verified without reveal. Only one transaction is needed per bid. Bidders cannot selectively reveal or hide their bids. No timing attacks are possible since the encrypted value itself reveals nothing about magnitude.

## Production Considerations

For production deployment, integrate the Zama Gateway for automatic winner determination and payout distribution. Replace the mock NFT system with actual ERC721 integration including ownership verification before auction creation. Integrate with confidential ERC20 tokens for private payment handling. Implement refund mechanisms for losing bidders to avoid funds being locked.

Add access control for auction creation if needed, such as requiring NFT ownership or platform approval. Implement dispute resolution for edge cases like tied bids or failed gateway callbacks. Consider adding auction extension mechanisms to prevent sniping in the final seconds. Add comprehensive event logging for off-chain indexing and analytics.

For high-value auctions, consider implementing multi-signature requirements for finalization or time-locks before NFT transfer to allow for dispute windows. Integration with oracle services can provide price feeds for reserve price validation or anti-manipulation checks.

## Quick Start

```bash
npm install
npm run compile
npm test
```

## Next Steps

See the rock-paper-scissors template for two-player encrypted gaming with similar patterns. The confidential-token template demonstrates ERC20 integration for payment handling. Refer to the decrypt-gateway template for detailed gateway integration patterns. The confidential-voting template shows similar patterns for governance applications where vote privacy is essential.
