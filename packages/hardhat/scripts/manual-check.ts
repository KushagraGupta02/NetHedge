import { ethers } from "hardhat";

async function main() {
  const [owner] = await ethers.getSigners();
  const uptimeOracle = await ethers.getContract("UptimeOracle");

  console.log("Submitting manual uptime check for market 1...");
  console.log("Oracle address:", await uptimeOracle.getAddress());
  console.log("Signer:", owner.address);

  // Submit check: market 1, isUp=true, responseTime=100ms
  const tx = await uptimeOracle.submitUptimeCheck(1, true, 100);
  await tx.wait();

  console.log("✅ Uptime check submitted!");

  // Verify it was recorded
  const uptimeMarket = await ethers.getContract("UptimeMarket");
  const checks = await uptimeMarket.getUptimeChecks(1);
  console.log("Total checks for market 1:", checks.length);

  if (checks.length > 0) {
    console.log("Latest check:");
    console.log("  Timestamp:", new Date(Number(checks[checks.length - 1].timestamp) * 1000).toLocaleString());
    console.log("  Is Up:", checks[checks.length - 1].isUp);
    console.log("  Response Time:", checks[checks.length - 1].responseTime.toString(), "ms");
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
