
const { ethers } = require("hardhat");

async function main() {
  const uptimeMarket = await ethers.getContract("UptimeMarket");
  const totalMarkets = await uptimeMarket.getTotalMarkets();
  const marketId = Number(totalMarkets) - 1;
  
  console.log(`Placing bet on Market ${marketId}...`);
  const tx = await uptimeMarket.placeBid(marketId, 0, { value: ethers.parseEther("1.0") });
  await tx.wait();
  
  console.log("✅ Bet placed!");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
