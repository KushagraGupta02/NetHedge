
const { ethers } = require("hardhat");

async function main() {
  const uptimeMarket = await ethers.getContract("UptimeMarket");
  const marketId = 1;
  
  const market = await uptimeMarket.getMarket(marketId);
  console.log(`Market ${marketId} Status:`, market.status);
  
  const checks = await uptimeMarket.getUptimeChecks(marketId);
  console.log(`Market ${marketId} Checks:`, checks.length);
  
  if (checks.length > 0) {
      console.log("First check:", checks[0]);
      console.log("Last check:", checks[checks.length - 1]);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
