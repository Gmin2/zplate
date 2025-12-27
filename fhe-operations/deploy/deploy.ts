import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer } = await hre.getNamedAccounts();
  const { deploy } = hre.deployments;

  const deployedFHEOperations = await deploy("FHEOperations", {
    from: deployer,
    log: true,
  });

  console.log(`FHEOperations contract: `, deployedFHEOperations.address);
};
export default func;
func.id = "deploy_fheOperations"; // id required to prevent reexecution
func.tags = ["FHEOperations"];
