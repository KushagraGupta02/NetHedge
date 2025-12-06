import { ethers } from "hardhat";

async function main() {
  const uptimeMarket = await ethers.getContract("UptimeMarket");
  const totalMarkets = await uptimeMarket.getTotalMarkets();
  console.log("Total markets:", totalMarkets.toString(), "\n");

  const currentTime = Math.floor(Date.now() / 1000);

  for (let i = 0; i < Number(totalMarkets); i++) {
    const market = await uptimeMarket.getMarket(i);
    const bettingEndTime = Number(market.bettingEndTime);
    const monitoringEndTime = Number(market.monitoringEndTime);
    const timeUntilBettingEnds = bettingEndTime - currentTime;
    const timeUntilMonitoringEnds = monitoringEndTime - currentTime;

    console.log(`Market ${i}:`);
    console.log(`  Website: ${market.websiteUrl}`);
    console.log(`  Status: ${["OPEN", "MONITORING", "RESOLVED", "CANCELLED"][market.status]}`);
    console.log(`  Betting ends in: ${timeUntilBettingEnds > 0 ? Math.floor(timeUntilBettingEnds / 60) + " minutes" : "ENDED"}`);
    console.log(`  Monitoring ends in: ${timeUntilMonitoringEnds > 0 ? Math.floor(timeUntilMonitoringEnds / 60) + " minutes" : "ENDED"}`);

    const checks = await uptimeMarket.getUptimeChecks(i);
    console.log(`  Uptime checks: ${checks.length}`);
    console.log("");
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
