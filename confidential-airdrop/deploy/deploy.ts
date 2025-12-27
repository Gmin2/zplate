import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer } = await hre.getNamedAccounts();
  const { deploy } = hre.deployments;

  const deployedConfidentialAirdrop = await deploy("ConfidentialAirdrop", {
    from: deployer,
    args: [
      1000, // airdrop amount per user
      86400, // duration (24 hours)
    ],
    log: true,
  });

  console.log(`ConfidentialAirdrop contract: `, deployedConfidentialAirdrop.address);
};
export default func;
func.id = "deploy_confidentialAirdrop"; // id required to prevent reexecution
func.tags = ["ConfidentialAirdrop"];
