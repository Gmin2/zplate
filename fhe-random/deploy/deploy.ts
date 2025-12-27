import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer } = await hre.getNamedAccounts();
  const { deploy } = hre.deployments;

  const deployedFHERandom = await deploy("FHERandom", {
    from: deployer,
    log: true,
  });

  console.log(`FHERandom contract: `, deployedFHERandom.address);
};
export default func;
func.id = "deploy_fheRandom"; // id required to prevent reexecution
func.tags = ["FHERandom"];
