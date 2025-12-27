import { ethers } from "hardhat";
import type { EncryptMultipleValues } from "../types";

export async function deployEncryptMultipleValuesFixture(): Promise<{ contract: EncryptMultipleValues }> {
  const signers = await ethers.getSigners();
  const contractFactory = await ethers.getContractFactory("EncryptMultipleValues");
  const contract = await contractFactory.connect(signers[0]).deploy();
  await contract.waitForDeployment();
  return { contract };
}
