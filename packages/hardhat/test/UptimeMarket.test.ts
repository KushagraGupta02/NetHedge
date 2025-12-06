import { expect } from "chai";
import { ethers } from "hardhat";
import { UptimeMarket, UptimeOracle } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { time } from "@nomicfoundation/hardhat-network-helpers";

describe("UptimeMarket", function () {
  let uptimeMarket: UptimeMarket;
  let uptimeOracle: UptimeOracle;
  let owner: SignerWithAddress;
  let user1: SignerWithAddress;
  let user2: SignerWithAddress;
  let user3: SignerWithAddress;

  const WEBSITE_URL = "https://example.com";
  const BETTING_DURATION = 60 * 60; // 1 hour
  const MONITORING_DURATION = 24 * 60 * 60; // 24 hours
  const MINIMUM_BET = ethers.parseEther("0.001");

  beforeEach(async () => {
    [owner, user1, user2, user3] = await ethers.getSigners();

    // Deploy UptimeOracle
    const UptimeOracleFactory = await ethers.getContractFactory("UptimeOracle");
    uptimeOracle = await UptimeOracleFactory.deploy(owner.address);
    await uptimeOracle.waitForDeployment();

    // Deploy UptimeMarket
    const UptimeMarketFactory = await ethers.getContractFactory("UptimeMarket");
    uptimeMarket = await UptimeMarketFactory.deploy(owner.address);
    await uptimeMarket.waitForDeployment();

    // Set oracle address in market
    await uptimeMarket.setOracleAddress(await uptimeOracle.getAddress());

    // Set market contract in oracle
    await uptimeOracle.setMarketContract(await uptimeMarket.getAddress());
  });

  describe("Deployment", () => {
    it("Should set the correct owner", async () => {
      expect(await uptimeMarket.owner()).to.equal(owner.address);
    });

    it("Should set the correct oracle address", async () => {
      expect(await uptimeMarket.oracleAddress()).to.equal(await uptimeOracle.getAddress());
    });

    it("Should have zero markets initially", async () => {
      expect(await uptimeMarket.getTotalMarkets()).to.equal(0);
    });

    it("Should have correct platform fee", async () => {
      expect(await uptimeMarket.platformFeePercentage()).to.equal(200); // 2%
    });
  });

  describe("Market Creation", () => {
    it("Should create a market successfully", async () => {
      const tx = await uptimeMarket.createMarket(WEBSITE_URL, BETTING_DURATION, MONITORING_DURATION);
      const receipt = await tx.wait();

      expect(await uptimeMarket.getTotalMarkets()).to.equal(1);

      const market = await uptimeMarket.getMarket(0);
      expect(market.websiteUrl).to.equal(WEBSITE_URL);
      expect(market.creator).to.equal(owner.address);
      expect(market.status).to.equal(0); // OPEN
    });

    it("Should emit MarketCreated event", async () => {
      const currentTime = await time.latest();
      await expect(uptimeMarket.createMarket(WEBSITE_URL, BETTING_DURATION, MONITORING_DURATION))
        .to.emit(uptimeMarket, "MarketCreated")
        .withArgs(
          0,
          WEBSITE_URL,
          currentTime + 1,
          currentTime + BETTING_DURATION + 1,
          currentTime + BETTING_DURATION + MONITORING_DURATION + 1,
          currentTime + BETTING_DURATION + MONITORING_DURATION + 301,
          owner.address
        );
    });

    it("Should fail with empty URL", async () => {
      await expect(uptimeMarket.createMarket("", BETTING_DURATION, MONITORING_DURATION)).to.be.revertedWith(
        "Website URL cannot be empty"
      );
    });

    it("Should fail with duration less than 1 minute", async () => {
      await expect(uptimeMarket.createMarket(WEBSITE_URL, 30, MONITORING_DURATION)).to.be.revertedWith(
        "Betting duration must be at least 1 minute"
      );
    });

    it("Should fail with monitoring duration more than 30 days", async () => {
      const longDuration = 31 * 24 * 60 * 60; // 31 days
      await expect(uptimeMarket.createMarket(WEBSITE_URL, BETTING_DURATION, longDuration)).to.be.revertedWith(
        "Monitoring duration cannot exceed 30 days"
      );
    });

    it("Should allow multiple markets", async () => {
      await uptimeMarket.createMarket(WEBSITE_URL, BETTING_DURATION, MONITORING_DURATION);
      await uptimeMarket.createMarket("https://example2.com", BETTING_DURATION, MONITORING_DURATION);
      await uptimeMarket.createMarket("https://example3.com", BETTING_DURATION, MONITORING_DURATION);

      expect(await uptimeMarket.getTotalMarkets()).to.equal(3);
    });
  });

  describe("Placing Bids", () => {
    let marketId: number;

    beforeEach(async () => {
      await uptimeMarket.createMarket(WEBSITE_URL, BETTING_DURATION, MONITORING_DURATION);
      marketId = 0;
    });

    it("Should place a YES bid successfully", async () => {
      const bidAmount = ethers.parseEther("1");
      await expect(uptimeMarket.connect(user1).placeBid(marketId, 0, { value: bidAmount }))
        .to.emit(uptimeMarket, "BidPlaced")
        .withArgs(marketId, user1.address, 0, bidAmount, await time.latest() + 1);

      const market = await uptimeMarket.getMarket(marketId);
      expect(market.yesPool).to.equal(bidAmount);
      expect(market.noPool).to.equal(0);
      expect(market.totalBids).to.equal(1);
    });

    it("Should place a NO bid successfully", async () => {
      const bidAmount = ethers.parseEther("0.5");
      await uptimeMarket.connect(user2).placeBid(marketId, 1, { value: bidAmount });

      const market = await uptimeMarket.getMarket(marketId);
      expect(market.yesPool).to.equal(0);
      expect(market.noPool).to.equal(bidAmount);
    });

    it("Should fail with bet amount below minimum", async () => {
      const lowAmount = ethers.parseEther("0.0001");
      await expect(
        uptimeMarket.connect(user1).placeBid(marketId, 0, { value: lowAmount })
      ).to.be.revertedWith("Bet amount too low");
    });

    it("Should allow multiple bids from same user", async () => {
      await uptimeMarket.connect(user1).placeBid(marketId, 0, { value: ethers.parseEther("1") });
      await uptimeMarket.connect(user1).placeBid(marketId, 0, { value: ethers.parseEther("0.5") });

      const bids = await uptimeMarket.getUserBids(marketId, user1.address);
      expect(bids.length).to.equal(2);

      const market = await uptimeMarket.getMarket(marketId);
      expect(market.yesPool).to.equal(ethers.parseEther("1.5"));
    });

    it("Should track multiple bidders", async () => {
      await uptimeMarket.connect(user1).placeBid(marketId, 0, { value: ethers.parseEther("1") });
      await uptimeMarket.connect(user2).placeBid(marketId, 1, { value: ethers.parseEther("0.5") });
      await uptimeMarket.connect(user3).placeBid(marketId, 0, { value: ethers.parseEther("2") });

      const bidders = await uptimeMarket.getMarketBidders(marketId);
      expect(bidders.length).to.equal(3);
      expect(bidders).to.include(user1.address);
      expect(bidders).to.include(user2.address);
      expect(bidders).to.include(user3.address);
    });

    it("Should fail when betting period has ended", async () => {
      await time.increase(BETTING_DURATION + 1);
      await expect(
        uptimeMarket.connect(user1).placeBid(marketId, 0, { value: ethers.parseEther("1") })
      ).to.be.revertedWith("Betting period has ended");
    });
  });

  describe("Odds Calculation", () => {
    let marketId: number;

    beforeEach(async () => {
      await uptimeMarket.createMarket(WEBSITE_URL, BETTING_DURATION, MONITORING_DURATION);
      marketId = 0;
    });

    it("Should return 1:1 odds when no bets placed", async () => {
      const odds = await uptimeMarket.getOdds(marketId);
      expect(odds.yesOdds).to.equal(10000); // 1x in basis points
      expect(odds.noOdds).to.equal(10000);
    });

    it("Should calculate odds correctly with bets", async () => {
      await uptimeMarket.connect(user1).placeBid(marketId, 0, { value: ethers.parseEther("3") }); // YES
      await uptimeMarket.connect(user2).placeBid(marketId, 1, { value: ethers.parseEther("1") }); // NO

      const odds = await uptimeMarket.getOdds(marketId);
      // Total pool = 4 ETH
      // YES pool = 3 ETH -> odds = 4/3 = 1.33x = 13333 basis points
      // NO pool = 1 ETH -> odds = 4/1 = 4x = 40000 basis points

      expect(odds.yesOdds).to.equal(13333);
      expect(odds.noOdds).to.equal(40000);
    });

    it("Should calculate potential winnings", async () => {
      await uptimeMarket.connect(user1).placeBid(marketId, 0, { value: ethers.parseEther("2") });
      await uptimeMarket.connect(user2).placeBid(marketId, 1, { value: ethers.parseEther("1") });

      const betAmount = ethers.parseEther("1");
      const winnings = await uptimeMarket.calculatePotentialWinnings(marketId, 0, betAmount);

      // New total = 4 ETH, new YES pool = 3 ETH
      // Gross = (1 * 4) / 3 = 1.333 ETH
      // Platform fee = 1.333 * 0.02 = 0.02666 ETH
      // Net = 1.333 - 0.02666 = 1.30666 ETH

      expect(winnings.grossWinnings).to.equal(ethers.parseEther("1.333333333333333333"));
      expect(winnings.netWinnings).to.be.closeTo(
        ethers.parseEther("1.306666666666666666"),
        ethers.parseEther("0.001")
      );
    });
  });

  describe("Market Closing", () => {
    let marketId: number;

    beforeEach(async () => {
      await uptimeMarket.createMarket(WEBSITE_URL, BETTING_DURATION, MONITORING_DURATION);
      marketId = 0;
    });

    it("Should close market after betting period", async () => {
      await time.increase(BETTING_DURATION + 1);

      await expect(uptimeMarket.closeMarket(marketId))
        .to.emit(uptimeMarket, "MarketStatusChanged")
        .withArgs(marketId, 0, 1); // OPEN -> MONITORING

      const market = await uptimeMarket.getMarket(marketId);
      expect(market.status).to.equal(1); // MONITORING
    });

    it("Should fail to close before betting period ends", async () => {
      await expect(uptimeMarket.closeMarket(marketId)).to.be.revertedWith(
        "Betting period not ended yet"
      );
    });

    it("Should not accept bids after closing", async () => {
      await time.increase(BETTING_DURATION + 1);
      await uptimeMarket.closeMarket(marketId);

      await expect(
        uptimeMarket.connect(user1).placeBid(marketId, 0, { value: ethers.parseEther("1") })
      ).to.be.revertedWith("Invalid market status");
    });
  });

  describe("Market Resolution", () => {
    let marketId: number;
    let oracle1: SignerWithAddress;

    beforeEach(async () => {
      // Get oracle signer
      const signers = await ethers.getSigners();
      oracle1 = signers[4]; // Use a different signer as oracle

      // Register oracle
      await uptimeOracle.connect(oracle1).registerOracle({ value: ethers.parseEther("0.1") });

      await uptimeMarket.createMarket(WEBSITE_URL, BETTING_DURATION, MONITORING_DURATION);
      marketId = 0;

      // Place some bets
      await uptimeMarket.connect(user1).placeBid(marketId, 0, { value: ethers.parseEther("2") }); // YES
      await uptimeMarket.connect(user2).placeBid(marketId, 1, { value: ethers.parseEther("1") }); // NO

      // Close market
      await time.increase(BETTING_DURATION + 1);
      await uptimeMarket.closeMarket(marketId);
    });

    it("Should resolve market with YES outcome (uptime >= 99%)", async () => {
      const uptimePercentage = 9900; // 99%

      // Need 3 oracles to reach consensus
      const signers = await ethers.getSigners();
      const oracle2 = signers[5];
      const oracle3 = signers[6];

      await uptimeOracle.connect(oracle2).registerOracle({ value: ethers.parseEther("0.1") });
      await uptimeOracle.connect(oracle3).registerOracle({ value: ethers.parseEther("0.1") });

      await uptimeOracle.connect(oracle1).reportUptime(marketId, uptimePercentage);
      await uptimeOracle.connect(oracle2).reportUptime(marketId, uptimePercentage);

      await expect(uptimeOracle.connect(oracle3).reportUptime(marketId, uptimePercentage))
        .to.emit(uptimeMarket, "MarketResolved")
        .withArgs(marketId, true, uptimePercentage, ethers.parseEther("2"), ethers.parseEther("1"));

      const market = await uptimeMarket.getMarket(marketId);
      expect(market.status).to.equal(2); // RESOLVED
      expect(market.outcome).to.equal(true); // YES wins
      expect(market.uptimePercentage).to.equal(uptimePercentage);
    });

    it("Should resolve market with NO outcome (uptime < 99%)", async () => {
      const uptimePercentage = 9800; // 98%

      // Need 3 oracles to reach consensus
      const signers = await ethers.getSigners();
      const oracle2 = signers[5];
      const oracle3 = signers[6];

      await uptimeOracle.connect(oracle2).registerOracle({ value: ethers.parseEther("0.1") });
      await uptimeOracle.connect(oracle3).registerOracle({ value: ethers.parseEther("0.1") });

      await uptimeOracle.connect(oracle1).reportUptime(marketId, uptimePercentage);
      await uptimeOracle.connect(oracle2).reportUptime(marketId, uptimePercentage);
      await uptimeOracle.connect(oracle3).reportUptime(marketId, uptimePercentage);

      const market = await uptimeMarket.getMarket(marketId);
      expect(market.outcome).to.equal(false); // NO wins
    });

    it("Should fail resolution from unauthorized address", async () => {
      await expect(
        uptimeMarket.connect(user1).resolveMarket(marketId, 9900)
      ).to.be.revertedWith("Only oracle can call this");
    });

    it("Should fail with invalid uptime percentage", async () => {
      await expect(uptimeOracle.connect(oracle1).reportUptime(marketId, 10001)).to.be.revertedWith(
        "Invalid uptime percentage"
      );
    });

    it("Should fail to resolve market not in MONITORING status", async () => {
      // Try to resolve again
      await uptimeOracle.connect(oracle1).reportUptime(marketId, 9900);

      await expect(uptimeOracle.connect(oracle1).reportUptime(marketId, 9800)).to.be.revertedWith(
        "Already reported for this market"
      );
    });
  });

  describe("Claiming Winnings", () => {
    let marketId: number;
    let oracle1: SignerWithAddress;
    let oracle2: SignerWithAddress;
    let oracle3: SignerWithAddress;

    beforeEach(async () => {
      const signers = await ethers.getSigners();
      oracle1 = signers[4];
      oracle2 = signers[5];
      oracle3 = signers[6];

      // Register oracles
      await uptimeOracle.connect(oracle1).registerOracle({ value: ethers.parseEther("0.1") });
      await uptimeOracle.connect(oracle2).registerOracle({ value: ethers.parseEther("0.1") });
      await uptimeOracle.connect(oracle3).registerOracle({ value: ethers.parseEther("0.1") });

      await uptimeMarket.createMarket(WEBSITE_URL, BETTING_DURATION, MONITORING_DURATION);
      marketId = 0;
    });

    it("Should allow winner to claim winnings (YES wins)", async () => {
      // User1 bets YES, User2 bets NO
      await uptimeMarket.connect(user1).placeBid(marketId, 0, { value: ethers.parseEther("2") });
      await uptimeMarket.connect(user2).placeBid(marketId, 1, { value: ethers.parseEther("1") });

      // Close and resolve market (YES wins)
      await time.increase(BETTING_DURATION + 1);
      await uptimeMarket.closeMarket(marketId);

      // Reach consensus with 3 oracles
      await uptimeOracle.connect(oracle1).reportUptime(marketId, 9900);
      await uptimeOracle.connect(oracle2).reportUptime(marketId, 9900);
      await uptimeOracle.connect(oracle3).reportUptime(marketId, 9900);

      // User1 claims
      const balanceBefore = await ethers.provider.getBalance(user1.address);
      const tx = await uptimeMarket.connect(user1).claimWinnings(marketId);
      const receipt = await tx.wait();
      const gasUsed = receipt!.gasUsed * receipt!.gasPrice;

      const balanceAfter = await ethers.provider.getBalance(user1.address);

      // User1 should receive: (2/2) * 3 = 3 ETH - 2% fee = 2.94 ETH
      const expectedWinnings = ethers.parseEther("2.94");
      expect(balanceAfter - balanceBefore + gasUsed).to.be.closeTo(
        expectedWinnings,
        ethers.parseEther("0.001")
      );
    });

    it("Should allow winner to claim winnings (NO wins)", async () => {
      await uptimeMarket.connect(user1).placeBid(marketId, 0, { value: ethers.parseEther("1") });
      await uptimeMarket.connect(user2).placeBid(marketId, 1, { value: ethers.parseEther("1") });

      await time.increase(BETTING_DURATION + 1);
      await uptimeMarket.closeMarket(marketId);
      await uptimeOracle.connect(oracle1).reportUptime(marketId, 9800);
      await uptimeOracle.connect(oracle2).reportUptime(marketId, 9800);
      await uptimeOracle.connect(oracle3).reportUptime(marketId, 9800); // NO wins

      const balanceBefore = await ethers.provider.getBalance(user2.address);
      const tx = await uptimeMarket.connect(user2).claimWinnings(marketId);
      const receipt = await tx.wait();
      const gasUsed = receipt!.gasUsed * receipt!.gasPrice;

      const balanceAfter = await ethers.provider.getBalance(user2.address);

      // User2 should receive: (1/1) * 2 = 2 ETH - 2% fee = 1.96 ETH
      const expectedWinnings = ethers.parseEther("1.96");
      expect(balanceAfter - balanceBefore + gasUsed).to.be.closeTo(
        expectedWinnings,
        ethers.parseEther("0.001")
      );
    });

    it("Should not allow loser to claim", async () => {
      await uptimeMarket.connect(user1).placeBid(marketId, 0, { value: ethers.parseEther("1") });
      await uptimeMarket.connect(user2).placeBid(marketId, 1, { value: ethers.parseEther("1") });

      await time.increase(BETTING_DURATION + 1);
      await uptimeMarket.closeMarket(marketId);
      await uptimeOracle.connect(oracle1).reportUptime(marketId, 9900);
      await uptimeOracle.connect(oracle2).reportUptime(marketId, 9900);
      await uptimeOracle.connect(oracle3).reportUptime(marketId, 9900); // YES wins

      await expect(uptimeMarket.connect(user2).claimWinnings(marketId)).to.be.revertedWith(
        "No winning bets to claim"
      );
    });

    it("Should not allow claiming before resolution", async () => {
      await uptimeMarket.connect(user1).placeBid(marketId, 0, { value: ethers.parseEther("1") });

      await expect(uptimeMarket.connect(user1).claimWinnings(marketId)).to.be.revertedWith(
        "Invalid market status"
      );
    });

    it("Should distribute platform fees to owner", async () => {
      await uptimeMarket.connect(user1).placeBid(marketId, 0, { value: ethers.parseEther("10") });
      await uptimeMarket.connect(user2).placeBid(marketId, 1, { value: ethers.parseEther("5") });

      await time.increase(BETTING_DURATION + 1);
      await uptimeMarket.closeMarket(marketId);
      await uptimeOracle.connect(oracle1).reportUptime(marketId, 9900);
      await uptimeOracle.connect(oracle2).reportUptime(marketId, 9900);
      await uptimeOracle.connect(oracle3).reportUptime(marketId, 9900);

      const ownerBalanceBefore = await ethers.provider.getBalance(owner.address);
      await uptimeMarket.connect(user1).claimWinnings(marketId);
      const ownerBalanceAfter = await ethers.provider.getBalance(owner.address);

      // Platform fee = 15 ETH * 0.02 = 0.3 ETH
      const expectedFee = ethers.parseEther("0.3");
      expect(ownerBalanceAfter - ownerBalanceBefore).to.equal(expectedFee);
    });

    it("Should handle multiple winners proportionally", async () => {
      // Two users bet YES
      await uptimeMarket.connect(user1).placeBid(marketId, 0, { value: ethers.parseEther("3") }); // 75% of YES pool
      await uptimeMarket.connect(user2).placeBid(marketId, 0, { value: ethers.parseEther("1") }); // 25% of YES pool
      await uptimeMarket.connect(user3).placeBid(marketId, 1, { value: ethers.parseEther("4") });

      await time.increase(BETTING_DURATION + 1);
      await uptimeMarket.closeMarket(marketId);
      await uptimeOracle.connect(oracle1).reportUptime(marketId, 9900);
      await uptimeOracle.connect(oracle2).reportUptime(marketId, 9900);
      await uptimeOracle.connect(oracle3).reportUptime(marketId, 9900); // YES wins

      // User1 share: (3/4) * 8 = 6 ETH - 2% = 5.88 ETH
      // User2 share: (1/4) * 8 = 2 ETH - 2% = 1.96 ETH

      const balance1Before = await ethers.provider.getBalance(user1.address);
      const tx1 = await uptimeMarket.connect(user1).claimWinnings(marketId);
      const receipt1 = await tx1.wait();
      const gas1 = receipt1!.gasUsed * receipt1!.gasPrice;
      const balance1After = await ethers.provider.getBalance(user1.address);

      expect(balance1After - balance1Before + gas1).to.be.closeTo(
        ethers.parseEther("5.88"),
        ethers.parseEther("0.001")
      );

      const balance2Before = await ethers.provider.getBalance(user2.address);
      const tx2 = await uptimeMarket.connect(user2).claimWinnings(marketId);
      const receipt2 = await tx2.wait();
      const gas2 = receipt2!.gasUsed * receipt2!.gasPrice;
      const balance2After = await ethers.provider.getBalance(user2.address);

      expect(balance2After - balance2Before + gas2).to.be.closeTo(
        ethers.parseEther("1.96"),
        ethers.parseEther("0.001")
      );
    });

    it("Should not allow claiming twice", async () => {
      await uptimeMarket.connect(user1).placeBid(marketId, 0, { value: ethers.parseEther("1") });
      await uptimeMarket.connect(user2).placeBid(marketId, 1, { value: ethers.parseEther("1") });

      await time.increase(BETTING_DURATION + 1);
      await uptimeMarket.closeMarket(marketId);
      await uptimeOracle.connect(oracle1).reportUptime(marketId, 9900);
      await uptimeOracle.connect(oracle2).reportUptime(marketId, 9900);
      await uptimeOracle.connect(oracle3).reportUptime(marketId, 9900);

      await uptimeMarket.connect(user1).claimWinnings(marketId);
      await expect(uptimeMarket.connect(user1).claimWinnings(marketId)).to.be.revertedWith(
        "No winning bets to claim"
      );
    });
  });

  describe("Market Cancellation", () => {
    let marketId: number;
    let oracle1: SignerWithAddress;
    let oracle2: SignerWithAddress;
    let oracle3: SignerWithAddress;

    beforeEach(async () => {
      const signers = await ethers.getSigners();
      oracle1 = signers[4];
      oracle2 = signers[5];
      oracle3 = signers[6];

      // Register oracles
      await uptimeOracle.connect(oracle1).registerOracle({ value: ethers.parseEther("0.1") });
      await uptimeOracle.connect(oracle2).registerOracle({ value: ethers.parseEther("0.1") });
      await uptimeOracle.connect(oracle3).registerOracle({ value: ethers.parseEther("0.1") });

      await uptimeMarket.createMarket(WEBSITE_URL, BETTING_DURATION, MONITORING_DURATION);
      marketId = 0;
      await uptimeMarket.connect(user1).placeBid(marketId, 0, { value: ethers.parseEther("1") });
      await uptimeMarket.connect(user2).placeBid(marketId, 1, { value: ethers.parseEther("0.5") });
    });

    it("Should allow owner to cancel market", async () => {
      await expect(uptimeMarket.cancelMarket(marketId))
        .to.emit(uptimeMarket, "MarketStatusChanged")
        .withArgs(marketId, 0, 3); // OPEN -> CANCELLED

      const market = await uptimeMarket.getMarket(marketId);
      expect(market.status).to.equal(3); // CANCELLED
    });

    it("Should allow users to claim refunds from cancelled market", async () => {
      await uptimeMarket.cancelMarket(marketId);

      const balanceBefore = await ethers.provider.getBalance(user1.address);
      const tx = await uptimeMarket.connect(user1).claimRefund(marketId);
      const receipt = await tx.wait();
      const gasUsed = receipt!.gasUsed * receipt!.gasPrice;
      const balanceAfter = await ethers.provider.getBalance(user1.address);

      expect(balanceAfter - balanceBefore + gasUsed).to.equal(ethers.parseEther("1"));
    });

    it("Should not allow cancelling resolved market", async () => {
      await time.increase(BETTING_DURATION + 1);
      await uptimeMarket.closeMarket(marketId);
      await uptimeOracle.connect(oracle1).reportUptime(marketId, 9900);
      await uptimeOracle.connect(oracle2).reportUptime(marketId, 9900);
      await uptimeOracle.connect(oracle3).reportUptime(marketId, 9900);

      await expect(uptimeMarket.cancelMarket(marketId)).to.be.revertedWith(
        "Cannot cancel resolved market"
      );
    });

    it("Should not allow non-owner to cancel", async () => {
      await expect(uptimeMarket.connect(user1).cancelMarket(marketId))
        .to.be.revertedWithCustomError(uptimeMarket, "OwnableUnauthorizedAccount");
    });
  });

  describe("Admin Functions", () => {
    it("Should allow owner to update oracle address", async () => {
      const newOracle = user1.address;
      await expect(uptimeMarket.setOracleAddress(newOracle))
        .to.emit(uptimeMarket, "OracleAddressUpdated")
        .withArgs(await uptimeOracle.getAddress(), newOracle);

      expect(await uptimeMarket.oracleAddress()).to.equal(newOracle);
    });

    it("Should allow owner to update platform fee", async () => {
      const newFee = 300; // 3%
      await expect(uptimeMarket.setPlatformFee(newFee))
        .to.emit(uptimeMarket, "PlatformFeeUpdated")
        .withArgs(200, newFee);

      expect(await uptimeMarket.platformFeePercentage()).to.equal(newFee);
    });

    it("Should not allow fee above 10%", async () => {
      await expect(uptimeMarket.setPlatformFee(1001)).to.be.revertedWith("Fee cannot exceed 10%");
    });

    it("Should not allow non-owner to update oracle", async () => {
      await expect(uptimeMarket.connect(user1).setOracleAddress(user2.address))
        .to.be.revertedWithCustomError(uptimeMarket, "OwnableUnauthorizedAccount");
    });
  });
});
