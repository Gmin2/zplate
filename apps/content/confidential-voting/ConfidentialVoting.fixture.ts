import { ethers } from "hardhat";
import type { ConfidentialVoting } from "../types";

export async function deployConfidentialVotingFixture(): Promise<{ contract: ConfidentialVoting }> {
  const signers = await ethers.getSigners();
  const contractFactory = await ethers.getContractFactory("ConfidentialVoting");

  const contract = await contractFactory.connect(signers[0]).deploy();

  await contract.waitForDeployment();
  return { contract };
}
