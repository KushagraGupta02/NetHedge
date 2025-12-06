import { ethers } from "hardhat";

async function main() {
  const uptimeMarket = await ethers.getContract("UptimeMarket");

  console.log("Creating test market...");
  console.log("Website: https://google.com");
  console.log("Betting Duration: 1 minute (60 seconds)");
  console.log("Monitoring Duration: 5 minutes (300 seconds)");

  const tx = await uptimeMarket.createMarket("https://google.com", 60, 300);
  const receipt = await tx.wait();

  console.log("✅ Market created!");

  const totalMarkets = await uptimeMarket.getTotalMarkets();
  const newMarketId = Number(totalMarkets) - 1;

  const market = await uptimeMarket.getMarket(newMarketId);
  console.log("\nMarket", newMarketId);
  console.log("  Status:", ["OPEN", "MONITORING", "RESOLVED", "CANCELLED"][market.status]);
  console.log("  Start:", new Date(Number(market.startTime) * 1000).toLocaleString());
  console.log("  Betting Ends:", new Date(Number(market.bettingEndTime) * 1000).toLocaleString());
  console.log("  Monitoring Ends:", new Date(Number(market.monitoringEndTime) * 1000).toLocaleString());

  console.log("\n🎯 You have 1 minute to place bets!");
  console.log("📊 Then oracle will monitor for 5 minutes");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
