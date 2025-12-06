
const { ethers } = require("hardhat");

async function main() {
    const uptimeOracle = await ethers.getContract("UptimeOracle");
    // Resolve with 0% uptime since no checks
    const tx = await uptimeOracle.reportUptime(1, 0);
    await tx.wait();
    console.log("Market 1 resolved.");
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
