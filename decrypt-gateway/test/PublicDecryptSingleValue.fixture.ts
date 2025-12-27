import { ethers } from "hardhat";
import type { PublicDecryptSingleValue } from "../types";

export async function deployPublicDecryptSingleValueFixture(): Promise<{ contract: PublicDecryptSingleValue }> {
  const signers = await ethers.getSigners();
  const contractFactory = await ethers.getContractFactory("PublicDecryptSingleValue");
  const contract = await contractFactory.connect(signers[0]).deploy();
  await contract.waitForDeployment();
  return { contract };
}
