
const { ethers } = require("hardhat");

async function main() {
    const uptimeMarket = await ethers.getContract("UptimeMarket");
    const market = await uptimeMarket.getMarket(1);
    const block = await ethers.provider.getBlock("latest");

    console.log("Monitoring End:", market.monitoringEndTime.toString());
    console.log("Current Block:", block.timestamp);

    if (block.timestamp > market.monitoringEndTime) {
        console.log("Monitoring window has PASSED.");
    } else {
        console.log("Monitoring window is ACTIVE.");
    }
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
