import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer } = await hre.getNamedAccounts();
  const { deploy } = hre.deployments;

  const deployedVestingWallet = await deploy("VestingWallet", {
    from: deployer,
    log: true,
  });

  console.log(`VestingWallet contract: `, deployedVestingWallet.address);
};
export default func;
func.id = "deploy_vestingWallet"; // id required to prevent reexecution
func.tags = ["VestingWallet"];
