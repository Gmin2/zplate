import { ethers } from "hardhat";
import type { ConfidentialERC20 } from "../types";

export async function deployConfidentialERC20Fixture(): Promise<{ contract: ConfidentialERC20 }> {
  const signers = await ethers.getSigners();
  const contractFactory = await ethers.getContractFactory("ConfidentialERC20");
  const contract = await contractFactory.connect(signers[0]).deploy("Confidential Token", "CTKN", 18);
  await contract.waitForDeployment();
  return { contract };
}
