import { ethers } from "hardhat";
import type { ConfidentialBank } from "../types";

export async function deployConfidentialBankFixture(): Promise<{ contract: ConfidentialBank }> {
  const signers = await ethers.getSigners();
  const contractFactory = await ethers.getContractFactory("ConfidentialBank");
  const contract = await contractFactory.connect(signers[0]).deploy();
  await contract.waitForDeployment();
  return { contract };
}
