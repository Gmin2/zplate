import { ethers } from "hardhat";

import type { FreezableCompliance } from "../types";
import { getSigners } from "./signers";

export async function deployFreezableComplianceFixture(): Promise<{
  contract: FreezableCompliance;
  complianceAuthority: string;
}> {
  const signers = await getSigners();

  const contractFactory = await ethers.getContractFactory("FreezableCompliance");
  const contract = await contractFactory
    .connect(signers.alice)
    .deploy(signers.alice.address);
  await contract.waitForDeployment();

  return { contract, complianceAuthority: signers.alice.address };
}
