import { ethers } from "hardhat";
import type { UserDecryptSingleValue } from "../types";

export async function deployUserDecryptSingleValueFixture(): Promise<{ contract: UserDecryptSingleValue }> {
  const signers = await ethers.getSigners();
  const contractFactory = await ethers.getContractFactory("UserDecryptSingleValue");
  const contract = await contractFactory.connect(signers[0]).deploy();
  await contract.waitForDeployment();
  return { contract };
}
