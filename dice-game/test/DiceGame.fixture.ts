import { ethers } from "hardhat";
import type { DiceGame } from "../types";

export async function deployDiceGameFixture(): Promise<{ contract: DiceGame }> {
  const signers = await ethers.getSigners();
  const contractFactory = await ethers.getContractFactory("DiceGame");
  const contract = await contractFactory.connect(signers[0]).deploy();
  await contract.waitForDeployment();
  return { contract };
}
