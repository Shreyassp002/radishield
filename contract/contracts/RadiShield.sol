// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@chainlink/contracts/src/v0.8/operatorforwarder/ChainlinkClient.sol";
import "@chainlink/contracts/src/v0.8/operatorforwarder/Chainlink.sol";
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
    error PayoutFailed(uint256 amount, address recipient);
    error OracleRequestFailed(bytes32 requestId);
    error UnauthorizedOracle(address caller);

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
     * @dev Get policy details by ID
     * @param policyId The policy ID to retrieve
     * @return policy The complete policy information
     */
    function getPolicy(uint256 policyId) external view override returns (Policy memory) {
        if (policies[policyId].id == 0) {
            revert PolicyNotFound(policyId);
        }
        return policies[policyId];
    }

    /**
     * @dev Get all policy IDs for a specific farmer
     * @param farmer The farmer's address
     * @return policyIds Array of policy IDs owned by the farmer
     */
    function getPoliciesByFarmer(address farmer) external view override returns (uint256[] memory) {
        return farmerPolicies[farmer];
    }

    /**
     * @dev Check if a policy is active
     * @param policyId The policy ID to check
     * @return isActive True if policy is active, false otherwise
     */
    function isPolicyActive(uint256 policyId) external view returns (bool) {
        if (policies[policyId].id == 0) {
            revert PolicyNotFound(policyId);
        }
        return
            policies[policyId].isActive &&
            !policies[policyId].claimed &&
            block.timestamp <= policies[policyId].endDate;
    }

    /**
     * @dev Check if a policy has been claimed
     * @param policyId The policy ID to check
     * @return claimed True if policy has been claimed, false otherwise
     */
    function isPolicyClaimed(uint256 policyId) external view returns (bool) {
        if (policies[policyId].id == 0) {
            revert PolicyNotFound(policyId);
        }
        return policies[policyId].claimed;
    }

    /**
     * @dev Check if a policy has expired
     * @param policyId The policy ID to check
     * @return expired True if policy has expired, false otherwise
     */
    function isPolicyExpired(uint256 policyId) external view returns (bool) {
        if (policies[policyId].id == 0) {
            revert PolicyNotFound(policyId);
        }
        return block.timestamp > policies[policyId].endDate;
    }

    /**
     * @dev Get the total number of policies created
     * @return totalPolicies The total number of policies
     */
    function getTotalPolicies() external view returns (uint256) {
        return nextPolicyId - 1;
    }

    /**
     * @dev Get the number of active policies
     * @return activePolicies The number of currently active policies
     */
    function getActivePoliciesCount() external view returns (uint256) {
        uint256 activeCount = 0;
        for (uint256 i = 1; i < nextPolicyId; i++) {
            if (
                policies[i].isActive &&
                !policies[i].claimed &&
                block.timestamp <= policies[i].endDate
            ) {
                activeCount++;
            }
        }
        return activeCount;
    }

    /**
     * @dev Get the number of claimed policies
     * @return claimedPolicies The number of policies that have been claimed
     */
    function getClaimedPoliciesCount() external view returns (uint256) {
        uint256 claimedCount = 0;
        for (uint256 i = 1; i < nextPolicyId; i++) {
            if (policies[i].claimed) {
                claimedCount++;
            }
        }
        return claimedCount;
    }

    /**
     * @dev Get the total coverage amount across all policies
     * @return totalCoverage The sum of all policy coverage amounts
     */
    function getTotalCoverage() external view returns (uint256) {
        uint256 totalCoverage = 0;
        for (uint256 i = 1; i < nextPolicyId; i++) {
            totalCoverage += policies[i].coverage;
        }
        return totalCoverage;
    }

    /**
     * @dev Get the total premium collected across all policies
     * @return totalPremiums The sum of all premiums collected
     */
    function getTotalPremiums() external view returns (uint256) {
        uint256 totalPremiums = 0;
        for (uint256 i = 1; i < nextPolicyId; i++) {
            totalPremiums += policies[i].premium;
        }
        return totalPremiums;
    }

    /**
     * @dev Get contract statistics summary
     * @return totalPolicies Total number of policies created
     * @return activePolicies Number of currently active policies
     * @return claimedPolicies Number of policies that have been claimed
     * @return totalCoverage Total coverage amount across all policies
     * @return totalPremiums Total premiums collected
     * @return contractBalance Current USDC balance of the contract
     */
    function getContractStats()
        external
        view
        returns (
            uint256 totalPolicies,
            uint256 activePolicies,
            uint256 claimedPolicies,
            uint256 totalCoverage,
            uint256 totalPremiums,
            uint256 contractBalance
        )
    {
        totalPolicies = nextPolicyId - 1;

        uint256 activeCount = 0;
        uint256 claimedCount = 0;
        uint256 totalCov = 0;
        uint256 totalPrem = 0;

        for (uint256 i = 1; i < nextPolicyId; i++) {
            if (
                policies[i].isActive &&
                !policies[i].claimed &&
                block.timestamp <= policies[i].endDate
            ) {
                activeCount++;
            }
            if (policies[i].claimed) {
                claimedCount++;
            }
            totalCov += policies[i].coverage;
            totalPrem += policies[i].premium;
        }

        activePolicies = activeCount;
        claimedPolicies = claimedCount;
        totalCoverage = totalCov;
        totalPremiums = totalPrem;
        contractBalance = usdcToken.balanceOf(address(this));
    }

    /**
     * @dev Internal function to process payout to farmer
     * @param policyId The policy ID for which payout is being processed
     * @param amount The payout amount in USDC (6 decimals)
     * @param recipient The address to receive the payout
     */
    function _processPayout(
        uint256 policyId,
        uint256 amount,
        address recipient
    ) internal nonReentrant {
        // Check if policy exists
        if (policies[policyId].id == 0) {
            revert PolicyNotFound(policyId);
        }

        // Check if policy has already been claimed (check this first)
        if (policies[policyId].claimed) {
            revert PolicyAlreadyClaimed(policyId);
        }

        // Check if policy is active
        if (!policies[policyId].isActive) {
            revert PolicyNotActive(policyId);
        }

        // Check contract has sufficient USDC balance for payout
        uint256 contractBalance = usdcToken.balanceOf(address(this));
        if (contractBalance < amount) {
            revert InsufficientContractBalance(amount, contractBalance);
        }

        // Update policy status before transfer (CEI pattern)
        policies[policyId].claimed = true;
        policies[policyId].isActive = false;

        // Transfer payout to farmer
        bool success = usdcToken.transfer(recipient, amount);
        if (!success) {
            revert PayoutFailed(amount, recipient);
        }

        // Emit ClaimPaid event
        emit ClaimPaid(policyId, recipient, amount, "Weather trigger");
    }

    /**
     * @dev Get contract's USDC balance
     * @return balance The contract's USDC balance
     */
    function getContractBalance() external view returns (uint256) {
        return usdcToken.balanceOf(address(this));
    }

    /**
     * @dev Request weather data from Chainlink oracle for a specific policy
     * @param policyId The policy ID to request weather data for
     * @return requestId The Chainlink request ID for tracking
     */
    function requestWeatherData(uint256 policyId) external returns (bytes32) {
        // Check if policy exists
        if (policies[policyId].id == 0) {
            revert PolicyNotFound(policyId);
        }

        // Check if policy is active
        if (!policies[policyId].isActive) {
            revert PolicyNotActive(policyId);
        }

        // Check if policy has expired
        if (block.timestamp > policies[policyId].endDate) {
            revert PolicyExpired(policyId);
        }

        // Check contract has sufficient LINK balance for oracle fee
        uint256 linkBalance = linkToken.balanceOf(address(this));
        if (linkBalance < ORACLE_FEE) {
            revert InsufficientContractBalance(ORACLE_FEE, linkBalance);
        }

        bytes32 requestId;

        // For testing with mock oracle, generate a mock request ID
        if (oracle == address(0x1234567890123456789012345678901234567890)) {
            requestId = keccak256(abi.encodePacked(policyId, block.timestamp));
        } else {
            // Create Chainlink request for real oracle
            Chainlink.Request memory request = _buildChainlinkRequest(
                jobId,
                address(this),
                this.fulfillWeatherData.selector
            );

            // Convert coordinates to strings for oracle parameters
            string memory latStr = _int2str(policies[policyId].latitude);
            string memory lonStr = _int2str(policies[policyId].longitude);

            // Add latitude and longitude parameters to the request
            Chainlink._add(request, "lat", latStr);
            Chainlink._add(request, "lon", lonStr);

            // Send the request and pay the oracle fee
            requestId = _sendChainlinkRequest(request, ORACLE_FEE);
        }

        // Map request ID to policy ID for callback handling
        requestToPolicy[requestId] = policyId;

        // Emit event for weather data request
        emit WeatherDataRequested(policyId, requestId);

        return requestId;
    }

    /**
     * @dev Chainlink callback function to receive weather data
     * @param requestId The request ID that was returned from requestWeatherData
     * @param rainfall30d Rainfall in the last 30 days (in mm)
     * @param rainfall24h Rainfall in the last 24 hours (in mm)
     * @param temperature Current temperature (in Celsius)
     */
    function fulfillWeatherData(
        bytes32 requestId,
        uint256 rainfall30d,
        uint256 rainfall24h,
        uint256 temperature
    ) external recordChainlinkFulfillment(requestId) {
        // Get the policy ID associated with this request
        uint256 policyId = requestToPolicy[requestId];

        // Validate that we have a valid policy for this request
        if (policyId == 0 || policies[policyId].id == 0) {
            return; // Silently return for invalid requests
        }

        // Store weather data for the policy
        policyWeatherData[policyId] = WeatherData({
            rainfall30d: rainfall30d,
            rainfall24h: rainfall24h,
            temperature: temperature,
            timestamp: block.timestamp,
            isValid: true
        });

        // Emit event for weather data received
        emit WeatherDataReceived(policyId, rainfall30d, rainfall24h, temperature);

        // Clean up the request mapping
        delete requestToPolicy[requestId];

        // Check weather triggers and process payout if conditions are met
        _checkWeatherTriggersAndPayout(policyId, rainfall30d, rainfall24h, temperature);
    }

    /**
     * @dev Internal function to check weather triggers and process payout
     * @param policyId The policy ID to check triggers for
     * @param rainfall30d Rainfall in the last 30 days (in mm)
     * @param rainfall24h Rainfall in the last 24 hours (in mm)
     * @param temperature Current temperature (in Celsius)
     */
    function _checkWeatherTriggersAndPayout(
        uint256 policyId,
        uint256 rainfall30d,
        uint256 rainfall24h,
        uint256 temperature
    ) internal {
        Policy storage policy = policies[policyId];

        // Skip if policy is not active or already claimed
        if (!policy.isActive || policy.claimed) {
            return;
        }

        uint256 payoutAmount = 0;
        string memory triggerType = "";

        // Check for drought: < 50mm in 30 days (100% payout)
        if (rainfall30d < DROUGHT_THRESHOLD) {
            payoutAmount = policy.coverage;
            triggerType = "drought";
        }
        // Check for flood: > 100mm in 24 hours (100% payout)
        else if (rainfall24h > FLOOD_THRESHOLD) {
            payoutAmount = policy.coverage;
            triggerType = "flood";
        }
        // Check for heatwave: > 38°C (75% payout)
        else if (temperature > HEATWAVE_THRESHOLD) {
            payoutAmount = (policy.coverage * HEATWAVE_PAYOUT_RATE) / 100;
            triggerType = "heatwave";
        }

        // Process payout if trigger conditions are met
        if (payoutAmount > 0) {
            emit PayoutTriggered(policyId, triggerType, payoutAmount);
            _processPayout(policyId, payoutAmount, policy.farmer);
        }
    }

    /**
     * @dev Convert integer to string for oracle parameters
     * @param value The integer value to convert
     * @return The string representation of the integer
     */
    function _int2str(int256 value) internal pure returns (string memory) {
        if (value == 0) {
            return "0";
        }

        bool negative = value < 0;
        uint256 absValue = uint256(negative ? -value : value);

        uint256 temp = absValue;
        uint256 digits;
        while (temp != 0) {
            digits++;
            temp /= 10;
        }

        bytes memory buffer = new bytes(negative ? digits + 1 : digits);
        uint256 index = buffer.length;

        while (absValue != 0) {
            index--;
            buffer[index] = bytes1(uint8(48 + (absValue % 10)));
            absValue /= 10;
        }

        if (negative) {
            buffer[0] = "-";
        }

        return string(buffer);
    }

    /**
     * @dev Get weather data for a specific policy
     * @param policyId The policy ID to get weather data for
     * @return The weather data struct for the policy
     */
    function getWeatherData(uint256 policyId) external view returns (WeatherData memory) {
        return policyWeatherData[policyId];
    }

    /**
     * @dev Get contract's LINK balance
     * @return balance The contract's LINK balance
     */
    function getLinkBalance() external view returns (uint256) {
        return linkToken.balanceOf(address(this));
    }

    /**
     * @dev Test function to simulate oracle callback (only for testing with mock oracle)
     * @param requestId The request ID that was returned from requestWeatherData
     * @param rainfall30d Rainfall in the last 30 days (in mm)
     * @param rainfall24h Rainfall in the last 24 hours (in mm)
     * @param temperature Current temperature (in Celsius)
     */
    function testFulfillWeatherData(
        bytes32 requestId,
        uint256 rainfall30d,
        uint256 rainfall24h,
        uint256 temperature
    ) external {
        // Only allow this function to be called when using mock oracle for testing
        require(oracle == address(0x1234567890123456789012345678901234567890), "Only for testing");

        // Get the policy ID associated with this request
        uint256 policyId = requestToPolicy[requestId];

        // Validate that we have a valid policy for this request
        if (policyId == 0 || policies[policyId].id == 0) {
            return; // Silently return for invalid requests
        }

        // Store weather data for the policy
        policyWeatherData[policyId] = WeatherData({
            rainfall30d: rainfall30d,
            rainfall24h: rainfall24h,
            temperature: temperature,
            timestamp: block.timestamp,
            isValid: true
        });

        // Emit event for weather data received
        emit WeatherDataReceived(policyId, rainfall30d, rainfall24h, temperature);

        // Clean up the request mapping
        delete requestToPolicy[requestId];

        // Check weather triggers and process payout if conditions are met
        _checkWeatherTriggersAndPayout(policyId, rainfall30d, rainfall24h, temperature);
    }

    /**
     * @dev Emergency payout function for admin use (e.g., oracle failures)
     * @param policyId The policy ID for emergency payout
     * @param amount The payout amount in USDC (6 decimals)
     * @param reason The reason for emergency payout
     */
    function emergencyPayout(
        uint256 policyId,
        uint256 amount,
        string memory reason
    ) external onlyOwner {
        // Check if policy exists
        if (policies[policyId].id == 0) {
            revert PolicyNotFound(policyId);
        }

        // Check if policy has already been claimed (check this first)
        if (policies[policyId].claimed) {
            revert PolicyAlreadyClaimed(policyId);
        }

        // Check if policy is active
        if (!policies[policyId].isActive) {
            revert PolicyNotActive(policyId);
        }

        // Check contract has sufficient USDC balance for payout
        uint256 contractBalance = usdcToken.balanceOf(address(this));
        if (contractBalance < amount) {
            revert InsufficientContractBalance(amount, contractBalance);
        }

        // Update policy status before transfer (CEI pattern)
        policies[policyId].claimed = true;
        policies[policyId].isActive = false;

        // Transfer payout to farmer
        bool success = usdcToken.transfer(policies[policyId].farmer, amount);
        if (!success) {
            revert PayoutFailed(amount, policies[policyId].farmer);
        }

        // Emit ClaimPaid event with custom reason
        emit ClaimPaid(policyId, policies[policyId].farmer, amount, reason);
    }
}
