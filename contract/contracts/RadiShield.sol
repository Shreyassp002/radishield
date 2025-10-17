// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@chainlink/contracts/src/v0.8/operatorforwarder/ChainlinkClient.sol";
import "@chainlink/contracts/src/v0.8/shared/interfaces/LinkTokenInterface.sol";
import "./interfaces/IRadiShield.sol";

/**
 * @title RadiShield
 * @dev Parametric crop insurance contract using Chainlink oracles for weather data
 */
contract RadiShield is IRadiShield, ChainlinkClient, ReentrancyGuard, Ownable {
    // Custom Errors for better error handling
    error InsufficientPremium(uint256 required, uint256 provided);
    error PolicyNotFound(uint256 policyId);
    error PolicyNotActive(uint256 policyId);
    error PolicyAlreadyClaimed(uint256 policyId);
    error InvalidLocation(int256 lat, int256 lon);
    error InsufficientContractBalance(uint256 required, uint256 available);

    error InvalidCoverage(uint256 coverage);
    error InvalidDuration(uint256 duration);
    error PolicyExpired(uint256 policyId);
    error TransferFailed();

    // State variables for contract configuration
    IERC20 public immutable usdcToken;
    address public immutable oracle;
    bytes32 public immutable jobId;
    LinkTokenInterface public immutable linkToken;

    // Policy management
    uint256 private nextPolicyId = 1;
    mapping(uint256 => Policy) public policies;
    mapping(address => uint256[]) public farmerPolicies;
    mapping(bytes32 => uint256) private requestToPolicy;
    mapping(uint256 => WeatherData) private policyWeatherData;

    // Constants
    uint256 public constant BASE_PREMIUM_RATE = 700; // 7% in basis points (7% = 700/10000)
    uint256 public constant ORACLE_FEE = 0.1 * 10 ** 18; // 0.1 LINK

    uint256 public constant DROUGHT_THRESHOLD = 50; // mm in 30 days
    uint256 public constant FLOOD_THRESHOLD = 100; // mm in 24 hours
    uint256 public constant HEATWAVE_THRESHOLD = 38; // Celsius
    uint256 public constant HEATWAVE_PAYOUT_RATE = 75; // 75% payout
    uint256 public constant MIN_COVERAGE = 100 * 10 ** 6; // $100 USDC minimum
    uint256 public constant MAX_COVERAGE = 10000 * 10 ** 6; // $10,000 USDC maximum
    uint256 public constant MIN_DURATION = 30 days; // Minimum 30 days
    uint256 public constant MAX_DURATION = 365 days; // Maximum 1 year

    // Additional events for comprehensive logging
    event PremiumCalculated(uint256 coverage, int256 lat, int256 lon, uint256 premium);
    event WeatherDataReceived(
        uint256 indexed policyId,
        uint256 rainfall30d,
        uint256 rainfall24h,
        uint256 temperature
    );
    event PayoutTriggered(uint256 indexed policyId, string triggerType, uint256 payoutAmount);

    /**
     * @dev Constructor initializes the contract with required addresses and parameters
     * @param _usdcToken Address of the USDC token contract
     * @param _linkToken Address of the LINK token contract
     * @param _oracle Address of the Chainlink oracle
     * @param _jobId Job ID for the Chainlink AccuWeather oracle
     */
    constructor(
        address _usdcToken,
        address _linkToken,
        address _oracle,
        bytes32 _jobId
    ) Ownable(msg.sender) {
        require(_usdcToken != address(0), "Invalid USDC token address");
        require(_linkToken != address(0), "Invalid LINK token address");
        require(_oracle != address(0), "Invalid oracle address");
        require(_jobId != bytes32(0), "Invalid job ID");

        usdcToken = IERC20(_usdcToken);
        linkToken = LinkTokenInterface(_linkToken);
        oracle = _oracle;
        jobId = _jobId;

        _setChainlinkToken(_linkToken);
        _setChainlinkOracle(_oracle);
    }

    // Implementation functions will be added in subsequent tasks
    // This file establishes the core structure and data definitions

    /**
     * @dev Create a new insurance policy
     * @param cropType Type of crop being insured (e.g., "maize", "coffee")
     * @param coverage Coverage amount in USDC (6 decimals)
     * @param duration Policy duration in seconds
     * @param latitude GPS latitude (will be scaled by 10000 for Solidity compatibility)
     * @param longitude GPS longitude (will be scaled by 10000 for Solidity compatibility)
     * @return policyId The unique ID of the created policy
     */
    function createPolicy(
        string memory cropType,
        uint256 coverage,
        uint256 duration,
        int256 latitude,
        int256 longitude
    ) external override returns (uint256) {
        // Input validation for coverage amount
        if (coverage < MIN_COVERAGE || coverage > MAX_COVERAGE) {
            revert InvalidCoverage(coverage);
        }

        // Input validation for duration
        if (duration < MIN_DURATION || duration > MAX_DURATION) {
            revert InvalidDuration(duration);
        }

        // Scale GPS coordinates by 10000 for Solidity compatibility
        int256 scaledLatitude = latitude * 10000;
        int256 scaledLongitude = longitude * 10000;

        // Input validation for GPS coordinates (after scaling)
        // Valid latitude range: -90 to 90 degrees (scaled by 10000: -900000 to 900000)
        // Valid longitude range: -180 to 180 degrees (scaled by 10000: -1800000 to 1800000)
        if (
            scaledLatitude < -900000 ||
            scaledLatitude > 900000 ||
            scaledLongitude < -1800000 ||
            scaledLongitude > 1800000
        ) {
            revert InvalidLocation(scaledLatitude, scaledLongitude);
        }

        // Calculate premium using the existing calculatePremium function
        uint256 premium = this.calculatePremium(coverage, scaledLatitude, scaledLongitude);

        // Transfer premium from farmer to contract
        bool success = usdcToken.transferFrom(msg.sender, address(this), premium);
        if (!success) {
            revert TransferFailed();
        }

        // Generate unique policy ID
        uint256 policyId = nextPolicyId++;

        // Set policy timestamps
        uint256 startDate = block.timestamp;
        uint256 endDate = startDate + duration;

        // Create and store the policy
        Policy memory newPolicy = Policy({
            id: policyId,
            farmer: msg.sender,
            cropType: cropType,
            coverage: coverage,
            premium: premium,
            latitude: scaledLatitude,
            longitude: scaledLongitude,
            startDate: startDate,
            endDate: endDate,
            isActive: true,
            claimed: false
        });

        policies[policyId] = newPolicy;
        farmerPolicies[msg.sender].push(policyId);

        // Emit PolicyCreated event with complete policy details
        emit PolicyCreated(policyId, msg.sender, coverage, cropType);

        return policyId;
    }

    /**
     * @dev Calculate premium for a policy based on coverage amount and GPS coordinates
     * @param coverage Coverage amount in USDC (6 decimals)
     * @param latitude GPS latitude scaled by 10000 for Solidity compatibility
     * @param longitude GPS longitude scaled by 10000 for Solidity compatibility
     * @return premium Premium amount in USDC (6 decimals)
     */
    function calculatePremium(
        uint256 coverage,
        int256 latitude,
        int256 longitude
    ) external override returns (uint256) {
        // Input validation for coverage amount
        if (coverage < MIN_COVERAGE || coverage > MAX_COVERAGE) {
            revert InvalidCoverage(coverage);
        }

        // Input validation for GPS coordinates
        // Valid latitude range: -90 to 90 degrees (scaled by 10000: -900000 to 900000)
        // Valid longitude range: -180 to 180 degrees (scaled by 10000: -1800000 to 1800000)
        if (
            latitude < -900000 || latitude > 900000 || longitude < -1800000 || longitude > 1800000
        ) {
            revert InvalidLocation(latitude, longitude);
        }

        // Calculate 7% base premium rate
        uint256 premium = (coverage * BASE_PREMIUM_RATE) / 10000;

        // Emit event for premium calculation
        emit PremiumCalculated(coverage, latitude, longitude, premium);

        return premium;
    }

    /**
     * @dev Get policy details (stub implementation)
     */
    function getPolicy(uint256 policyId) external view override returns (Policy memory) {
        return policies[policyId];
    }

    /**
     * @dev Get all policies for a farmer (stub implementation)
     */
    function getPoliciesByFarmer(address farmer) external view override returns (uint256[] memory) {
        return farmerPolicies[farmer];
    }
}
