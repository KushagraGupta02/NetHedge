
const { ethers } = require("hardhat");

async function main() {
    const [owner] = await ethers.getSigners();
    const uptimeMarket = await ethers.getContract("UptimeMarket");

    console.log(`Checking participation for: ${owner.address}`);

    const participatedMarkets = await uptimeMarket.getUserParticipatedMarkets(owner.address);
    console.log(`Participated Markets: ${participatedMarkets.map(id => id.toString()).join(", ")}`);

    if (participatedMarkets.length > 0) {
        console.log("✅ Data exists on contract.");
    } else {
        console.log("❌ No participation data found.");
    }
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
