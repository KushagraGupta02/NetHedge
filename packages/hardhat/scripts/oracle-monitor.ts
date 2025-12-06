import { ethers } from "hardhat";
import axios from "axios";

/**
 * Oracle Monitor Script
 * Automatically monitors markets and submits uptime checks
 */

const CHECK_INTERVAL = 5000; // Check every 5 seconds
const UPTIME_CHECK_INTERVAL = 5000; // Submit uptime check every 5 seconds

interface Market {
  id: bigint;
  websiteUrl: string;
  startTime: bigint;
  bettingEndTime: bigint;
  monitoringEndTime: bigint;
  resolutionTime: bigint;
  status: number;
  yesPool: bigint;
  noPool: bigint;
}

async function checkWebsiteUptime(url: string): Promise<{ isUp: boolean; responseTime: number }> {
  try {
    const startTime = Date.now();
    const response = await axios.get(url, {
      timeout: 10000, // 10 second timeout
      validateStatus: (status) => status < 500, // Consider 4xx as "up" (site exists but might have issues)
    });
    const responseTime = Date.now() - startTime;

    return {
      isUp: response.status < 500,
      responseTime,
    };
  } catch (error) {
    // If there's a network error or timeout, consider it down
    return {
      isUp: false,
      responseTime: 10000, // Max timeout
    };
  }
}

async function main() {
  console.log("🔍 Starting Oracle Monitor...\n");

  const [owner] = await ethers.getSigners();
  console.log("Oracle address:", owner.address);

  const uptimeMarket = await ethers.getContract("UptimeMarket");
  const uptimeOracle = await ethers.getContract("UptimeOracle");

  console.log("UptimeMarket:", await uptimeMarket.getAddress());
  console.log("UptimeOracle:", await uptimeOracle.getAddress());
  console.log("\n📊 Monitoring started...\n");

  // Check if we are a registered oracle
  const oracleInfo = await uptimeOracle.getOracleInfo(owner.address);
  if (!oracleInfo.isActive) {
    console.log("⚠️ Account is not a registered oracle. Registering now...");
    try {
      const minStake = await uptimeOracle.MINIMUM_STAKE();
      const tx = await uptimeOracle.registerOracle({ value: minStake });
      await tx.wait();
      console.log("✅ Successfully registered as oracle!");
    } catch (error: any) {
      console.error("❌ Failed to register as oracle:", error.message);
      return;
    }
  } else {
    console.log("✅ Account is already a registered oracle");
  }

  // Track last check time for each market
  const lastCheckTime: { [key: string]: number } = {};

  setInterval(async () => {
    try {
      const totalMarkets = await uptimeMarket.getTotalMarkets();
      const block = await ethers.provider.getBlock("latest");
      if (!block) {
        console.log("Waiting for block...");
        return;
      }
      const currentTime = block.timestamp;

      console.log(`\n[${new Date().toLocaleTimeString()}] Checking ${totalMarkets} markets...`);

      for (let i = 0; i < Number(totalMarkets); i++) {
        const market: Market = await uptimeMarket.getMarket(i);
        const marketId = Number(market.id);
        const bettingEndTime = Number(market.bettingEndTime);
        const monitoringEndTime = Number(market.monitoringEndTime);
        const resolutionTime = Number(market.resolutionTime);
        const status = Number(market.status);

        // Check if we need to close the betting period
        if (status === 0 && currentTime >= bettingEndTime) {
          console.log(`\n⏰ Market ${marketId}: Betting period ended, closing market...`);
          try {
            const tx = await uptimeMarket.closeMarket(marketId);
            await tx.wait();
            console.log(`✅ Market ${marketId}: Moved to MONITORING status`);
          } catch (error: any) {
            console.log(`❌ Market ${marketId}: Error closing market:`, error.message);
          }
        }

        // Check if market is in OPEN or MONITORING phase and needs uptime checks
        if ((status === 0 || status === 1) && currentTime < monitoringEndTime) {
          const lastCheck = lastCheckTime[marketId] || 0;
          const timeSinceLastCheck = Date.now() - lastCheck;

          console.log(`  Market ${marketId}: Status=MONITORING, lastCheck=${lastCheck}, timeSince=${Math.floor(timeSinceLastCheck / 1000)}s`);

          // Submit uptime check every UPTIME_CHECK_INTERVAL
          if (timeSinceLastCheck >= UPTIME_CHECK_INTERVAL) {
            console.log(`\n🌐 Market ${marketId}: Checking ${market.websiteUrl}...`);

            const { isUp, responseTime } = await checkWebsiteUptime(market.websiteUrl);

            console.log(`   Status: ${isUp ? "✅ UP" : "❌ DOWN"} | Response: ${responseTime}ms`);

            try {
              const tx = await uptimeOracle.submitUptimeCheck(marketId, isUp, responseTime);
              await tx.wait();
              console.log(`   ✅ Uptime check submitted to blockchain`);
              lastCheckTime[marketId] = Date.now();
            } catch (error: any) {
              console.log(`   ❌ Error submitting uptime check:`, error.message);
            }
          }
        }

        // Check if market monitoring period ended and needs resolution
        if (status === 1 && currentTime >= monitoringEndTime && currentTime <= resolutionTime) {
          console.log(`\n📊 Market ${marketId}: Monitoring period ended, calculating uptime...`);

          try {
            // Get all uptime checks
            const checks = await uptimeMarket.getUptimeChecks(marketId);

            if (checks.length === 0) {
              console.log(`   ⚠️ No uptime checks recorded, skipping resolution`);
              continue;
            }

            // Calculate uptime percentage
            // FILTER: Only count checks that happened AFTER betting ended (during monitoring period)
            const validChecks = checks.filter((check: any) => Number(check.timestamp) >= bettingEndTime);

            const totalChecks = validChecks.length;
            const successfulChecks = validChecks.filter((check: any) => check.isUp).length;
            const uptimePercentage = totalChecks > 0 ? Math.floor((successfulChecks / totalChecks) * 10000) : 0; // basis points

            console.log(`   Total Checks: ${totalChecks}`);
            console.log(`   Successful: ${successfulChecks}`);
            console.log(`   Uptime: ${(uptimePercentage / 100).toFixed(2)}%`);

            const tx = await uptimeOracle.reportUptime(marketId, uptimePercentage);
            await tx.wait();
            console.log(`   ✅ Market resolved!`);
          } catch (error: any) {
            console.log(`   ❌ Error resolving market:`, error.message);
          }
        }
      }
    } catch (error: any) {
      console.error("Error in monitoring loop:", error.message);
    }
  }, CHECK_INTERVAL);

  // Keep the script running
  console.log("Press Ctrl+C to stop monitoring\n");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
