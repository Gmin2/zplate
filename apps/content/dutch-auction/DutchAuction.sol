// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {FHE, euint64, externalEuint64, ebool} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

/**
 * @title DutchAuction
 * @notice Descending price auction with confidential purchase amounts
 * @dev Demonstrates time-based pricing with encrypted token quantities
 *
 * @custom:security-contact security@example.com
 * @custom:chapter auction
 * @custom:chapter defi
 * @custom:chapter time-lock
 *
 * This contract implements a Dutch auction where the price starts high and decreases linearly over time
 * until it reaches a reserve price. Unlike traditional auctions where buyers compete by bidding higher,
 * Dutch auctions let buyers wait for the price to fall to their preferred level. The first buyers pay
 * more but secure their allocation, while later buyers get better prices but risk the auction selling out.
 *
 * With FHE-based confidential amounts, the total supply being auctioned remains encrypted. Observers can
 * see the current price and timing information, but they cannot determine how many tokens are available
 * or how many have been purchased. This prevents gaming the market by observing sell-through rates or
 * allocation patterns. Buyers purchase encrypted quantities, so competitors cannot see buying pressure
 * or strategic accumulation patterns.
 *
 * The price calculation is public and transparent. Starting price, discount rate, and reserve price are
 * all visible on-chain. The formula: currentPrice = startPrice - (discountRate * timeElapsed). Once the
 * price hits the reserve price, it stops declining. This creates urgency while ensuring tokens don't
 * sell below a minimum acceptable price.
 *
 * When buyers purchase, they specify an encrypted quantity. The contract calculates payment as price times
 * quantity, transfers payment tokens, and delivers auction tokens. All calculations on quantities happen
 * with encrypted values. The buyer can later decrypt their purchase amount and payment to verify the
 * transaction, but outsiders cannot see individual purchase sizes.
 *
 * This is a demonstration contract for educational purposes. Production implementations would add
 * vesting schedules for purchased tokens, participation caps to prevent whale dominance, whitelist
 * mechanisms for restricted sales, and refund handling if the auction sells out before a purchase
 * completes. You would also integrate with actual ERC7984 confidential tokens rather than the mock
 * system shown here.
 *
 * Common mistakes include setting a discount rate that reaches reserve price too quickly, making the
 * auction pointless. Another pitfall is not capping purchases per address, allowing one buyer to sweep
 * the entire sale. Developers sometimes forget that encrypted quantities cannot be validated on-chain,
 * so purchases might exceed available supply. The contract must handle this gracefully. Time calculations
 * are in seconds, so a one-day duration is 86,400 seconds not 1. Finally, buyers might submit purchase
 * requests that process at different prices than expected due to block timing.
 */
