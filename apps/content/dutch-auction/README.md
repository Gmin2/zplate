# Dutch Auction

Descending price auction with confidential purchase amounts for token sales, NFT launches, and fair distribution.

## Understanding Dutch Auctions

Traditional auctions require buyers to outbid each other, creating winner's curse scenarios where the winning bidder often overpays. Dutch auctions flip this dynamic by starting at a high price and decreasing over time. Instead of bidding up, buyers watch the price fall and decide when to purchase. Early buyers secure allocation at higher prices, while those who wait get better pricing but risk the auction selling out.

This mechanism originated in Dutch flower markets where perishable goods needed quick sales. The auctioneer would start high and lower the price until someone bought. The same principle works brilliantly for token sales and NFT launches. It creates price discovery through revealed preferences rather than strategic bidding, often resulting in fairer market prices.

Traditional Dutch auctions on blockchain suffer from transparency issues. When everyone can see the total supply, current price, and rate of sales, sophisticated buyers gain advantages. They can calculate optimal purchase timing by observing sell-through velocity. Large buyers can see exactly how much supply remains and plan strategic accumulation. This information asymmetry favors professional traders over regular participants.

## Privacy Through Encrypted Quantities

This contract uses Fully Homomorphic Encryption to keep purchase quantities and remaining supply encrypted. The price curve is completely transparent. Everyone can see the starting price, reserve price, discount rate, and current price at any moment. The timing is public. But the quantities involved remain private.

When a buyer purchases tokens, they submit an encrypted amount. The contract multiplies this encrypted quantity by the current public price to calculate payment. The payment happens on encrypted values using FHE arithmetic. The buyer receives their tokens and can decrypt their purchase details client-side, but competitors cannot see how much was bought.

The remaining supply is also encrypted. As purchases happen, the contract subtracts encrypted quantities from encrypted supply using FHE operations. Observers cannot determine how much has sold or how much remains. This prevents gaming based on scarcity signals and creates more equal information access.

## Time-Based Price Decline

The pricing formula is straightforward. At auction start, price equals the starting price. Each second that passes, the price decreases by the discount rate. For example, with a starting price of 100 and discount rate of 1 per second, after 10 seconds the price is 90. After 30 seconds the price is 70.

The price continues declining until it hits the reserve price, which acts as a floor. Even if the formula would calculate a lower price, the contract returns the reserve price. This protects the seller from giving away tokens below an acceptable minimum. The reserve also signals the seller's valuation to the market.

Duration limits how long the auction runs. After the duration expires, no more purchases are accepted. The price calculation caps elapsed time at the duration, so the final price is always determinable. Buyers know exactly how long they have to make decisions and what the eventual floor price will be.

## Example Usage

Creating a Dutch auction for a token sale with 1 million tokens, starting at price 100, declining to reserve 10 over 1 hour:

```typescript
import { ethers } from "hardhat";

// Deploy auction contract
const DutchAuction = await ethers.getContractFactory("DutchAuction");
const auction = await DutchAuction.deploy(
  1000000, // totalTokens
  100, // startPrice
  10, // reservePrice
  1, // discountRate (decreases 1 per second)
  3600 // duration (1 hour in seconds)
);

await auction.waitForDeployment();
```

Buyers can check the current price at any time:

```typescript
const currentPrice = await auction.getCurrentPrice();
console.log(`Current price: ${currentPrice}`);

const timeRemaining = await auction.getTimeRemaining();
console.log(`Time remaining: ${timeRemaining} seconds`);
```

Purchasing tokens with encrypted quantity:

```typescript
import { createFhevmInstance } from "@fhevm/sdk";

const fhevm = await createFhevmInstance();

// Create encrypted input for desired quantity
const purchaseQuantity = 5000;
const input = await fhevm
  .createEncryptedInput(auctionAddress, buyerAddress)
  .add64(purchaseQuantity)
  .encrypt();

// Submit purchase
const tx = await auction.buy(input.handles[0], input.inputProof);
await tx.wait();

// Verify purchase by decrypting
const purchaseInfo = await auction.getPurchaseInfo();
const decryptedAmount = await fhevm.userDecryptEuint64(
  purchaseInfo[0],
  auctionAddress,
  buyerAddress
);

console.log(`Purchased ${decryptedAmount} tokens`);
```

