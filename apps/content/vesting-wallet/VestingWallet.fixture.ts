import { ethers } from "hardhat";
import type { VestingWallet } from "../types";

export async function deployVestingWalletFixture(): Promise<{ contract: VestingWallet }> {
  const signers = await ethers.getSigners();
  const contractFactory = await ethers.getContractFactory("VestingWallet");
  const contract = await contractFactory.connect(signers[0]).deploy();
  await contract.waitForDeployment();
  return { contract };
}
