import { ethers } from "hardhat";
import type { ConfidentialAirdrop } from "../types";

export async function deployConfidentialAirdropFixture(): Promise<{ contract: ConfidentialAirdrop }> {
  const signers = await ethers.getSigners();
  const contractFactory = await ethers.getContractFactory("ConfidentialAirdrop");

  // Deploy with standard test parameters
  // 1000 tokens per claim, 1 hour duration
  const contract = await contractFactory
    .connect(signers[0])
    .deploy(
      1000, // airdrop amount per user
      3600 // duration (1 hour)
    );

  await contract.waitForDeployment();
  return { contract };
}
