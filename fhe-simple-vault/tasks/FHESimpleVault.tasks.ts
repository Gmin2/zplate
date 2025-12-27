import { task } from "hardhat/config";



/**
 * Task: confidentialProtocolId
 * Call confidentialProtocolId function on FHESimpleVault
 */
task("fhesimplevault:confidentialProtocolId", "Call confidentialProtocolId function on FHESimpleVault")
  .setAction(async function(taskArgs, hre) {
    const { ethers, deployments } = hre;

    const deployment = await deployments.get("FHESimpleVault");
    const signers = await ethers.getSigners();
    const contract = await ethers.getContractAt("FHESimpleVault", deployment.address);

    // Call view function
    const result = await contract.confidentialProtocolId();

    console.log('');
    console.log('\x1b[32m✓\x1b[0m  \x1b[1mconfidentialProtocolId\x1b[0m');
    console.log('\x1b[2m|  Result: ' + result + '\x1b[0m');
    console.log('');

    return result;
  });


/**
 * Task: deposit
 * Call deposit function on FHESimpleVault
 */
task("fhesimplevault:deposit", "Call deposit function on FHESimpleVault")
  .addParam("inputamount", "euint32 value (will be encrypted)")
  .setAction(async function(taskArgs, hre) {
    const { ethers, deployments, fhevm } = hre;

    await fhevm.initializeCLIApi();

    const deployment = await deployments.get("FHESimpleVault");
    const signers = await ethers.getSigners();
    const contract = await ethers.getContractAt("FHESimpleVault", deployment.address);

    // Encrypt external inputs
    const encrypted = await fhevm
      .createEncryptedInput(deployment.address, await signers[0].getAddress())
      .add32(taskArgs.inputamount)
      .encrypt();

    // Send transaction
    const tx = await contract.deposit(encrypted.handles[0], encrypted.inputProof);

    const receipt = await tx.wait();

    console.log('');
    console.log('\x1b[32m✓\x1b[0m  \x1b[1mTransaction confirmed\x1b[0m');
    console.log('\x1b[2m|  Tx:    ' + tx.hash.slice(0, 10) + '...' + tx.hash.slice(-8) + '\x1b[0m');
    console.log('\x1b[2m|  Block: ' + receipt.blockNumber + '\x1b[0m');
    console.log('\x1b[2m|  Gas:   ' + receipt.gasUsed.toString() + '\x1b[0m');
    console.log('');

    return receipt;
  });


/**
 * Task: getBalance
 * Call getBalance function on FHESimpleVault
 */
task("fhesimplevault:getBalance", "Call getBalance function on FHESimpleVault")
  .setAction(async function(taskArgs, hre) {
    const { ethers, deployments } = hre;

    const deployment = await deployments.get("FHESimpleVault");
    const signers = await ethers.getSigners();
    const contract = await ethers.getContractAt("FHESimpleVault", deployment.address);

    // Call view function
    const result = await contract.getBalance();

    console.log('');
    console.log('\x1b[32m✓\x1b[0m  \x1b[1mgetBalance\x1b[0m');
    console.log('\x1b[2m|  Result: ' + result + '\x1b[0m');
    console.log('');

    return result;
  });


/**
 * Task: fhesimplevault:decrypt-getBalance
 * Get and decrypt getBalance from FHESimpleVault
 */
task("fhesimplevault:decrypt-getBalance", "Get and decrypt getBalance from FHESimpleVault")
  .setAction(async function(taskArgs, hre) {
    const { ethers, deployments, fhevm } = hre;

    await fhevm.initializeCLIApi();

    const deployment = await deployments.get("FHESimpleVault");
    const signers = await ethers.getSigners();
    const contract = await ethers.getContractAt("FHESimpleVault", deployment.address);

    const encryptedValue = await contract.getBalance();

    if (encryptedValue === ethers.ZeroHash) {
      console.log('');
      console.log('\x1b[32m✓\x1b[0m  \x1b[1mgetBalance (decrypted)\x1b[0m');
      console.log('\x1b[2m|  Value: 0\x1b[0m');
      console.log('');
      return 0;
    }

    const decryptedValue = await fhevm.userDecryptEuint(
      4, // euint32
      encryptedValue,
      deployment.address,
      signers[0]
    );

    console.log('');
    console.log('\x1b[32m✓\x1b[0m  \x1b[1mgetBalance (decrypted)\x1b[0m');
    console.log('\x1b[2m|  Value: ' + decryptedValue + '\x1b[0m');
    console.log('');

    return decryptedValue;
  });


