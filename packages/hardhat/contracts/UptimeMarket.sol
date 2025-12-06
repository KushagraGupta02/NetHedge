// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title UptimeMarket
 * @notice A prediction market for website uptime - users can bet YES (site stays up) or NO (site goes down)
 * @dev Uses pool-based betting with dynamic odds calculation
 */
contract UptimeMarket is ReentrancyGuard, Ownable {
    // ============ Enums ============

    enum MarketStatus {
        OPEN,           // Accepting bids
        MONITORING,     // No more bids, waiting for oracle
        RESOLVED,       // Oracle has resolved the market
        CANCELLED       // Market cancelled (refunds available)
    }

    enum Position {
        YES,            // Betting site will be UP
        NO              // Betting site will be DOWN
    }

    // ============ Structs ============

    struct Market {
        uint256 id;
        string websiteUrl;
        uint256 startTime;
        uint256 bettingEndTime;      // When betting closes
        uint256 monitoringEndTime;   // When monitoring period ends
        uint256 resolutionTime;      // Deadline for oracle resolution
        uint256 yesPool;             // Total ETH in YES pool
        uint256 noPool;              // Total ETH in NO pool
        MarketStatus status;
        bool outcome;                // true = YES wins (site was up), false = NO wins
        uint256 uptimePercentage;    // Final uptime in basis points (9900 = 99%)
        uint256 totalBids;
        address creator;
    }

    // Uptime check data point
    struct UptimeCheck {
        uint256 timestamp;
        bool isUp;               // true if site was up, false if down
        uint256 responseTime;    // Response time in milliseconds
    }

    struct Bid {
        uint256 marketId;
        address bidder;
        Position position;
        uint256 amount;
        uint256 timestamp;
        bool claimed;
    }

    // ============ State Variables ============

    uint256 public marketCounter;
    uint256 public platformFeePercentage = 200; // 2% in basis points
    uint256 public constant MINIMUM_BET = 0.001 ether;
    uint256 public constant UPTIME_THRESHOLD = 9900; // 99% uptime threshold

    address public oracleAddress;

    mapping(uint256 => Market) public markets;
    mapping(uint256 => mapping(address => Bid[])) public userBids; // marketId => user => bids
    mapping(uint256 => bool) public hasUserBid; // marketId => user => hasBid (for quick lookup)

    // Track all bidders for a market
    mapping(uint256 => address[]) public marketBidders;
    mapping(uint256 => mapping(address => bool)) private isMarketBidder;

    // Track markets a user has participated in (for Portfolio/P&L)
    mapping(address => uint256[]) public userParticipatedMarkets;
    mapping(address => mapping(uint256 => bool)) private hasParticipated;

    // Track uptime checks for each market
    mapping(uint256 => UptimeCheck[]) public marketUptimeChecks;

    // ============ Events ============

    event MarketCreated(
        uint256 indexed marketId,
        string websiteUrl,
        uint256 startTime,
        uint256 bettingEndTime,
        uint256 monitoringEndTime,
        uint256 resolutionTime,
        address creator
    );

    event UptimeCheckAdded(
        uint256 indexed marketId,
        uint256 timestamp,
        bool isUp,
        uint256 responseTime
    );

    event BidPlaced(
        uint256 indexed marketId,
        address indexed bidder,
        Position position,
        uint256 amount,
        uint256 timestamp
    );

    event MarketStatusChanged(
        uint256 indexed marketId,
        MarketStatus oldStatus,
        MarketStatus newStatus
    );

    event MarketResolved(
        uint256 indexed marketId,
        bool outcome,
        uint256 uptimePercentage,
        uint256 yesPool,
        uint256 noPool
    );

    event WinningsClaimed(
        uint256 indexed marketId,
        address indexed user,
        uint256 amount,
        uint256 platformFee
    );

    event OracleAddressUpdated(address indexed oldOracle, address indexed newOracle);

    event PlatformFeeUpdated(uint256 oldFee, uint256 newFee);

    // ============ Modifiers ============

    modifier onlyOracle() {
        require(msg.sender == oracleAddress, "Only oracle can call this");
        _;
    }

    modifier marketExists(uint256 _marketId) {
        require(_marketId < marketCounter, "Market does not exist");
        _;
    }

    modifier marketInStatus(uint256 _marketId, MarketStatus _status) {
        require(markets[_marketId].status == _status, "Invalid market status");
        _;
    }

    // ============ Constructor ============

    constructor(address _initialOwner) Ownable(_initialOwner) {
        // Oracle will be set later
    }

    // ============ Core Functions ============

    /**
     * @notice Create a new uptime prediction market
     * @param _websiteUrl The URL of the website to monitor
     * @param _bettingDuration Duration in seconds for betting period
     * @param _monitoringDuration Duration in seconds for monitoring period
     */
    function createMarket(
        string memory _websiteUrl,
        uint256 _bettingDuration,
        uint256 _monitoringDuration
    ) external returns (uint256) {
        require(bytes(_websiteUrl).length > 0, "Website URL cannot be empty");
        require(_bettingDuration >= 1 minutes, "Betting duration must be at least 1 minute");
        require(_bettingDuration <= 7 days, "Betting duration cannot exceed 7 days");
        require(_monitoringDuration >= 1 minutes, "Monitoring duration must be at least 1 minute");
        require(_monitoringDuration <= 30 days, "Monitoring duration cannot exceed 30 days");

        uint256 marketId = marketCounter++;
        uint256 startTime = block.timestamp;
        uint256 bettingEndTime = startTime + _bettingDuration;
        uint256 monitoringEndTime = bettingEndTime + _monitoringDuration;
        uint256 resolutionTime = monitoringEndTime + 5 minutes; // 5 minute buffer for oracle

        Market storage market = markets[marketId];
        market.id = marketId;
        market.websiteUrl = _websiteUrl;
        market.startTime = startTime;
        market.bettingEndTime = bettingEndTime;
        market.monitoringEndTime = monitoringEndTime;
        market.resolutionTime = resolutionTime;
        market.status = MarketStatus.OPEN;
        market.creator = msg.sender;

        emit MarketCreated(
            marketId,
            _websiteUrl,
            startTime,
            bettingEndTime,
            monitoringEndTime,
            resolutionTime,
            msg.sender
        );

        return marketId;
    }

    /**
     * @notice Place a bet on a market
     * @param _marketId The ID of the market
     * @param _position YES or NO position
     */
    function placeBid(
        uint256 _marketId,
        Position _position
    )
        external
        payable
        nonReentrant
        marketExists(_marketId)
        marketInStatus(_marketId, MarketStatus.OPEN)
    {
        require(msg.value >= MINIMUM_BET, "Bet amount too low");

        Market storage market = markets[_marketId];
        require(block.timestamp < market.bettingEndTime, "Betting period has ended");

        // Update pools
        if (_position == Position.YES) {
            market.yesPool += msg.value;
        } else {
            market.noPool += msg.value;
        }

        // Record the bid
        Bid memory newBid = Bid({
            marketId: _marketId,
            bidder: msg.sender,
            position: _position,
            amount: msg.value,
            timestamp: block.timestamp,
            claimed: false
        });

        userBids[_marketId][msg.sender].push(newBid);
        market.totalBids++;

        // Track unique bidders
        if (!isMarketBidder[_marketId][msg.sender]) {
            marketBidders[_marketId].push(msg.sender);
            isMarketBidder[_marketId][msg.sender] = true;
        }

        // Track user participation for Portfolio
        if (!hasParticipated[msg.sender][_marketId]) {
            userParticipatedMarkets[msg.sender].push(_marketId);
            hasParticipated[msg.sender][_marketId] = true;
        }

        emit BidPlaced(_marketId, msg.sender, _position, msg.value, block.timestamp);
    }

    /**
     * @notice Close betting period and move to monitoring
     * @param _marketId The ID of the market
     */
    function closeMarket(uint256 _marketId)
        external
        marketExists(_marketId)
        marketInStatus(_marketId, MarketStatus.OPEN)
    {
        Market storage market = markets[_marketId];
        require(block.timestamp >= market.bettingEndTime, "Betting period not ended yet");

        MarketStatus oldStatus = market.status;
        market.status = MarketStatus.MONITORING;

        emit MarketStatusChanged(_marketId, oldStatus, MarketStatus.MONITORING);
    }

    /**
     * @notice Add an uptime check data point (called by oracle during monitoring)
     * @param _marketId The ID of the market
     * @param _isUp Whether the site was up
     * @param _responseTime Response time in milliseconds
     */
    function addUptimeCheck(
        uint256 _marketId,
        bool _isUp,
        uint256 _responseTime
    )
        external
        onlyOracle
        marketExists(_marketId)
    {
        Market storage market = markets[_marketId];
        require(
            market.status == MarketStatus.OPEN || market.status == MarketStatus.MONITORING,
            "Market not active"
        );
        require(block.timestamp <= market.monitoringEndTime, "Monitoring period has ended");

        UptimeCheck memory check = UptimeCheck({
            timestamp: block.timestamp,
            isUp: _isUp,
            responseTime: _responseTime
        });

        marketUptimeChecks[_marketId].push(check);

        emit UptimeCheckAdded(_marketId, block.timestamp, _isUp, _responseTime);
    }

    /**
     * @notice Resolve a market (called by oracle)
     * @param _marketId The ID of the market
     * @param _uptimePercentage The uptime percentage in basis points
     */
    function resolveMarket(
        uint256 _marketId,
        uint256 _uptimePercentage
    )
        external
        onlyOracle
        marketExists(_marketId)
        marketInStatus(_marketId, MarketStatus.MONITORING)
    {
        require(_uptimePercentage <= 10000, "Invalid uptime percentage");

        Market storage market = markets[_marketId];
        market.uptimePercentage = _uptimePercentage;
        market.outcome = _uptimePercentage >= UPTIME_THRESHOLD;
        market.status = MarketStatus.RESOLVED;

        emit MarketResolved(
            _marketId,
            market.outcome,
            _uptimePercentage,
            market.yesPool,
            market.noPool
        );

        emit MarketStatusChanged(_marketId, MarketStatus.MONITORING, MarketStatus.RESOLVED);
    }

    /**
     * @notice Claim winnings from a resolved market
     * @param _marketId The ID of the market
     */
    function claimWinnings(uint256 _marketId)
        external
        nonReentrant
        marketExists(_marketId)
        marketInStatus(_marketId, MarketStatus.RESOLVED)
    {
        Market storage market = markets[_marketId];
        Bid[] storage bids = userBids[_marketId][msg.sender];

        require(bids.length > 0, "No bids found for this market");

        uint256 totalWinnings = 0;
        uint256 userWinningBets = 0;

        // Calculate winnings
        for (uint256 i = 0; i < bids.length; i++) {
            if (!bids[i].claimed) {
                // Check if user won
                bool userWon = (market.outcome && bids[i].position == Position.YES) ||
                              (!market.outcome && bids[i].position == Position.NO);

                if (userWon) {
                    userWinningBets += bids[i].amount;
                }

                bids[i].claimed = true;
            }
        }

        require(userWinningBets > 0, "No winning bets to claim");

        // Calculate payout
        uint256 totalPool = market.yesPool + market.noPool;
        uint256 winningPool = market.outcome ? market.yesPool : market.noPool;

        // Proportional share of total pool
        totalWinnings = (userWinningBets * totalPool) / winningPool;

        // Deduct platform fee
        uint256 platformFee = (totalWinnings * platformFeePercentage) / 10000;
        uint256 netWinnings = totalWinnings - platformFee;

        require(netWinnings > 0, "No winnings after fees");

        // Transfer winnings
        (bool success, ) = msg.sender.call{value: netWinnings}("");
        require(success, "Transfer failed");

        // Transfer platform fee to owner
        if (platformFee > 0) {
            (bool feeSuccess, ) = owner().call{value: platformFee}("");
            require(feeSuccess, "Fee transfer failed");
        }

        emit WinningsClaimed(_marketId, msg.sender, netWinnings, platformFee);
    }

    /**
     * @notice Cancel a market and allow refunds (emergency use)
     * @param _marketId The ID of the market
     */
    function cancelMarket(uint256 _marketId)
        external
        onlyOwner
        marketExists(_marketId)
    {
        Market storage market = markets[_marketId];
        require(market.status != MarketStatus.RESOLVED, "Cannot cancel resolved market");
        require(market.status != MarketStatus.CANCELLED, "Market already cancelled");

        MarketStatus oldStatus = market.status;
        market.status = MarketStatus.CANCELLED;

        emit MarketStatusChanged(_marketId, oldStatus, MarketStatus.CANCELLED);
    }

    /**
     * @notice Claim refund from a cancelled market
     * @param _marketId The ID of the market
     */
    function claimRefund(uint256 _marketId)
        external
        nonReentrant
        marketExists(_marketId)
        marketInStatus(_marketId, MarketStatus.CANCELLED)
    {
        Bid[] storage bids = userBids[_marketId][msg.sender];
        require(bids.length > 0, "No bids found for this market");

        uint256 totalRefund = 0;

        for (uint256 i = 0; i < bids.length; i++) {
            if (!bids[i].claimed) {
                totalRefund += bids[i].amount;
                bids[i].claimed = true;
            }
        }

        require(totalRefund > 0, "No refund available");

        (bool success, ) = msg.sender.call{value: totalRefund}("");
        require(success, "Refund transfer failed");
    }

    // ============ View Functions ============

    /**
     * @notice Get market details
     */
    function getMarket(uint256 _marketId)
        external
        view
        marketExists(_marketId)
        returns (Market memory)
    {
        return markets[_marketId];
    }

    /**
     * @notice Get user's bids for a market
     */
    function getUserBids(uint256 _marketId, address _user)
        external
        view
        returns (Bid[] memory)
    {
        return userBids[_marketId][_user];
    }

    /**
     * @notice Get current odds for a market
     * @return yesOdds Payout multiplier for YES (in basis points)
     * @return noOdds Payout multiplier for NO (in basis points)
     */
    function getOdds(uint256 _marketId)
        external
        view
        marketExists(_marketId)
        returns (uint256 yesOdds, uint256 noOdds)
    {
        Market storage market = markets[_marketId];
        uint256 totalPool = market.yesPool + market.noPool;

        if (totalPool == 0) {
            return (10000, 10000); // 1:1 odds if no bets
        }

        if (market.yesPool == 0) {
            yesOdds = type(uint256).max; // Infinite odds
            noOdds = 10000;
        } else if (market.noPool == 0) {
            yesOdds = 10000;
            noOdds = type(uint256).max;
        } else {
            // Odds = (total pool / winning pool) * 10000
            yesOdds = (totalPool * 10000) / market.yesPool;
            noOdds = (totalPool * 10000) / market.noPool;
        }
    }

    /**
     * @notice Get all bidders for a market
     */
    function getMarketBidders(uint256 _marketId)
        external
        view
        returns (address[] memory)
    {
        return marketBidders[_marketId];
    }

    /**
     * @notice Get markets a user has participated in
     */
    function getUserParticipatedMarkets(address _user)
        external
        view
        returns (uint256[] memory)
    {
        return userParticipatedMarkets[_user];
    }

    /**
     * @notice Get uptime checks for a market
     */
    function getUptimeChecks(uint256 _marketId)
        external
        view
        marketExists(_marketId)
        returns (UptimeCheck[] memory)
    {
        return marketUptimeChecks[_marketId];
    }

    /**
     * @notice Calculate potential winnings for a bet amount
     */
    function calculatePotentialWinnings(
        uint256 _marketId,
        Position _position,
        uint256 _amount
    )
        external
        view
        marketExists(_marketId)
        returns (uint256 grossWinnings, uint256 netWinnings)
    {
        Market storage market = markets[_marketId];

        uint256 newYesPool = market.yesPool;
        uint256 newNoPool = market.noPool;

        if (_position == Position.YES) {
            newYesPool += _amount;
        } else {
            newNoPool += _amount;
        }

        uint256 totalPool = newYesPool + newNoPool;
        uint256 winningPool = _position == Position.YES ? newYesPool : newNoPool;

        grossWinnings = (_amount * totalPool) / winningPool;
        uint256 platformFee = (grossWinnings * platformFeePercentage) / 10000;
        netWinnings = grossWinnings - platformFee;
    }

    // ============ Admin Functions ============

    /**
     * @notice Set the oracle address
     */
    function setOracleAddress(address _oracle) external onlyOwner {
        require(_oracle != address(0), "Invalid oracle address");
        address oldOracle = oracleAddress;
        oracleAddress = _oracle;
        emit OracleAddressUpdated(oldOracle, _oracle);
    }

    /**
     * @notice Update platform fee percentage
     */
    function setPlatformFee(uint256 _feePercentage) external onlyOwner {
        require(_feePercentage <= 1000, "Fee cannot exceed 10%");
        uint256 oldFee = platformFeePercentage;
        platformFeePercentage = _feePercentage;
        emit PlatformFeeUpdated(oldFee, _feePercentage);
    }

    /**
     * @notice Get total number of markets
     */
    function getTotalMarkets() external view returns (uint256) {
        return marketCounter;
    }

    /**
     * @notice Emergency withdraw (only for stuck funds in edge cases)
     */
    function emergencyWithdraw() external onlyOwner {
        (bool success, ) = owner().call{value: address(this).balance}("");
        require(success, "Withdraw failed");
    }

    // Receive ETH
    receive() external payable {}
}
