import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer } = await hre.getNamedAccounts();
  const { deploy } = hre.deployments;

  const deployedConfidentialBank = await deploy("ConfidentialBank", {
    from: deployer,
    log: true,
  });

  console.log(`ConfidentialBank contract: `, deployedConfidentialBank.address);
};
export default func;
func.id = "deploy_confidentialBank"; // id required to prevent reexecution
func.tags = ["ConfidentialBank"];
