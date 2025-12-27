import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer } = await hre.getNamedAccounts();
  const { deploy } = hre.deployments;

  const deployedSealedAuction = await deploy("SealedAuction", {
    from: deployer,
    log: true,
  });

  console.log(`SealedAuction contract: `, deployedSealedAuction.address);
};
export default func;
func.id = "deploy_sealedAuction"; // id required to prevent reexecution
func.tags = ["SealedAuction"];
