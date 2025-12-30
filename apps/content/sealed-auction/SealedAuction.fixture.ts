import { ethers } from "hardhat";
import type { SealedAuction } from "../types";

export async function deploySealedAuctionFixture(): Promise<{ contract: SealedAuction }> {
  const signers = await ethers.getSigners();
  const contractFactory = await ethers.getContractFactory("SealedAuction");
  const contract = await contractFactory.connect(signers[0]).deploy();
  await contract.waitForDeployment();
  return { contract };
}
