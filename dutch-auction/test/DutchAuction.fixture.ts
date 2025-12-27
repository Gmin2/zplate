import { ethers } from "hardhat";
import type { DutchAuction } from "../types";

export async function deployDutchAuctionFixture(): Promise<{ contract: DutchAuction }> {
  const signers = await ethers.getSigners();
  const contractFactory = await ethers.getContractFactory("DutchAuction");

  // Deploy with standard test parameters
  // 1,000,000 tokens, start price 100, reserve 10, discount 1 per second, 1 hour duration
  const contract = await contractFactory
    .connect(signers[0])
    .deploy(
      1000000, // totalTokens
      100, // startPrice
      10, // reservePrice
      1, // discountRate (price decreases by 1 per second)
      3600 // duration (1 hour)
    );

  await contract.waitForDeployment();
  return { contract };
}
