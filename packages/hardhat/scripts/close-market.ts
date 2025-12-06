import { ethers } from "hardhat";

async function main() {
  const [owner] = await ethers.getSigners();
  const uptimeMarket = await ethers.getContract("UptimeMarket");

  console.log("Closing market 1...");

  const tx = await uptimeMarket.closeMarket(1);
  await tx.wait();

  console.log("Market 1 closed successfully!");

  const market = await uptimeMarket.getMarket(1);
  console.log("Market 1 status:", ["OPEN", "MONITORING", "RESOLVED", "CANCELLED"][market.status]);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
