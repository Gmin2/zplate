import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer } = await hre.getNamedAccounts();
  const { deploy } = hre.deployments;

  const deployedConfidentialVoting = await deploy("ConfidentialVoting", {
    from: deployer,
    log: true,
  });

  console.log(`ConfidentialVoting contract: `, deployedConfidentialVoting.address);
};
export default func;
func.id = "deploy_confidentialVoting"; // id required to prevent reexecution
func.tags = ["ConfidentialVoting"];
