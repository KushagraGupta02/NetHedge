import { expect } from "chai";
import { ethers } from "hardhat";
import { UptimeMarket, UptimeOracle } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { time } from "@nomicfoundation/hardhat-network-helpers";

describe("Multi-Oracle Consensus & Slashing", function () {
  let uptimeMarket: UptimeMarket;
  let uptimeOracle: UptimeOracle;
  let owner: SignerWithAddress;
  let oracle1: SignerWithAddress;
  let oracle2: SignerWithAddress;
  let oracle3: SignerWithAddress;
  let oracle4: SignerWithAddress;
  let oracle5: SignerWithAddress;
  let user1: SignerWithAddress;
  let user2: SignerWithAddress;

  const WEBSITE_URL = "https://example.com";
  const BETTING_DURATION = 60 * 60; // 1 hour
  const MONITORING_DURATION = 2 * 60 * 60; // 2 hours
  const MINIMUM_STAKE = ethers.parseEther("0.1");
  const ORACLE_STAKE = ethers.parseEther("1");

  beforeEach(async () => {
    [owner, oracle1, oracle2, oracle3, oracle4, oracle5, user1, user2] = await ethers.getSigners();

    // Deploy UptimeOracle
    const UptimeOracleFactory = await ethers.getContractFactory("UptimeOracle");
    uptimeOracle = await UptimeOracleFactory.deploy(owner.address);
    await uptimeOracle.waitForDeployment();

    // Deploy UptimeMarket
    const UptimeMarketFactory = await ethers.getContractFactory("UptimeMarket");
    uptimeMarket = await UptimeMarketFactory.deploy(owner.address);
    await uptimeMarket.waitForDeployment();

    // Connect contracts
    await uptimeMarket.setOracleAddress(await uptimeOracle.getAddress());
    await uptimeOracle.setMarketContract(await uptimeMarket.getAddress());

    // Register 5 oracles
    await uptimeOracle.connect(oracle1).registerOracle({ value: ORACLE_STAKE });
    await uptimeOracle.connect(oracle2).registerOracle({ value: ORACLE_STAKE });
    await uptimeOracle.connect(oracle3).registerOracle({ value: ORACLE_STAKE });
    await uptimeOracle.connect(oracle4).registerOracle({ value: ORACLE_STAKE });
    await uptimeOracle.connect(oracle5).registerOracle({ value: ORACLE_STAKE });
  });

  describe("Oracle Registration", () => {
    it("Should register oracle with minimum stake", async () => {
      const newOracle = user1;
      await expect(uptimeOracle.connect(newOracle).registerOracle({ value: MINIMUM_STAKE }))
        .to.emit(uptimeOracle, "OracleRegistered")
        .withArgs(newOracle.address, MINIMUM_STAKE);

      const oracleInfo = await uptimeOracle.getOracleInfo(newOracle.address);
      expect(oracleInfo.isActive).to.equal(true);
      expect(oracleInfo.stake).to.equal(MINIMUM_STAKE);
    });

    it("Should fail to register with insufficient stake", async () => {
      await expect(
        uptimeOracle.connect(user1).registerOracle({ value: ethers.parseEther("0.05") })
      ).to.be.revertedWith("Insufficient stake");
    });

    it("Should fail to register twice", async () => {
      await expect(
        uptimeOracle.connect(oracle1).registerOracle({ value: ORACLE_STAKE })
      ).to.be.revertedWith("Already registered");
    });

    it("Should allow increasing stake", async () => {
      const additionalStake = ethers.parseEther("0.5");
      await uptimeOracle.connect(oracle1).increaseStake({ value: additionalStake });

      const oracleInfo = await uptimeOracle.getOracleInfo(oracle1.address);
      expect(oracleInfo.stake).to.equal(ORACLE_STAKE + additionalStake);
    });

    it("Should track all registered oracles", async () => {
      const activeOracles = await uptimeOracle.getActiveOracles();
      expect(activeOracles.length).to.equal(5);
      expect(activeOracles).to.include(oracle1.address);
      expect(activeOracles).to.include(oracle2.address);
      expect(activeOracles).to.include(oracle3.address);
      expect(activeOracles).to.include(oracle4.address);
      expect(activeOracles).to.include(oracle5.address);
    });
  });

  describe("Consensus Mechanism", () => {
    let marketId: number;

    beforeEach(async () => {
      // Create market
      await uptimeMarket.createMarket(WEBSITE_URL, BETTING_DURATION, MONITORING_DURATION);
      marketId = 0;

      // Place bets
      await uptimeMarket.connect(user1).placeBid(marketId, 0, { value: ethers.parseEther("2") }); // YES
      await uptimeMarket.connect(user2).placeBid(marketId, 1, { value: ethers.parseEther("1") }); // NO

      // Close market and enter monitoring
      await time.increase(BETTING_DURATION + 1);
      await uptimeMarket.closeMarket(marketId);
    });

    it("Should reach consensus with 3 matching reports", async () => {
      const uptime = 9900; // 99%

      // Three oracles report the same value
      await uptimeOracle.connect(oracle1).reportUptime(marketId, uptime);
      await uptimeOracle.connect(oracle2).reportUptime(marketId, uptime);

      // Third report should trigger consensus
      await expect(uptimeOracle.connect(oracle3).reportUptime(marketId, uptime))
        .to.emit(uptimeOracle, "ConsensusReached")
        .withArgs(marketId, uptime, 3, 3);

      const market = await uptimeMarket.getMarket(marketId);
      expect(market.status).to.equal(2); // RESOLVED
      expect(market.uptimePercentage).to.equal(uptime);
      expect(market.outcome).to.equal(true); // YES wins
    });

    it("Should handle 5 oracles with 3-2 split", async () => {
      const uptime1 = 9900; // 99% - majority
      const uptime2 = 9800; // 98% - minority

      // 3 oracles vote for 99%
      await uptimeOracle.connect(oracle1).reportUptime(marketId, uptime1);
      await uptimeOracle.connect(oracle2).reportUptime(marketId, uptime1);
      await uptimeOracle.connect(oracle3).reportUptime(marketId, uptime1);

      // Market should be resolved with consensus
      const market = await uptimeMarket.getMarket(marketId);
      expect(market.status).to.equal(2); // RESOLVED
      expect(market.uptimePercentage).to.equal(uptime1);

      // Remaining oracles try to report (should fail - already resolved)
      await expect(
        uptimeOracle.connect(oracle4).reportUptime(marketId, uptime2)
      ).to.be.revertedWith("Market already resolved");
    });

    it("Should use median if no consensus reached before deadline", async () => {
      // All oracles report different values
      await uptimeOracle.connect(oracle1).reportUptime(marketId, 9500);
      await uptimeOracle.connect(oracle2).reportUptime(marketId, 9700);
      await uptimeOracle.connect(oracle3).reportUptime(marketId, 9900);

      // Fast forward past deadline
      await time.increase(31 * 60); // 31 minutes

      // Finalize with median
      await expect(uptimeOracle.finalizeConsensus(marketId))
        .to.emit(uptimeOracle, "ConsensusReached");

      const consensus = await uptimeOracle.getMarketConsensus(marketId);
      expect(consensus.resolved).to.equal(true);
      expect(consensus.finalUptime).to.equal(9700); // Median of [9500, 9700, 9900]
    });

    it("Should calculate median correctly with even number of reports", async () => {
      await uptimeOracle.connect(oracle1).reportUptime(marketId, 9400);
      await uptimeOracle.connect(oracle2).reportUptime(marketId, 9600);
      await uptimeOracle.connect(oracle3).reportUptime(marketId, 9800);
      await uptimeOracle.connect(oracle4).reportUptime(marketId, 10000);

      await time.increase(31 * 60);
      await uptimeOracle.finalizeConsensus(marketId);

      const consensus = await uptimeOracle.getMarketConsensus(marketId);
      // Median of [9400, 9600, 9800, 10000] = (9600 + 9800) / 2 = 9700
      expect(consensus.finalUptime).to.equal(9700);
    });

    it("Should prevent reporting after deadline", async () => {
      await uptimeOracle.connect(oracle1).reportUptime(marketId, 9900);

      // Fast forward past deadline
      await time.increase(31 * 60);

      await expect(
        uptimeOracle.connect(oracle2).reportUptime(marketId, 9900)
      ).to.be.revertedWith("Report deadline passed");
    });

    it("Should prevent duplicate reports from same oracle", async () => {
      await uptimeOracle.connect(oracle1).reportUptime(marketId, 9900);

      await expect(
        uptimeOracle.connect(oracle1).reportUptime(marketId, 9900)
      ).to.be.revertedWith("Already reported for this market");
    });

    it("Should track report deadline correctly", async () => {
      const txTime = await time.latest();
      await uptimeOracle.connect(oracle1).reportUptime(marketId, 9900);

      const consensus = await uptimeOracle.getMarketConsensus(marketId);
      expect(consensus.reportDeadline).to.be.closeTo(
        BigInt(txTime + 1 + 30 * 60),
        BigInt(5)
      );
    });
  });

  describe("Slashing Mechanism", () => {
    let marketId: number;

    beforeEach(async () => {
      await uptimeMarket.createMarket(WEBSITE_URL, BETTING_DURATION, MONITORING_DURATION);
      marketId = 0;

      await uptimeMarket.connect(user1).placeBid(marketId, 0, { value: ethers.parseEther("2") });
      await uptimeMarket.connect(user2).placeBid(marketId, 1, { value: ethers.parseEther("1") });

      await time.increase(BETTING_DURATION + 1);
      await uptimeMarket.closeMarket(marketId);
    });

    it("Should slash oracle reporting significantly different uptime", async () => {
      const consensusUptime = 9900; // 99%
      const wrongUptime = 9700; // 97% - 2% difference = 200 basis points

      // 3 oracles report correct value
      await uptimeOracle.connect(oracle1).reportUptime(marketId, consensusUptime);
      await uptimeOracle.connect(oracle2).reportUptime(marketId, consensusUptime);

      const oracle4Before = await uptimeOracle.getOracleInfo(oracle4.address);

      // Oracle 4 reports wrong value (>1% variance)
      await uptimeOracle.connect(oracle4).reportUptime(marketId, wrongUptime);

      // Oracle 3 triggers consensus
      await expect(uptimeOracle.connect(oracle3).reportUptime(marketId, consensusUptime))
        .to.emit(uptimeOracle, "OracleSlashed")
        .withArgs(oracle4.address, marketId, ORACLE_STAKE / 10n, wrongUptime, consensusUptime);

      const oracle4After = await uptimeOracle.getOracleInfo(oracle4.address);

      // Oracle should be slashed 10% of stake
      expect(oracle4After.slashedAmount).to.equal(ORACLE_STAKE / 10n);
      expect(oracle4After.stake).to.equal(oracle4Before.stake - ORACLE_STAKE / 10n);
    });

    it("Should NOT slash oracle within acceptable variance (1%)", async () => {
      const consensusUptime = 9900; // 99%
      const closeUptime = 9950; // 99.5% - only 0.5% difference = 50 basis points

      await uptimeOracle.connect(oracle1).reportUptime(marketId, consensusUptime);
      await uptimeOracle.connect(oracle2).reportUptime(marketId, consensusUptime);
      await uptimeOracle.connect(oracle4).reportUptime(marketId, closeUptime); // Within variance

      const oracle4Before = await uptimeOracle.getOracleInfo(oracle4.address);

      await uptimeOracle.connect(oracle3).reportUptime(marketId, consensusUptime);

      const oracle4After = await uptimeOracle.getOracleInfo(oracle4.address);

      // Should NOT be slashed (within 1% tolerance)
      expect(oracle4After.slashedAmount).to.equal(0);
      expect(oracle4After.stake).to.equal(oracle4Before.stake);
      expect(oracle4After.correctReports).to.equal(oracle4Before.correctReports + 1n);
    });

    it("Should track correct vs incorrect reports", async () => {
      const consensusUptime = 9900;

      await uptimeOracle.connect(oracle1).reportUptime(marketId, consensusUptime);
      await uptimeOracle.connect(oracle2).reportUptime(marketId, consensusUptime);
      await uptimeOracle.connect(oracle3).reportUptime(marketId, consensusUptime);

      const oracle1Info = await uptimeOracle.getOracleInfo(oracle1.address);
      expect(oracle1Info.reportsSubmitted).to.equal(1);
      expect(oracle1Info.correctReports).to.equal(1);
      expect(oracle1Info.accuracy).to.equal(10000); // 100%
    });

    it("Should slash multiple incorrect oracles", async () => {
      const consensusUptime = 9900;
      const wrongUptime = 9500; // 4% off

      // 3 correct reports
      await uptimeOracle.connect(oracle1).reportUptime(marketId, consensusUptime);
      await uptimeOracle.connect(oracle2).reportUptime(marketId, consensusUptime);

      // 2 wrong reports
      await uptimeOracle.connect(oracle4).reportUptime(marketId, wrongUptime);
      await uptimeOracle.connect(oracle5).reportUptime(marketId, wrongUptime);

      // Trigger consensus
      await uptimeOracle.connect(oracle3).reportUptime(marketId, consensusUptime);

      const oracle4Info = await uptimeOracle.getOracleInfo(oracle4.address);
      const oracle5Info = await uptimeOracle.getOracleInfo(oracle5.address);

      // Both should be slashed
      expect(oracle4Info.slashedAmount).to.equal(ORACLE_STAKE / 10n);
      expect(oracle5Info.slashedAmount).to.equal(ORACLE_STAKE / 10n);
    });

    it("Should transfer slashed funds to owner", async () => {
      const consensusUptime = 9900;
      const wrongUptime = 9700;

      const ownerBalanceBefore = await ethers.provider.getBalance(owner.address);

      await uptimeOracle.connect(oracle1).reportUptime(marketId, consensusUptime);
      await uptimeOracle.connect(oracle2).reportUptime(marketId, consensusUptime);
      await uptimeOracle.connect(oracle4).reportUptime(marketId, wrongUptime);
      await uptimeOracle.connect(oracle3).reportUptime(marketId, consensusUptime);

      const ownerBalanceAfter = await ethers.provider.getBalance(owner.address);

      // Owner should receive slashed amount
      expect(ownerBalanceAfter - ownerBalanceBefore).to.equal(ORACLE_STAKE / 10n);
    });
  });

  describe("Oracle Deregistration", () => {
    it("Should allow oracle to deregister and withdraw stake", async () => {
      // Use a fresh oracle that hasn't participated in any markets
      const freshOracle = user1;
      await uptimeOracle.connect(freshOracle).registerOracle({ value: ORACLE_STAKE });

      const balanceBefore = await ethers.provider.getBalance(freshOracle.address);

      const tx = await uptimeOracle.connect(freshOracle).deregisterOracle();
      const receipt = await tx.wait();
      const gasUsed = receipt!.gasUsed * receipt!.gasPrice;

      const balanceAfter = await ethers.provider.getBalance(freshOracle.address);

      // Should receive full stake back (minus gas)
      expect(balanceAfter - balanceBefore + gasUsed).to.equal(ORACLE_STAKE);

      const oracleInfo = await uptimeOracle.getOracleInfo(freshOracle.address);
      expect(oracleInfo.isActive).to.equal(false);
    });

    it("Should deduct slashed amount when withdrawing", async () => {
      // Use a completely fresh oracle for this test
      const freshOracle = user2;
      await uptimeOracle.connect(freshOracle).registerOracle({ value: ORACLE_STAKE });

      const oracleInfoInitial = await uptimeOracle.getOracleInfo(freshOracle.address);
      const initialStake = oracleInfoInitial.stake;

      // Create market and slash the fresh oracle
      await uptimeMarket.createMarket(WEBSITE_URL, BETTING_DURATION, MONITORING_DURATION);
      await uptimeMarket.connect(user1).placeBid(0, 0, { value: ethers.parseEther("1") });

      await time.increase(BETTING_DURATION + 1);
      await uptimeMarket.closeMarket(0);

      // Fresh oracle reports wrong value (400 basis points off = 4% variance, will be slashed)
      await uptimeOracle.connect(freshOracle).reportUptime(0, 9500);
      await uptimeOracle.connect(oracle2).reportUptime(0, 9900);
      await uptimeOracle.connect(oracle3).reportUptime(0, 9900);
      await uptimeOracle.connect(oracle4).reportUptime(0, 9900); // Triggers consensus + slashing

      const oracleInfoAfterSlash = await uptimeOracle.getOracleInfo(freshOracle.address);
      const remainingStake = oracleInfoAfterSlash.stake;

      const balanceBefore = await ethers.provider.getBalance(freshOracle.address);
      const tx = await uptimeOracle.connect(freshOracle).deregisterOracle();
      const receipt = await tx.wait();
      const gasUsed = receipt!.gasUsed * receipt!.gasPrice;
      const balanceAfter = await ethers.provider.getBalance(freshOracle.address);

      // Should receive remaining stake (after slashing)
      expect(balanceAfter - balanceBefore + gasUsed).to.equal(remainingStake);

      // Verify slashing occurred (stake should be exactly 10% less)
      expect(remainingStake).to.equal(initialStake - initialStake / 10n);
    });

    it("Should prevent deregistration from non-oracle", async () => {
      // Get a signer that's not registered
      const signers = await ethers.getSigners();
      const nonOracle = signers[10];

      await expect(uptimeOracle.connect(nonOracle).deregisterOracle()).to.be.revertedWith(
        "Not an active oracle"
      );
    });
  });

  describe("Admin Functions", () => {
    it("Should allow owner to force deactivate malicious oracle", async () => {
      await expect(uptimeOracle.forceDeactivateOracle(oracle1.address))
        .to.emit(uptimeOracle, "OracleDeregistered")
        .withArgs(oracle1.address, 0);

      const oracleInfo = await uptimeOracle.getOracleInfo(oracle1.address);
      expect(oracleInfo.isActive).to.equal(false);
    });

    it("Should prevent non-owner from force deactivating", async () => {
      await expect(
        uptimeOracle.connect(user1).forceDeactivateOracle(oracle1.address)
      ).to.be.revertedWithCustomError(uptimeOracle, "OwnableUnauthorizedAccount");
    });
  });

  describe("View Functions", () => {
    it("Should return oracle accuracy correctly", async () => {
      // Create and resolve 2 markets
      for (let i = 0; i < 2; i++) {
        await uptimeMarket.createMarket(WEBSITE_URL, BETTING_DURATION, MONITORING_DURATION);
        await uptimeMarket.connect(user1).placeBid(i, 0, { value: ethers.parseEther("1") });

        await time.increase(BETTING_DURATION + 1);
        await uptimeMarket.closeMarket(i);

        await uptimeOracle.connect(oracle1).reportUptime(i, 9900);
        await uptimeOracle.connect(oracle2).reportUptime(i, 9900);
        await uptimeOracle.connect(oracle3).reportUptime(i, 9900);
      }

      const oracleInfo = await uptimeOracle.getOracleInfo(oracle1.address);
      expect(oracleInfo.reportsSubmitted).to.equal(2);
      expect(oracleInfo.correctReports).to.equal(2);
      expect(oracleInfo.accuracy).to.equal(10000); // 100%
    });

    it("Should return all market reports", async () => {
      await uptimeMarket.createMarket(WEBSITE_URL, BETTING_DURATION, MONITORING_DURATION);
      await uptimeMarket.connect(user1).placeBid(0, 0, { value: ethers.parseEther("1") });

      await time.increase(BETTING_DURATION + 1);
      await uptimeMarket.closeMarket(0);

      await uptimeOracle.connect(oracle1).reportUptime(0, 9900);
      await uptimeOracle.connect(oracle2).reportUptime(0, 9850);
      await uptimeOracle.connect(oracle3).reportUptime(0, 9900);

      const reports = await uptimeOracle.getMarketReports(0);
      expect(reports.length).to.equal(3);
      expect(reports[0].reporter).to.equal(oracle1.address);
      expect(reports[0].uptimePercentage).to.equal(9900);
      expect(reports[1].uptimePercentage).to.equal(9850);
    });

    it("Should check if oracle has reported", async () => {
      await uptimeMarket.createMarket(WEBSITE_URL, BETTING_DURATION, MONITORING_DURATION);
      await uptimeMarket.connect(user1).placeBid(0, 0, { value: ethers.parseEther("1") });

      await time.increase(BETTING_DURATION + 1);
      await uptimeMarket.closeMarket(0);

      expect(await uptimeOracle.hasOracleReported(0, oracle1.address)).to.equal(false);

      await uptimeOracle.connect(oracle1).reportUptime(0, 9900);

      expect(await uptimeOracle.hasOracleReported(0, oracle1.address)).to.equal(true);
    });
  });

  describe("Integration Tests", () => {
    it("Should complete full market lifecycle with consensus", async () => {
      // 1. Create market
      await uptimeMarket.createMarket(WEBSITE_URL, BETTING_DURATION, MONITORING_DURATION);
      const marketId = 0;

      // 2. Users place bets
      await uptimeMarket.connect(user1).placeBid(marketId, 0, { value: ethers.parseEther("3") });
      await uptimeMarket.connect(user2).placeBid(marketId, 1, { value: ethers.parseEther("1") });

      // 3. Close betting
      await time.increase(BETTING_DURATION + 1);
      await uptimeMarket.closeMarket(marketId);

      // 4. Oracles report (3/5 consensus on 99%)
      await uptimeOracle.connect(oracle1).reportUptime(marketId, 9900);
      await uptimeOracle.connect(oracle2).reportUptime(marketId, 9900);
      await uptimeOracle.connect(oracle3).reportUptime(marketId, 9900);

      // 5. Market should be resolved
      const market = await uptimeMarket.getMarket(marketId);
      expect(market.status).to.equal(2); // RESOLVED
      expect(market.outcome).to.equal(true); // YES wins

      // 6. Winner can claim
      const balanceBefore = await ethers.provider.getBalance(user1.address);
      const tx = await uptimeMarket.connect(user1).claimWinnings(marketId);
      const receipt = await tx.wait();
      const gasUsed = receipt!.gasUsed * receipt!.gasPrice;
      const balanceAfter = await ethers.provider.getBalance(user1.address);

      // User1 should receive full pool minus 2% fee
      const expectedWinnings = ethers.parseEther("3.92"); // 4 ETH - 2% = 3.92 ETH
      expect(balanceAfter - balanceBefore + gasUsed).to.be.closeTo(
        expectedWinnings,
        ethers.parseEther("0.001")
      );
    });
  });
});
