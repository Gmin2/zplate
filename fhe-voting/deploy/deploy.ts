import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer } = await hre.getNamedAccounts();
  const { deploy } = hre.deployments;

  const deployedFHEVoting = await deploy("FHEVoting", {
    from: deployer,
    log: true,
  });

  console.log(`FHEVoting contract: `, deployedFHEVoting.address);
};
export default func;
func.id = "deploy_fheVoting"; // id required to prevent reexecution
func.tags = ["FHEVoting"];
