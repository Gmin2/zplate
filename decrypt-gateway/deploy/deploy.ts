import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer } = await hre.getNamedAccounts();
  const { deploy } = hre.deployments;

  const deployedPublicDecryptSingleValue = await deploy("PublicDecryptSingleValue", {
    from: deployer,
    log: true,
  });

  console.log(`PublicDecryptSingleValue contract: `, deployedPublicDecryptSingleValue.address);
};
export default func;
func.id = "deploy_publicDecryptSingleValue"; // id required to prevent reexecution
func.tags = ["PublicDecryptSingleValue"];
