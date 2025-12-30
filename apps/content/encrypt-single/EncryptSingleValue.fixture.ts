import { ethers } from "hardhat";
import type { EncryptSingleValue } from "../types";

export async function deployEncryptSingleValueFixture(): Promise<{ contract: EncryptSingleValue }> {
  const signers = await ethers.getSigners();
  const contractFactory = await ethers.getContractFactory("EncryptSingleValue");
  const contract = await contractFactory.connect(signers[0]).deploy();
  await contract.waitForDeployment();
  return { contract };
}