contract DutchAuction is ZamaEthereumConfig {
    /**
     * @notice Auction configuration structure
     * @dev Time and pricing parameters are public, token amounts are encrypted
     */
    struct AuctionConfig {
        uint256 startTime;
        uint256 duration;
        uint64 startPrice;
        uint64 reservePrice;
        uint64 discountRate;    // Price decrease per second
    }

    /**
     * @notice Purchase record for each buyer
     * @dev Both quantities are encrypted for privacy
     */
    struct Purchase {
        euint64 tokenAmount;    // Encrypted amount of tokens purchased
        euint64 paidAmount;     // Encrypted amount paid
    }

    AuctionConfig public config;
    euint64 private _tokensRemaining;
    mapping(address => Purchase) public purchases;
    address public immutable seller;

    // Mock balances for demonstration (production would use ERC7984)
    mapping(address => euint64) private _tokenBalances;
    mapping(address => euint64) private _paymentBalances;

    /**
     * @notice Emitted when tokens are purchased
     * @dev Amount is intentionally omitted to preserve privacy
     */
    event TokensPurchased(address indexed buyer, uint256 pricePerToken, uint256 timestamp);

    /**
     * @notice Emitted when auction ends
     */
    event AuctionEnded(uint256 timestamp);

    /**
     * @notice Initialize Dutch auction with time and pricing parameters
     * @dev Demonstrates encrypted token supply with public pricing
     *
     * @custom:chapter auction
     * @custom:chapter time-lock
     *
     * Creates a Dutch auction where price decreases linearly from start price to reserve price
     * over the auction duration. The total token supply is encrypted to hide availability from
     * potential buyers, preventing strategic timing based on sell-through rates.
     */
    constructor(
        uint64 totalTokens,
        uint64 startPrice,
        uint64 reservePrice,
        uint64 discountRate,
        uint256 duration
    ) {
        // Validate price parameters (reserve must be less than start)
        require(startPrice > reservePrice, "Invalid price range");
        require(discountRate > 0, "Invalid discount rate");
        require(duration > 0, "Invalid duration");

        seller = msg.sender;

        // Store public auction configuration
        config = AuctionConfig({
            startTime: block.timestamp,
            duration: duration,
            startPrice: startPrice,
            reservePrice: reservePrice,
            discountRate: discountRate
        });

        // Initialize encrypted token supply
        _tokensRemaining = FHE.asEuint64(totalTokens);

        // Grant permissions for contract operations and seller viewing
        FHE.allowThis(_tokensRemaining);
        FHE.allow(_tokensRemaining, seller);

        // Initialize seller's token balance for demonstration
        _tokenBalances[seller] = FHE.asEuint64(totalTokens);
        FHE.allowThis(_tokenBalances[seller]);
        FHE.allow(_tokenBalances[seller], seller);
    }

    /**
     * @notice Calculate current price based on time elapsed
     * @dev Public price calculation - only quantities are encrypted
     *
     * @custom:chapter auction
     *
     * Returns the current token price based on linear time-based decline. Price starts at
     * startPrice and decreases by discountRate per second until reaching reservePrice floor.
     */
    function getCurrentPrice() public view returns (uint64) {
        // Calculate time elapsed since auction start
        uint256 elapsed = block.timestamp - config.startTime;

        // Cap elapsed time at auction duration
        if (elapsed > config.duration) {
            elapsed = config.duration;
        }

        // Calculate price reduction: discountRate * seconds elapsed
        uint64 discount = uint64(config.discountRate * elapsed);

        // Subtract discount from start price
        uint64 currentPrice;
        if (config.startPrice > discount) {
            currentPrice = config.startPrice - discount;
        } else {
            currentPrice = 0;
        }

        // Floor at reserve price (minimum acceptable price)
        return currentPrice > config.reservePrice ? currentPrice : config.reservePrice;
    }

    /**
     * @notice Purchase tokens at current price with encrypted quantity
     * @dev Demonstrates encrypted arithmetic for payment calculation
     *
     * @custom:chapter auction
     * @custom:chapter defi
     *
     * Allows buyers to purchase an encrypted quantity of tokens at the current price. The contract
     * calculates required payment, verifies sufficient payment tokens, and transfers both payment
     * and auction tokens. All quantity calculations happen on encrypted values for privacy.
     */
    function buy(externalEuint64 inputEuint64, bytes calldata inputProof) external {
        // Verify auction is still active
        require(block.timestamp < config.startTime + config.duration, "Auction ended");

        // Convert external encrypted input to internal type and validate proof
        euint64 requestedAmount = FHE.fromExternal(inputEuint64, inputProof);

        // Get current price (public calculation)
        uint64 currentPrice = getCurrentPrice();

        // Cap purchase at remaining tokens
        // Uses encrypted min to prevent revealing supply
        euint64 actualAmount = FHE.min(requestedAmount, _tokensRemaining);

        // Calculate required payment: price * quantity
        // Multiply encrypted quantity by plaintext price
        euint64 requiredPayment = FHE.mul(actualAmount, currentPrice);

        // Verify buyer has sufficient payment tokens
        // In production, this would use ERC7984 transferFrom with verification
        ebool hasSufficientPayment = FHE.ge(_paymentBalances[msg.sender], requiredPayment);

        // Only proceed with purchase if payment is sufficient
        // Uses select to conditionally set amount to 0 if payment fails
        actualAmount = FHE.select(hasSufficientPayment, actualAmount, FHE.asEuint64(0));
        requiredPayment = FHE.select(hasSufficientPayment, requiredPayment, FHE.asEuint64(0));

        // Transfer payment from buyer to seller (encrypted balances)
        _paymentBalances[msg.sender] = FHE.sub(_paymentBalances[msg.sender], requiredPayment);
        _paymentBalances[seller] = FHE.add(_paymentBalances[seller], requiredPayment);

        // Transfer tokens from seller to buyer (encrypted balances)
        _tokenBalances[seller] = FHE.sub(_tokenBalances[seller], actualAmount);
        _tokenBalances[msg.sender] = FHE.add(_tokenBalances[msg.sender], actualAmount);

        // Update remaining supply
        _tokensRemaining = FHE.sub(_tokensRemaining, actualAmount);

        // Track purchase for buyer's records
        if (FHE.isInitialized(purchases[msg.sender].tokenAmount)) {
            // Add to existing purchase
            purchases[msg.sender].tokenAmount = FHE.add(purchases[msg.sender].tokenAmount, actualAmount);
            purchases[msg.sender].paidAmount = FHE.add(purchases[msg.sender].paidAmount, requiredPayment);
        } else {
            // First purchase
            purchases[msg.sender] = Purchase({tokenAmount: actualAmount, paidAmount: requiredPayment});
        }

        // Grant permissions for all updated encrypted values
        FHE.allowThis(_tokensRemaining);
        FHE.allow(_tokensRemaining, seller);

        FHE.allowThis(_paymentBalances[msg.sender]);
        FHE.allow(_paymentBalances[msg.sender], msg.sender);
        FHE.allowThis(_paymentBalances[seller]);
        FHE.allow(_paymentBalances[seller], seller);

        FHE.allowThis(_tokenBalances[msg.sender]);
        FHE.allow(_tokenBalances[msg.sender], msg.sender);
        FHE.allowThis(_tokenBalances[seller]);
        FHE.allow(_tokenBalances[seller], seller);

        FHE.allowThis(purchases[msg.sender].tokenAmount);
        FHE.allow(purchases[msg.sender].tokenAmount, msg.sender);
        FHE.allowThis(purchases[msg.sender].paidAmount);
        FHE.allow(purchases[msg.sender].paidAmount, msg.sender);

        emit TokensPurchased(msg.sender, currentPrice, block.timestamp);
    }

    /**
     * @notice Check if auction has ended
     */
    function hasEnded() public view returns (bool) {
        return block.timestamp >= config.startTime + config.duration;
    }

    /**
     * @notice Get time remaining in auction
     */
    function getTimeRemaining() public view returns (uint256) {
        uint256 endTime = config.startTime + config.duration;
        if (block.timestamp >= endTime) {
            return 0;
        }
        return endTime - block.timestamp;
    }

    /**
     * @notice Get buyer's purchase information
     * @dev Returns encrypted values - buyer must decrypt client-side
     */
    function getPurchaseInfo() external view returns (euint64 tokenAmount, euint64 paidAmount) {
        Purchase storage purchase = purchases[msg.sender];
        return (purchase.tokenAmount, purchase.paidAmount);
    }

    /**
     * @notice Get token balance
     * @dev Demo function - production would query ERC7984 token
     */
    function getTokenBalance() external view returns (euint64) {
        return _tokenBalances[msg.sender];
    }

    /**
     * @notice Get payment token balance
     * @dev Demo function - production would query ERC7984 token
     */
    function getPaymentBalance() external view returns (euint64) {
        return _paymentBalances[msg.sender];
    }

    /**
     * @notice Initialize payment balance for testing
     * @dev Demo function - production would use actual token transfers
     */
    function initializePaymentBalance(uint64 amount) external {
        euint64 encAmount = FHE.asEuint64(amount);
        _paymentBalances[msg.sender] = encAmount;
        FHE.allowThis(encAmount);
        FHE.allow(encAmount, msg.sender);
    }
}