/**
 * Task: getBalanceOf
 * Call getBalanceOf function on FHESimpleVault
 */
task("fhesimplevault:getBalanceOf", "Call getBalanceOf function on FHESimpleVault")
  .addParam("user", "address value")
  .setAction(async function(taskArgs, hre) {
    const { ethers, deployments } = hre;

    const deployment = await deployments.get("FHESimpleVault");
    const signers = await ethers.getSigners();
    const contract = await ethers.getContractAt("FHESimpleVault", deployment.address);

    // Call view function
    const result = await contract.getBalanceOf(taskArgs.user);

    console.log('');
    console.log('\x1b[32m✓\x1b[0m  \x1b[1mgetBalanceOf\x1b[0m');
    console.log('\x1b[2m|  Result: ' + result + '\x1b[0m');
    console.log('');

    return result;
  });


/**
 * Task: fhesimplevault:decrypt-getBalanceOf
 * Get and decrypt getBalanceOf from FHESimpleVault
 */
task("fhesimplevault:decrypt-getBalanceOf", "Get and decrypt getBalanceOf from FHESimpleVault")
  .setAction(async function(taskArgs, hre) {
    const { ethers, deployments, fhevm } = hre;

    await fhevm.initializeCLIApi();

    const deployment = await deployments.get("FHESimpleVault");
    const signers = await ethers.getSigners();
    const contract = await ethers.getContractAt("FHESimpleVault", deployment.address);

    const encryptedValue = await contract.getBalanceOf();

    if (encryptedValue === ethers.ZeroHash) {
      console.log('');
      console.log('\x1b[32m✓\x1b[0m  \x1b[1mgetBalanceOf (decrypted)\x1b[0m');
      console.log('\x1b[2m|  Value: 0\x1b[0m');
      console.log('');
      return 0;
    }

    const decryptedValue = await fhevm.userDecryptEuint(
      4, // euint32
      encryptedValue,
      deployment.address,
      signers[0]
    );

    console.log('');
    console.log('\x1b[32m✓\x1b[0m  \x1b[1mgetBalanceOf (decrypted)\x1b[0m');
    console.log('\x1b[2m|  Value: ' + decryptedValue + '\x1b[0m');
    console.log('');

    return decryptedValue;
  });


/**
 * Task: withdraw
 * Call withdraw function on FHESimpleVault
 */
task("fhesimplevault:withdraw", "Call withdraw function on FHESimpleVault")
  .addParam("inputamount", "euint32 value (will be encrypted)")
  .setAction(async function(taskArgs, hre) {
    const { ethers, deployments, fhevm } = hre;

    await fhevm.initializeCLIApi();

    const deployment = await deployments.get("FHESimpleVault");
    const signers = await ethers.getSigners();
    const contract = await ethers.getContractAt("FHESimpleVault", deployment.address);

    // Encrypt external inputs
    const encrypted = await fhevm
      .createEncryptedInput(deployment.address, await signers[0].getAddress())
      .add32(taskArgs.inputamount)
      .encrypt();

    // Send transaction
    const tx = await contract.withdraw(encrypted.handles[0], encrypted.inputProof);

    const receipt = await tx.wait();

    console.log('');
    console.log('\x1b[32m✓\x1b[0m  \x1b[1mTransaction confirmed\x1b[0m');
    console.log('\x1b[2m|  Tx:    ' + tx.hash.slice(0, 10) + '...' + tx.hash.slice(-8) + '\x1b[0m');
    console.log('\x1b[2m|  Block: ' + receipt.blockNumber + '\x1b[0m');
    console.log('\x1b[2m|  Gas:   ' + receipt.gasUsed.toString() + '\x1b[0m');
    console.log('');

    return receipt;
  });
