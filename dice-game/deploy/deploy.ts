import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer } = await hre.getNamedAccounts();
  const { deploy } = hre.deployments;

  const deployedDiceGame = await deploy("DiceGame", {
    from: deployer,
    log: true,
  });

  console.log(`DiceGame contract: `, deployedDiceGame.address);
};
export default func;
func.id = "deploy_diceGame"; // id required to prevent reexecution
func.tags = ["DiceGame"];
