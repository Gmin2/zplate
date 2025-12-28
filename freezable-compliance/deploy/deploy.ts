import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer } = await hre.getNamedAccounts();
  const { deploy } = hre.deployments;

  const deployedFreezableCompliance = await deploy("FreezableCompliance", {
    from: deployer,
    args: [deployer],
    log: true,
  });

  console.log(`FreezableCompliance contract: `, deployedFreezableCompliance.address);
};
export default func;
func.id = "deploy_freezableCompliance"; // id required to prevent reexecution
func.tags = ["FreezableCompliance"];
