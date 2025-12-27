import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer } = await hre.getNamedAccounts();
  const { deploy } = hre.deployments;

  const deployedDutchAuction = await deploy("DutchAuction", {
    from: deployer,
    args: [
      1000000, // totalTokens
      100, // startPrice
      10, // reservePrice
      1, // discountRate
      3600, // duration (1 hour)
    ],
    log: true,
  });

  console.log(`DutchAuction contract: `, deployedDutchAuction.address);
};
export default func;
func.id = "deploy_dutchAuction"; // id required to prevent reexecution
func.tags = ["DutchAuction"];
