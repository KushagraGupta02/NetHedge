import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { Contract } from "ethers";

/**
 * Deploys UptimeOracle and UptimeMarket contracts
 * Sets up the connections between them
 *
 * @param hre HardhatRuntimeEnvironment object.
 */
const deployUptimeContracts: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer } = await hre.getNamedAccounts();
  const { deploy } = hre.deployments;

  console.log("\n📡 Deploying Uptime Oracle...");

  // Deploy UptimeOracle first
  const uptimeOracleDeployment = await deploy("UptimeOracle", {
    from: deployer,
    args: [deployer],
    log: true,
    autoMine: true,
  });

  console.log("✅ UptimeOracle deployed at:", uptimeOracleDeployment.address);

  console.log("\n📊 Deploying Uptime Market...");

  // Deploy UptimeMarket
  const uptimeMarketDeployment = await deploy("UptimeMarket", {
    from: deployer,
    args: [deployer],
    log: true,
    autoMine: true,
  });

  console.log("✅ UptimeMarket deployed at:", uptimeMarketDeployment.address);

  // Get contract instances
  const uptimeOracle = await hre.ethers.getContract<Contract>("UptimeOracle", deployer);
  const uptimeMarket = await hre.ethers.getContract<Contract>("UptimeMarket", deployer);

  console.log("\n🔗 Connecting contracts...");

  // Set market contract address in oracle
  const setMarketTx = await uptimeOracle.setMarketContract(await uptimeMarket.getAddress());
  await setMarketTx.wait();
  console.log("✅ Oracle connected to Market");

  // Set oracle address in market
  const setOracleTx = await uptimeMarket.setOracleAddress(await uptimeOracle.getAddress());
  await setOracleTx.wait();
  console.log("✅ Market connected to Oracle");

  console.log("\n📋 Deployment Summary:");
  console.log("==========================================");
  console.log("UptimeOracle:", await uptimeOracle.getAddress());
  console.log("UptimeMarket:", await uptimeMarket.getAddress());
  console.log("Platform Fee:", await uptimeMarket.platformFeePercentage(), "basis points (2%)");
  console.log("Minimum Oracle Stake:", hre.ethers.formatEther(await uptimeOracle.MINIMUM_STAKE()), "ETH");
  console.log("Consensus Threshold:", await uptimeOracle.CONSENSUS_THRESHOLD(), "oracles");
  console.log("Max Uptime Variance:", await uptimeOracle.MAX_UPTIME_VARIANCE(), "basis points (1%)");
  console.log("Deployer/Owner:", deployer);
  console.log("==========================================\n");

  // Create a sample market for testing
  if (hre.network.name === "localhost" || hre.network.name === "hardhat") {
    console.log("🎯 Creating sample market for testing...");

    const bettingDuration = 24 * 60 * 60; // 24 hours for betting
    const monitoringDuration = 72 * 60 * 60; // 72 hours for monitoring
    const createMarketTx = await uptimeMarket.createMarket("https://example.com", bettingDuration, monitoringDuration);
    await createMarketTx.wait();

    const totalMarkets = await uptimeMarket.getTotalMarkets();
    console.log("✅ Sample market created! Total markets:", totalMarkets.toString());

    const market = await uptimeMarket.getMarket(0);
    console.log("\n📊 Sample Market Details:");
    console.log("  Market ID: 0");
    console.log("  Website:", market.websiteUrl);
    console.log("  Status:", ["OPEN", "MONITORING", "RESOLVED", "CANCELLED"][market.status]);
    console.log("  Start Time:", new Date(Number(market.startTime) * 1000).toLocaleString());
    console.log("  Betting Ends:", new Date(Number(market.bettingEndTime) * 1000).toLocaleString());
    console.log("  Monitoring Ends:", new Date(Number(market.monitoringEndTime) * 1000).toLocaleString());
    console.log("  Resolution By:", new Date(Number(market.resolutionTime) * 1000).toLocaleString());
  }
};

export default deployUptimeContracts;

deployUptimeContracts.tags = ["UptimeOracle", "UptimeMarket", "Uptime"];
