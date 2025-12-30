import { ethers } from "hardhat";
import type { RockPaperScissors } from "../types";

export async function deployRockPaperScissorsFixture(): Promise<{ contract: RockPaperScissors }> {
  const signers = await ethers.getSigners();
  const contractFactory = await ethers.getContractFactory("RockPaperScissors");
  const contract = await contractFactory.connect(signers[0]).deploy();
  await contract.waitForDeployment();
  return { contract };
}
