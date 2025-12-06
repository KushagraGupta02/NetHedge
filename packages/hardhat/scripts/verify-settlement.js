const { ethers } = require("hardhat");

async function main() {
    const [owner, userA, userB, userC] = await ethers.getSigners();
    const uptimeMarket = await ethers.getContract("UptimeMarket");
  
    const oracleAddress = await uptimeMarket.oracleAddress();
    console.log(`Market's Oracle Address: ${oracleAddress}`);
  
    const uptimeOracle = await ethers.getContractAt("UptimeOracle", oracleAddress);

    console.log("Creating Verification Market...");
  
  // Verify Oracle Config
  const oracleMarketAddress = await uptimeOracle.marketContract();
  const actualMarketAddress = await uptimeMarket.getAddress();
  console.log(`Oracle Market Address: ${oracleMarketAddress}`);
  console.log(`Actual Market Address: ${actualMarketAddress}`);
  
  if (oracleMarketAddress !== actualMarketAddress) {
      console.log("⚠️ Oracle market address mismatch! Updating...");
      await uptimeOracle.setMarketContract(actualMarketAddress);
  }

  // Create market: 60s betting, 120s monitoring
    const tx = await uptimeMarket.createMarket("https://verify-settlement.com", 60, 120);
    await tx.wait();

    const totalMarkets = await uptimeMarket.getTotalMarkets();
    const marketId = Number(totalMarkets) - 1;
    console.log(`Market ID: ${marketId}`);

    // User A bets 10 ETH on YES
    console.log("User A betting 10 ETH on YES...");
    await uptimeMarket.connect(userA).placeBid(marketId, 0, { value: ethers.parseEther("10") });

    // User B bets 30 ETH on YES
    console.log("User B betting 30 ETH on YES...");
    await uptimeMarket.connect(userB).placeBid(marketId, 0, { value: ethers.parseEther("30") });

    // User C bets 60 ETH on NO
    console.log("User C betting 60 ETH on NO...");
    await uptimeMarket.connect(userC).placeBid(marketId, 1, { value: ethers.parseEther("60") });

    const market = await uptimeMarket.getMarket(marketId);
    console.log(`YES Pool: ${ethers.formatEther(market.yesPool)} ETH`);
    console.log(`NO Pool: ${ethers.formatEther(market.noPool)} ETH`);
    console.log(`Total Pool: ${ethers.formatEther(market.yesPool + market.noPool)} ETH`);

    console.log("Advancing time by 65 seconds...");
    await ethers.provider.send("evm_increaseTime", [65]);
    await ethers.provider.send("evm_mine");

    console.log("Closing market...");
    await uptimeMarket.closeMarket(marketId);

    console.log("Resolving market (YES Wins)...");
  // Advance time past monitoring period
  console.log("Advancing time by 130 seconds...");
  await ethers.provider.send("evm_increaseTime", [130]);
  await ethers.provider.send("evm_mine");

  // Resolve with 100% uptime (YES wins)
  await uptimeOracle.reportUptime(marketId, 10000);

    // Check balances before claim
    const balanceA_Before = await ethers.provider.getBalance(userA.address);
    const balanceB_Before = await ethers.provider.getBalance(userB.address);
    const balanceC_Before = await ethers.provider.getBalance(userC.address);

    console.log("Claiming winnings...");
    await uptimeMarket.connect(userA).claimWinnings(marketId);
    await uptimeMarket.connect(userB).claimWinnings(marketId);

    try {
        await uptimeMarket.connect(userC).claimWinnings(marketId);
    } catch (e) {
        console.log("User C failed to claim (Expected, as they lost)");
    }

    const balanceA_After = await ethers.provider.getBalance(userA.address);
    const balanceB_After = await ethers.provider.getBalance(userB.address);

    const diffA = Number(ethers.formatEther(balanceA_After - balanceA_Before));
    const diffB = Number(ethers.formatEther(balanceB_After - balanceB_Before));

    console.log(`User A Winnings: ~${diffA} ETH (Expected ~24.5 ETH after 2% fee)`);
    console.log(`User B Winnings: ~${diffB} ETH (Expected ~73.5 ETH after 2% fee)`);

    // Expected Calculation:
    // Total Pool: 100 ETH
    // Winning Pool (YES): 40 ETH
    // User A Share: 10/40 = 25% of Total Pool = 25 ETH
    // User B Share: 30/40 = 75% of Total Pool = 75 ETH
    // Platform Fee: 2%
    // User A Net: 25 * 0.98 = 24.5 ETH
    // User B Net: 75 * 0.98 = 73.5 ETH

    if (Math.abs(diffA - 24.5) < 0.1 && Math.abs(diffB - 73.5) < 0.1) {
        console.log("✅ Settlement Logic Verified!");
    } else {
        console.log("❌ Settlement Logic Failed!");
    }
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
