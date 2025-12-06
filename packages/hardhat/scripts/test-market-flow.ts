import { ethers } from "hardhat";
import { UptimeMarket, UptimeOracle } from "../typechain-types";

/**
 * Test script to demonstrate the full market flow:
 * 1. Create a market
 * 2. Place YES/NO bids
 * 3. Close market
 * 4. Resolve market
 * 5. Claim winnings
 */
async function main() {
  console.log("\n🚀 Starting Market Flow Test...\n");

  // Get signers
  const [owner, user1, user2, user3] = await ethers.getSigners();

  console.log("👥 Test Accounts:");
  console.log("  Owner:", owner.address);
  console.log("  User1:", user1.address);
  console.log("  User2:", user2.address);
  console.log("  User3:", user3.address);

  // Get deployed contracts
  const uptimeMarket = (await ethers.getContract("UptimeMarket", owner)) as UptimeMarket;
  const uptimeOracle = (await ethers.getContract("UptimeOracle", owner)) as UptimeOracle;

  console.log("\n📋 Deployed Contracts:");
  console.log("  UptimeMarket:", await uptimeMarket.getAddress());
  console.log("  UptimeOracle:", await uptimeOracle.getAddress());

  // Step 1: Check existing markets
  const totalMarkets = await uptimeMarket.getTotalMarkets();
  console.log("\n📊 Total Markets:", totalMarkets.toString());

  if (totalMarkets > 0n) {
    const market0 = await uptimeMarket.getMarket(0);
    console.log("\n🎯 Existing Market #0:");
    console.log("  URL:", market0.websiteUrl);
    console.log("  Status:", ["OPEN", "MONITORING", "RESOLVED", "CANCELLED"][market0.status]);
    console.log("  YES Pool:", ethers.formatEther(market0.yesPool), "ETH");
    console.log("  NO Pool:", ethers.formatEther(market0.noPool), "ETH");
  }

  // Step 2: Place bids on market #0
  console.log("\n💰 Placing Bids...");

  const bidAmount1 = ethers.parseEther("2");
  console.log("  User1 betting", ethers.formatEther(bidAmount1), "ETH on YES...");
  const tx1 = await uptimeMarket.connect(user1).placeBid(0, 0, { value: bidAmount1 }); // YES
  await tx1.wait();
  console.log("  ✅ User1 bid placed");

  const bidAmount2 = ethers.parseEther("1");
  console.log("  User2 betting", ethers.formatEther(bidAmount2), "ETH on NO...");
  const tx2 = await uptimeMarket.connect(user2).placeBid(0, 1, { value: bidAmount2 }); // NO
  await tx2.wait();
  console.log("  ✅ User2 bid placed");

  const bidAmount3 = ethers.parseEther("1.5");
  console.log("  User3 betting", ethers.formatEther(bidAmount3), "ETH on YES...");
  const tx3 = await uptimeMarket.connect(user3).placeBid(0, 0, { value: bidAmount3 }); // YES
  await tx3.wait();
  console.log("  ✅ User3 bid placed");

  // Step 3: Check updated market state
  const market = await uptimeMarket.getMarket(0);
  console.log("\n📊 Market State After Bids:");
  console.log("  YES Pool:", ethers.formatEther(market.yesPool), "ETH");
  console.log("  NO Pool:", ethers.formatEther(market.noPool), "ETH");
  console.log("  Total Pool:", ethers.formatEther(market.yesPool + market.noPool), "ETH");
  console.log("  Total Bids:", market.totalBids.toString());

  // Step 4: Get odds
  const odds = await uptimeMarket.getOdds(0);
  console.log("\n📈 Current Odds:");
  console.log("  YES:", (Number(odds.yesOdds) / 100).toFixed(2) + "%", "(" + (Number(odds.yesOdds) / 10000).toFixed(2) + "x)");
  console.log("  NO:", (Number(odds.noOdds) / 100).toFixed(2) + "%", "(" + (Number(odds.noOdds) / 10000).toFixed(2) + "x)");

  // Step 5: Check user bids
  console.log("\n👤 User Positions:");
  const user1Bids = await uptimeMarket.getUserBids(0, user1.address);
  console.log("  User1:", user1Bids.length, "bid(s) -", ethers.formatEther(bidAmount1), "ETH on YES");

  const user2Bids = await uptimeMarket.getUserBids(0, user2.address);
  console.log("  User2:", user2Bids.length, "bid(s) -", ethers.formatEther(bidAmount2), "ETH on NO");

  const user3Bids = await uptimeMarket.getUserBids(0, user3.address);
  console.log("  User3:", user3Bids.length, "bid(s) -", ethers.formatEther(bidAmount3), "ETH on YES");

  // Step 6: Calculate potential winnings
  console.log("\n💵 Potential Winnings (if you win):");

  const user1Potential = await uptimeMarket.calculatePotentialWinnings(0, 0, bidAmount1);
  console.log("  User1 (YES):");
  console.log("    Gross:", ethers.formatEther(user1Potential.grossWinnings), "ETH");
  console.log("    Net:", ethers.formatEther(user1Potential.netWinnings), "ETH");
  console.log("    ROI:", ((Number(user1Potential.netWinnings - bidAmount1) / Number(bidAmount1)) * 100).toFixed(2) + "%");

  const user2Potential = await uptimeMarket.calculatePotentialWinnings(0, 1, bidAmount2);
  console.log("  User2 (NO):");
  console.log("    Gross:", ethers.formatEther(user2Potential.grossWinnings), "ETH");
  console.log("    Net:", ethers.formatEther(user2Potential.netWinnings), "ETH");
  console.log("    ROI:", ((Number(user2Potential.netWinnings - bidAmount2) / Number(bidAmount2)) * 100).toFixed(2) + "%");

  // Step 7: Fast forward time to close market
  console.log("\n⏰ Fast-forwarding time to close betting period...");
  await ethers.provider.send("evm_increaseTime", [24 * 60 * 60 + 1]); // 24 hours + 1 second
  await ethers.provider.send("evm_mine", []);

  // Step 8: Close market
  console.log("🔒 Closing market...");
  const closeTx = await uptimeMarket.closeMarket(0);
  await closeTx.wait();
  console.log("  ✅ Market closed (status: MONITORING)");

  // Step 9: Oracle resolves market (YES wins - 99.5% uptime)
  console.log("\n🔮 Oracle resolving market...");
  const uptimePercentage = 9950; // 99.5% uptime (YES wins)
  const resolveTx = await uptimeOracle.reportUptime(0, uptimePercentage);
  await resolveTx.wait();
  console.log("  ✅ Market resolved with", uptimePercentage / 100, "% uptime (YES WINS)");

  const resolvedMarket = await uptimeMarket.getMarket(0);
  console.log("  Status:", ["OPEN", "MONITORING", "RESOLVED", "CANCELLED"][resolvedMarket.status]);
  console.log("  Outcome:", resolvedMarket.outcome ? "YES" : "NO");

  // Step 10: Winners claim
  console.log("\n💸 Claiming Winnings...");

  // User1 claims (YES winner)
  console.log("  User1 claiming...");
  const user1BalanceBefore = await ethers.provider.getBalance(user1.address);
  const claim1Tx = await uptimeMarket.connect(user1).claimWinnings(0);
  const claim1Receipt = await claim1Tx.wait();
  const user1BalanceAfter = await ethers.provider.getBalance(user1.address);
  const user1Gas = claim1Receipt!.gasUsed * claim1Receipt!.gasPrice;
  const user1Profit = user1BalanceAfter - user1BalanceBefore + user1Gas;
  console.log("    ✅ Claimed:", ethers.formatEther(user1Profit), "ETH");
  console.log("    Net profit:", ethers.formatEther(user1Profit - bidAmount1), "ETH");

  // User3 claims (YES winner)
  console.log("  User3 claiming...");
  const user3BalanceBefore = await ethers.provider.getBalance(user3.address);
  const claim3Tx = await uptimeMarket.connect(user3).claimWinnings(0);
  const claim3Receipt = await claim3Tx.wait();
  const user3BalanceAfter = await ethers.provider.getBalance(user3.address);
  const user3Gas = claim3Receipt!.gasUsed * claim3Receipt!.gasPrice;
  const user3Profit = user3BalanceAfter - user3BalanceBefore + user3Gas;
  console.log("    ✅ Claimed:", ethers.formatEther(user3Profit), "ETH");
  console.log("    Net profit:", ethers.formatEther(user3Profit - bidAmount3), "ETH");

  // User2 tries to claim (NO loser)
  console.log("  User2 trying to claim (should fail)...");
  try {
    await uptimeMarket.connect(user2).claimWinnings(0);
    console.log("    ❌ UNEXPECTED: User2 claimed (should have failed)");
  } catch (error: any) {
    console.log("    ✅ Correctly rejected:", error.message.split("(")[0].trim());
  }

  // Final summary
  console.log("\n📊 Final Summary:");
  console.log("  Total Pool:", ethers.formatEther(resolvedMarket.yesPool + resolvedMarket.noPool), "ETH");
  console.log("  YES Pool:", ethers.formatEther(resolvedMarket.yesPool), "ETH (WINNERS)");
  console.log("  NO Pool:", ethers.formatEther(resolvedMarket.noPool), "ETH (losers)");
  console.log("\n  Platform Fee Collected:", ethers.formatEther((user1Profit + user3Profit) * 200n / 10000n), "ETH (approx)");

  console.log("\n✅ Market Flow Test Complete!\n");
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
