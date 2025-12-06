import { ethers } from "hardhat";

async function main() {
    const uptimeMarket = await ethers.getContract("UptimeMarket");

    console.log("Creating QUICK test market...");
    console.log("Website: https://google.com");
    console.log("Betting Duration: 60 seconds");
    console.log("Monitoring Duration: 300 seconds");

    const tx = await uptimeMarket.createMarket("https://google.com", 60, 300);
    await tx.wait();

    console.log("✅ Quick Market created!");

    const totalMarkets = await uptimeMarket.getTotalMarkets();
    const newMarketId = Number(totalMarkets) - 1;

    console.log(`\nMarket ID: ${newMarketId}`);
    console.log("Waiting 15 seconds for betting to end...");

    // Wait for betting to end
    await new Promise(resolve => setTimeout(resolve, 15000));

    // Trigger close market (usually done by monitor, but we can do it manually or wait for monitor)
    // The monitor script running in the background should pick this up.
    console.log("Check the monitor terminal for updates!");
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
