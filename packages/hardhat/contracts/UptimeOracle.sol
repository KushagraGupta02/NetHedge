// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

interface IUptimeMarket {
    function resolveMarket(uint256 _marketId, uint256 _uptimePercentage) external;
    function addUptimeCheck(uint256 _marketId, bool _isUp, uint256 _responseTime) external;
}

/**
 * @title UptimeOracle
 * @notice Multi-oracle consensus system with slashing for submitting website uptime data
 * @dev Implements 3-of-5 consensus mechanism with stake-based security
 */
contract UptimeOracle is Ownable, ReentrancyGuard {
    // ============ Constants ============

    uint256 public constant MINIMUM_STAKE = 0.1 ether;
    uint256 public constant CONSENSUS_THRESHOLD = 3; // Minimum 3 matching reports
    uint256 public constant MAX_UPTIME_VARIANCE = 100; // 1% variance allowed (in basis points)
    uint256 public constant REPORT_DEADLINE = 30 minutes; // Time window for all oracles to report

    // ============ State Variables ============

    address public marketContract;

    // Oracle management
    struct Oracle {
        bool isActive;
        uint256 stake;
        uint256 reportsSubmitted;
        uint256 correctReports;
        uint256 slashedAmount;
        uint256 registrationTime;
    }

    mapping(address => Oracle) public oracles;
    address[] public oracleList;

    // Market reporting
    struct Report {
        address reporter;
        uint256 uptimePercentage;
        uint256 timestamp;
    }

    struct MarketConsensus {
        uint256 reportDeadline;
        uint256 totalReports;
        bool resolved;
        uint256 finalUptime;
        mapping(uint256 => uint256) uptimeVotes; // uptime => vote count
        mapping(address => bool) hasReported;
        Report[] reports;
    }

    mapping(uint256 => MarketConsensus) public marketReports;

    // ============ Events ============

    event OracleRegistered(address indexed oracle, uint256 stake);
    event OracleDeregistered(address indexed oracle, uint256 returnedStake);
    event StakeIncreased(address indexed oracle, uint256 newStake);
    event MarketContractUpdated(address indexed oldContract, address indexed newContract);

    event UptimeReportSubmitted(
        uint256 indexed marketId,
        address indexed reporter,
        uint256 uptimePercentage,
        uint256 timestamp,
        uint256 totalReports
    );

    event ConsensusReached(
        uint256 indexed marketId,
        uint256 finalUptime,
        uint256 consensusReports,
        uint256 totalReports
    );

    event OracleSlashed(
        address indexed oracle,
        uint256 indexed marketId,
        uint256 slashedAmount,
        uint256 reportedUptime,
        uint256 consensusUptime
    );

    event UptimeCheckSubmitted(
        uint256 indexed marketId,
        bool isUp,
        uint256 responseTime,
        address indexed reporter,
        uint256 timestamp
    );

    event ReportDeadlineSet(
        uint256 indexed marketId,
        uint256 deadline
    );

    // ============ Modifiers ============

    modifier onlyActiveOracle() {
        require(oracles[msg.sender].isActive, "Not an active oracle");
        _;
    }

    modifier marketNotResolved(uint256 _marketId) {
        require(!marketReports[_marketId].resolved, "Market already resolved");
        _;
    }

    // ============ Constructor ============

    constructor(address _initialOwner) Ownable(_initialOwner) {
        // Owner is NOT automatically an oracle in multi-oracle system
    }

    // ============ Oracle Management ============

    /**
     * @notice Register as an oracle by staking ETH
     */
    function registerOracle() external payable {
        require(!oracles[msg.sender].isActive, "Already registered");
        require(msg.value >= MINIMUM_STAKE, "Insufficient stake");

        oracles[msg.sender] = Oracle({
            isActive: true,
            stake: msg.value,
            reportsSubmitted: 0,
            correctReports: 0,
            slashedAmount: 0,
            registrationTime: block.timestamp
        });

        oracleList.push(msg.sender);

        emit OracleRegistered(msg.sender, msg.value);
    }

    /**
     * @notice Increase oracle stake
     */
    function increaseStake() external payable onlyActiveOracle {
        oracles[msg.sender].stake += msg.value;
        emit StakeIncreased(msg.sender, oracles[msg.sender].stake);
    }

    /**
     * @notice Deregister as oracle and withdraw stake
     */
    function deregisterOracle() external onlyActiveOracle nonReentrant {
        Oracle storage oracle = oracles[msg.sender];

        // Stake has already been reduced by slashing, so just return the remaining stake
        uint256 returnAmount = oracle.stake;
        require(returnAmount > 0, "No stake to return");

        oracle.isActive = false;

        // Transfer stake back
        (bool success, ) = msg.sender.call{value: returnAmount}("");
        require(success, "Stake return failed");

        emit OracleDeregistered(msg.sender, returnAmount);
    }

    // ============ Core Reporting Functions ============

    /**
     * @notice Submit a single uptime check during the monitoring period
     * @param _marketId The market ID to submit check for
     * @param _isUp Whether the website was up during this check
     * @param _responseTime Response time in milliseconds
     */
    function submitUptimeCheck(
        uint256 _marketId,
        bool _isUp,
        uint256 _responseTime
    ) external onlyActiveOracle {
        require(marketContract != address(0), "Market contract not set");

        // Submit check to market contract
        IUptimeMarket(marketContract).addUptimeCheck(_marketId, _isUp, _responseTime);

        emit UptimeCheckSubmitted(_marketId, _isUp, _responseTime, msg.sender, block.timestamp);
    }

    /**
     * @notice Initialize reporting window for a market
     * @param _marketId The market ID
     */
    function initializeReporting(uint256 _marketId) external onlyActiveOracle {
        MarketConsensus storage consensus = marketReports[_marketId];
        require(consensus.reportDeadline == 0, "Already initialized");

        consensus.reportDeadline = block.timestamp + REPORT_DEADLINE;
        emit ReportDeadlineSet(_marketId, consensus.reportDeadline);
    }

    /**
     * @notice Submit uptime report for consensus
     * @param _marketId The market ID to report for
     * @param _uptimePercentage Uptime in basis points (9900 = 99%)
     */
    function reportUptime(
        uint256 _marketId,
        uint256 _uptimePercentage
    ) external onlyActiveOracle marketNotResolved(_marketId) {
        require(_uptimePercentage <= 10000, "Invalid uptime percentage");
        require(marketContract != address(0), "Market contract not set");

        MarketConsensus storage consensus = marketReports[_marketId];

        // Initialize if first report
        if (consensus.reportDeadline == 0) {
            consensus.reportDeadline = block.timestamp + REPORT_DEADLINE;
            emit ReportDeadlineSet(_marketId, consensus.reportDeadline);
        }

        require(block.timestamp <= consensus.reportDeadline, "Report deadline passed");
        require(!consensus.hasReported[msg.sender], "Already reported for this market");

        // Record the report
        consensus.reports.push(Report({
            reporter: msg.sender,
            uptimePercentage: _uptimePercentage,
            timestamp: block.timestamp
        }));

        consensus.hasReported[msg.sender] = true;
        consensus.totalReports++;
        consensus.uptimeVotes[_uptimePercentage]++;

        oracles[msg.sender].reportsSubmitted++;

        emit UptimeReportSubmitted(
            _marketId,
            msg.sender,
            _uptimePercentage,
            block.timestamp,
            consensus.totalReports
        );

        // Check if consensus is reached
        _tryReachConsensus(_marketId);
    }

    /**
     * @notice Finalize consensus after deadline (anyone can call)
     * @param _marketId The market ID
     */
    function finalizeConsensus(uint256 _marketId) external marketNotResolved(_marketId) {
        MarketConsensus storage consensus = marketReports[_marketId];
        require(consensus.reportDeadline > 0, "Reporting not initialized");
        require(block.timestamp > consensus.reportDeadline, "Deadline not passed");
        require(consensus.totalReports > 0, "No reports submitted");

        _tryReachConsensus(_marketId);
    }

    // ============ Internal Functions ============

    /**
     * @notice Try to reach consensus and resolve market
     */
    function _tryReachConsensus(uint256 _marketId) internal {
        MarketConsensus storage consensus = marketReports[_marketId];

        // Find the uptime percentage with most votes
        uint256 maxVotes = 0;
        uint256 consensusUptime = 0;

        for (uint256 i = 0; i < consensus.reports.length; i++) {
            uint256 uptime = consensus.reports[i].uptimePercentage;
            uint256 votes = consensus.uptimeVotes[uptime];

            if (votes > maxVotes) {
                maxVotes = votes;
                consensusUptime = uptime;
            }
        }

        // Check if consensus threshold is met
        if (maxVotes >= CONSENSUS_THRESHOLD) {
            consensus.resolved = true;
            consensus.finalUptime = consensusUptime;

            // Resolve market
            IUptimeMarket(marketContract).resolveMarket(_marketId, consensusUptime);

            emit ConsensusReached(_marketId, consensusUptime, maxVotes, consensus.totalReports);

            // Process slashing for incorrect reports
            _processSlashing(_marketId, consensusUptime);
        } else if (block.timestamp > consensus.reportDeadline) {
            // Deadline passed but no consensus - use median
            uint256 medianUptime = _calculateMedian(_marketId);

            consensus.resolved = true;
            consensus.finalUptime = medianUptime;

            IUptimeMarket(marketContract).resolveMarket(_marketId, medianUptime);

            emit ConsensusReached(_marketId, medianUptime, maxVotes, consensus.totalReports);

            _processSlashing(_marketId, medianUptime);
        }
    }

    /**
     * @notice Calculate median uptime from all reports
     */
    function _calculateMedian(uint256 _marketId) internal view returns (uint256) {
        MarketConsensus storage consensus = marketReports[_marketId];
        uint256[] memory uptimes = new uint256[](consensus.reports.length);

        for (uint256 i = 0; i < consensus.reports.length; i++) {
            uptimes[i] = consensus.reports[i].uptimePercentage;
        }

        // Simple bubble sort
        for (uint256 i = 0; i < uptimes.length; i++) {
            for (uint256 j = i + 1; j < uptimes.length; j++) {
                if (uptimes[i] > uptimes[j]) {
                    uint256 temp = uptimes[i];
                    uptimes[i] = uptimes[j];
                    uptimes[j] = temp;
                }
            }
        }

        if (uptimes.length % 2 == 0) {
            return (uptimes[uptimes.length / 2 - 1] + uptimes[uptimes.length / 2]) / 2;
        } else {
            return uptimes[uptimes.length / 2];
        }
    }

    /**
     * @notice Slash oracles that reported significantly different values
     */
    function _processSlashing(uint256 _marketId, uint256 _consensusUptime) internal {
        MarketConsensus storage consensus = marketReports[_marketId];

        for (uint256 i = 0; i < consensus.reports.length; i++) {
            Report memory report = consensus.reports[i];
            address reporter = report.reporter;
            uint256 reportedUptime = report.uptimePercentage;

            // Calculate variance from consensus
            uint256 variance = reportedUptime > _consensusUptime
                ? reportedUptime - _consensusUptime
                : _consensusUptime - reportedUptime;

            Oracle storage oracle = oracles[reporter];

            if (variance <= MAX_UPTIME_VARIANCE) {
                // Correct report - increment counter
                oracle.correctReports++;
            } else {
                // Incorrect report - slash stake
                uint256 slashAmount = oracle.stake / 10; // 10% of stake

                if (slashAmount > 0) {
                    oracle.slashedAmount += slashAmount;
                    oracle.stake -= slashAmount;

                    // Transfer slashed amount to contract owner (protocol treasury)
                    (bool success, ) = owner().call{value: slashAmount}("");
                    require(success, "Slash transfer failed");

                    emit OracleSlashed(reporter, _marketId, slashAmount, reportedUptime, _consensusUptime);
                }
            }
        }
    }

    // ============ View Functions ============

    /**
     * @notice Get oracle information
     */
    function getOracleInfo(address _oracle) external view returns (
        bool isActive,
        uint256 stake,
        uint256 reportsSubmitted,
        uint256 correctReports,
        uint256 slashedAmount,
        uint256 accuracy
    ) {
        Oracle memory oracle = oracles[_oracle];
        isActive = oracle.isActive;
        stake = oracle.stake;
        reportsSubmitted = oracle.reportsSubmitted;
        correctReports = oracle.correctReports;
        slashedAmount = oracle.slashedAmount;

        if (oracle.reportsSubmitted > 0) {
            accuracy = (oracle.correctReports * 10000) / oracle.reportsSubmitted;
        } else {
            accuracy = 0;
        }
    }

    /**
     * @notice Get all active oracles
     */
    function getActiveOracles() external view returns (address[] memory) {
        uint256 activeCount = 0;

        for (uint256 i = 0; i < oracleList.length; i++) {
            if (oracles[oracleList[i]].isActive) {
                activeCount++;
            }
        }

        address[] memory activeOracles = new address[](activeCount);
        uint256 index = 0;

        for (uint256 i = 0; i < oracleList.length; i++) {
            if (oracles[oracleList[i]].isActive) {
                activeOracles[index] = oracleList[i];
                index++;
            }
        }

        return activeOracles;
    }

    /**
     * @notice Get market consensus status
     */
    function getMarketConsensus(uint256 _marketId) external view returns (
        uint256 reportDeadline,
        uint256 totalReports,
        bool resolved,
        uint256 finalUptime
    ) {
        MarketConsensus storage consensus = marketReports[_marketId];
        return (
            consensus.reportDeadline,
            consensus.totalReports,
            consensus.resolved,
            consensus.finalUptime
        );
    }

    /**
     * @notice Get all reports for a market
     */
    function getMarketReports(uint256 _marketId) external view returns (Report[] memory) {
        return marketReports[_marketId].reports;
    }

    /**
     * @notice Check if oracle has reported for market
     */
    function hasOracleReported(uint256 _marketId, address _oracle) external view returns (bool) {
        return marketReports[_marketId].hasReported[_oracle];
    }

    // ============ Admin Functions ============

    /**
     * @notice Set the market contract address
     */
    function setMarketContract(address _marketContract) external onlyOwner {
        require(_marketContract != address(0), "Invalid address");
        address oldContract = marketContract;
        marketContract = _marketContract;
        emit MarketContractUpdated(oldContract, _marketContract);
    }

    /**
     * @notice Emergency function to force deactivate a malicious oracle
     */
    function forceDeactivateOracle(address _oracle) external onlyOwner {
        require(oracles[_oracle].isActive, "Oracle not active");
        oracles[_oracle].isActive = false;
        emit OracleDeregistered(_oracle, 0);
    }

    /**
     * @notice Get total number of oracles
     */
    function getTotalOracles() external view returns (uint256) {
        return oracleList.length;
    }
}