Initializing payment balance for testing (production would use actual ERC7984 tokens):

```typescript
// Give buyer payment tokens
await auction.connect(buyer).initializePaymentBalance(500000);
```

## Common Mistakes to Avoid

Setting a discount rate that drops to reserve price too quickly defeats the purpose of time-based price discovery. Calculate carefully: a discount rate of 10 per second with a 90-point gap (start 100, reserve 10) hits reserve in just 9 seconds. That's barely enough time for buyers to transact. Choose rates that allow meaningful price discovery over the auction duration.

Not capping purchases per address allows whales to sweep the entire sale, defeating fair distribution goals. Production implementations should add per-address limits or implement whitelists with tiered allocations. The demonstration contract lacks these protections for simplicity.

Encrypted quantities cannot be validated on-chain before processing. A buyer might submit a purchase for more tokens than their payment balance covers. The contract handles this by checking encrypted balances and using FHE.select to conditionally zero the purchase if insufficient. But this means failed purchases still cost gas.

Time calculations must use seconds, not minutes or hours. One hour is 3600 seconds, one day is 86,400 seconds. Using 60 for one hour will create a one-minute auction. Block timestamps are in seconds since Unix epoch.

Price changes continuously with each block. A buyer might see price 95 when they submit their transaction, but by the time it mines, the price dropped to 92. They get the execution-time price, not submission-time price. Frontrunning is prevented by encrypted quantities, but timing effects still occur.

## Production Considerations

This is a demonstration contract for educational purposes. Production implementations would integrate with actual ERC7984 confidential tokens for both auction tokens and payment tokens. Real token transfers provide security guarantees that mock balances cannot.

Vesting schedules for purchased tokens prevent immediate dumps. Buyers might receive tokens locked with a cliff period and linear vesting, creating long-term alignment. The auction contract would work with a vesting contract to set up schedules upon purchase.

Participation caps limit maximum purchase per address. This could be a fixed cap, a percentage of supply, or a tiered system based on whitelist status. Caps promote wider distribution and prevent concentration.

Whitelist mechanisms restrict participation to verified addresses. This satisfies regulatory requirements for restricted offerings and prevents sybil attacks where one entity creates many addresses to bypass caps.

Refund handling for soldout scenarios protects buyers. If the auction sells out while a purchase transaction is pending, the buyer should receive a refund rather than a failed transaction. The contract would need to handle partial fills gracefully.

Emergency stop functionality allows pausing in case of discovered vulnerabilities. Administrators could halt purchases while investigating issues, then resume or cancel depending on findings. This requires careful access control to prevent abuse.

##Testing

Run the test suite:

```bash
npm test
```

The tests demonstrate price calculations, encrypted purchases, accumulation tracking, supply capping, timing enforcement, and privacy guarantees. All assertions validate that encrypted values behave correctly and that the Dutch auction mechanism works as expected.

## Security Notes

This contract has not been audited. It is provided for educational purposes to demonstrate FHE-based Dutch auction patterns. Do not use in production without proper security review, comprehensive testing, and professional audit.

The mock balance system is not a real token. Production deployments must integrate with confidential ERC7984 implementations that properly handle encrypted token transfers, allowances, and standard token interfaces.

Input proof validation is critical. The contract must verify zero-knowledge proofs to ensure encrypted values are properly bound to the sender and contract. Never skip proof validation in production.

Reentrancy protection is needed for production. The demonstration contract lacks ReentrancyGuard on purchase functions. Production implementations should use OpenZeppelin's ReentrancyGuard to prevent reentrancy attacks.
