import { ethers } from "hardhat";

async function main() {
  const uptimeMarket = await ethers.getContract("UptimeMarket");
  const totalMarkets = await uptimeMarket.getTotalMarkets();
  console.log("Total markets:", totalMarkets.toString());

  if (Number(totalMarkets) > 0) {
    const market = await uptimeMarket.getMarket(0);
    console.log("\nMarket 0:");
    console.log("  Website:", market.websiteUrl);
    console.log("  Status:", market.status, ["OPEN", "MONITORING", "RESOLVED", "CANCELLED"][market.status]);
    console.log("  Betting End Time:", new Date(Number(market.bettingEndTime) * 1000).toLocaleString());
    console.log("  Monitoring End Time:", new Date(Number(market.monitoringEndTime) * 1000).toLocaleString());
    console.log("  Current Time:", new Date().toLocaleString());

    const currentTime = Math.floor(Date.now() / 1000);
    const bettingEndTime = Number(market.bettingEndTime);
    const timeUntilBettingEnds = bettingEndTime - currentTime;

    console.log("\n  Current timestamp:", currentTime);
    console.log("  Betting ends timestamp:", bettingEndTime);
    console.log("  Time until betting ends:", timeUntilBettingEnds, "seconds");

    if (timeUntilBettingEnds < 0) {
      console.log("\n  ⚠️ Betting period has ENDED!");
    } else {
      console.log("\n  ✅ Betting period is ACTIVE");
    }

    // Check uptime checks
    const checks = await uptimeMarket.getUptimeChecks(0);
    console.log("\n  Total uptime checks:", checks.length);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
