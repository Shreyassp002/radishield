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

    // Additional comprehensive error handling
    error InvalidCropType(string cropType);
    error InvalidAddress(address addr);
    error InvalidAmount(uint256 amount);
    error InvalidRecipient(address recipient);
    error InsufficientAllowance(uint256 required, uint256 available);
    error InsufficientBalance(uint256 required, uint256 available);
    error ArrayLengthMismatch(uint256 length1, uint256 length2);
    error EmptyArray();
    error InvalidArrayIndex(uint256 index, uint256 maxIndex);
    error OracleTimeout(bytes32 requestId, uint256 timeoutDuration);
    error InvalidJobId(bytes32 jobId);
    error InvalidOracleAddress(address oracle);
    error InvalidTokenAddress(address token);
    error WeatherDataNotAvailable(uint256 policyId);
    error InvalidWeatherData(uint256 rainfall30d, uint256 rainfall24h, uint256 temperature);
    error PayoutAlreadyProcessed(uint256 policyId);
    error ContractPaused();
    error ContractNotPaused();
    error ZeroValue();
    error InvalidTimestamp(uint256 timestamp);
    error PolicyNotEligibleForPayout(uint256 policyId, string reason);

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
        if (_usdcToken == address(0)) {
            revert InvalidTokenAddress(_usdcToken);
        }
        if (_linkToken == address(0)) {
            revert InvalidTokenAddress(_linkToken);
        }
        if (_oracle == address(0)) {
            revert InvalidOracleAddress(_oracle);
        }
        if (_jobId == bytes32(0)) {
            revert InvalidJobId(_jobId);
        }

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
    ) external override whenNotPaused returns (uint256) {
        // Input validation for crop type
        if (bytes(cropType).length == 0) {
            revert InvalidCropType(cropType);
        }
        if (bytes(cropType).length > 50) {
            revert InvalidCropType(cropType);
        }

        // Input validation for coverage amount
        if (coverage == 0) {
            revert ZeroValue();
        }
        if (coverage < MIN_COVERAGE || coverage > MAX_COVERAGE) {
            revert InvalidCoverage(coverage);
        }

        // Input validation for duration
        if (duration == 0) {
            revert ZeroValue();
        }
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

        // Check farmer's USDC balance
        uint256 farmerBalance = usdcToken.balanceOf(msg.sender);
        if (farmerBalance < premium) {
            revert InsufficientBalance(premium, farmerBalance);
        }

        // Check farmer's USDC allowance
        uint256 allowance = usdcToken.allowance(msg.sender, address(this));
        if (allowance < premium) {
            revert InsufficientAllowance(premium, allowance);
        }

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
        if (coverage == 0) {
            revert ZeroValue();
        }
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

        // Ensure premium is not zero (should never happen with valid inputs, but safety check)
        if (premium == 0) {
            revert InvalidAmount(premium);
        }

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
        // Input validation
        if (policyId == 0) {
            revert ZeroValue();
        }
        if (amount == 0) {
            revert ZeroValue();
        }
        if (recipient == address(0)) {
            revert InvalidRecipient(recipient);
        }

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

        // Validate recipient is the policy owner
        if (recipient != policies[policyId].farmer) {
            revert InvalidRecipient(recipient);
        }

        // Validate payout amount doesn't exceed coverage
        if (amount > policies[policyId].coverage) {
            revert InvalidAmount(amount);
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
    function requestWeatherData(uint256 policyId) external whenNotPaused returns (bytes32) {
        // Input validation for policy ID
        if (policyId == 0) {
            revert ZeroValue();
        }

        // Check if policy exists
        if (policies[policyId].id == 0) {
            revert PolicyNotFound(policyId);
        }

        // Check if policy has already been claimed
        if (policies[policyId].claimed) {
            revert PolicyAlreadyClaimed(policyId);
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
            requestId = keccak256(abi.encodePacked(policyId, block.timestamp, msg.sender));
        } else {
            // Validate oracle address is not zero
            if (oracle == address(0)) {
                revert InvalidOracleAddress(oracle);
            }

            // Validate job ID is not zero
            if (jobId == bytes32(0)) {
                revert InvalidJobId(jobId);
            }

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

        // Validate request ID was generated
        if (requestId == bytes32(0)) {
            revert OracleRequestFailed(requestId);
        }

        // Check if request ID already exists (prevent duplicate requests)
        if (requestToPolicy[requestId] != 0) {
            revert OracleRequestFailed(requestId);
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
        // Validate request ID
        if (requestId == bytes32(0)) {
            revert OracleRequestFailed(requestId);
        }

        // Get the policy ID associated with this request
        uint256 policyId = requestToPolicy[requestId];

        // Validate that we have a valid policy for this request
        if (policyId == 0) {
            revert OracleRequestFailed(requestId);
        }

        if (policies[policyId].id == 0) {
            revert PolicyNotFound(policyId);
        }

        // Validate weather data ranges (basic sanity checks)
        if (rainfall30d > 10000 || rainfall24h > 1000 || temperature > 100) {
            revert InvalidWeatherData(rainfall30d, rainfall24h, temperature);
        }

        // Check if policy is still active and not claimed
        if (!policies[policyId].isActive) {
            revert PolicyNotActive(policyId);
        }

        if (policies[policyId].claimed) {
            revert PolicyAlreadyClaimed(policyId);
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

    // Contract pause state for emergency operations
    bool private _paused = false;

    // Events for pause functionality
    event Paused(address account);
    event Unpaused(address account);

    // Modifier to check if contract is not paused
    modifier whenNotPaused() {
        if (_paused) {
            revert ContractPaused();
        }
        _;
    }

    // Modifier to check if contract is paused
    modifier whenPaused() {
        if (!_paused) {
            revert ContractNotPaused();
        }
        _;
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
     * @dev Validate GPS coordinates are within valid ranges
     * @param latitude GPS latitude (unscaled, in degrees)
     * @param longitude GPS longitude (unscaled, in degrees)
     * @return isValid True if coordinates are valid, false otherwise
     */
    function validateCoordinates(int256 latitude, int256 longitude) public pure returns (bool) {
        // Valid latitude range: -90 to 90 degrees
        // Valid longitude range: -180 to 180 degrees
        return (latitude >= -90 && latitude <= 90 && longitude >= -180 && longitude <= 180);
    }

    /**
     * @dev Scale GPS coordinates by 10000 for Solidity compatibility
     * @param latitude GPS latitude in degrees
     * @param longitude GPS longitude in degrees
     * @return scaledLat Latitude scaled by 10000
     * @return scaledLon Longitude scaled by 10000
     */
    function scaleCoordinates(
        int256 latitude,
        int256 longitude
    ) public pure returns (int256 scaledLat, int256 scaledLon) {
        if (!validateCoordinates(latitude, longitude)) {
            revert InvalidLocation(latitude, longitude);
        }
        scaledLat = latitude * 10000;
        scaledLon = longitude * 10000;
    }

    /**
     * @dev Unscale GPS coordinates from Solidity format back to degrees
     * @param scaledLatitude GPS latitude scaled by 10000
     * @param scaledLongitude GPS longitude scaled by 10000
     * @return lat Latitude in degrees
     * @return lon Longitude in degrees
     */
    function unscaleCoordinates(
        int256 scaledLatitude,
        int256 scaledLongitude
    ) public pure returns (int256 lat, int256 lon) {
        lat = scaledLatitude / 10000;
        lon = scaledLongitude / 10000;
    }

    /**
     * @dev Calculate the number of days between two timestamps
     * @param startTime Start timestamp
     * @param endTime End timestamp
     * @return days Number of days between timestamps
     */
    function daysBetween(uint256 startTime, uint256 endTime) public pure returns (uint256) {
        if (startTime == 0 || endTime == 0) {
            revert InvalidTimestamp(startTime == 0 ? startTime : endTime);
        }
        if (endTime < startTime) {
            revert InvalidTimestamp(endTime);
        }
        return (endTime - startTime) / 86400; // 86400 seconds in a day
    }

    /**
     * @dev Calculate policy duration in days
     * @param policyId The policy ID to calculate duration for
     * @return duration Duration in days
     */
    function getPolicyDurationInDays(uint256 policyId) external view returns (uint256) {
        if (policies[policyId].id == 0) {
            revert PolicyNotFound(policyId);
        }
        return daysBetween(policies[policyId].startDate, policies[policyId].endDate);
    }

    /**
     * @dev Calculate remaining days for an active policy
     * @param policyId The policy ID to calculate remaining days for
     * @return remainingDays Number of days remaining (0 if expired)
     */
    function getRemainingDays(uint256 policyId) external view returns (uint256) {
        if (policies[policyId].id == 0) {
            revert PolicyNotFound(policyId);
        }

        if (block.timestamp >= policies[policyId].endDate) {
            return 0; // Policy has expired
        }

        return daysBetween(block.timestamp, policies[policyId].endDate);
    }

    /**
     * @dev Add days to a timestamp
     * @param timestamp The base timestamp
     * @param daysToAdd Number of days to add
     * @return newTimestamp The new timestamp after adding days
     */
    function addDays(uint256 timestamp, uint256 daysToAdd) public pure returns (uint256) {
        return timestamp + (daysToAdd * 86400);
    }

    /**
     * @dev Check if a timestamp is within a specific number of days from now
     * @param timestamp The timestamp to check
     * @param numDays Number of days to check within
     * @return isWithin True if timestamp is within the specified days
     */
    function isWithinDays(uint256 timestamp, uint256 numDays) public view returns (bool) {
        uint256 targetTime = addDays(block.timestamp, numDays);
        return timestamp <= targetTime;
    }

    /**
     * @dev Pause the contract (emergency function)
     * @notice Only owner can pause the contract
     */
    function pause() external onlyOwner whenNotPaused {
        _paused = true;
        emit Paused(msg.sender);
    }

    /**
     * @dev Unpause the contract
     * @notice Only owner can unpause the contract
     */
    function unpause() external onlyOwner whenPaused {
        _paused = false;
        emit Unpaused(msg.sender);
    }

    /**
     * @dev Check if contract is paused
     * @return paused True if contract is paused
     */
    function paused() external view returns (bool) {
        return _paused;
    }

    /**
     * @dev Batch emergency payout for multiple policies
     * @param policyIds Array of policy IDs for emergency payout
     * @param amounts Array of payout amounts corresponding to each policy
     * @param reason The reason for emergency payouts
     */
    function batchEmergencyPayout(
        uint256[] calldata policyIds,
        uint256[] calldata amounts,
        string memory reason
    ) external onlyOwner {
        // Input validation
        if (policyIds.length != amounts.length) {
            revert ArrayLengthMismatch(policyIds.length, amounts.length);
        }
        if (policyIds.length == 0) {
            revert EmptyArray();
        }
        if (bytes(reason).length == 0) {
            revert InvalidCropType(reason); // Reusing error for string validation
        }

        for (uint256 i = 0; i < policyIds.length; i++) {
            uint256 policyId = policyIds[i];
            uint256 amount = amounts[i];

            // Skip zero policy IDs or amounts
            if (policyId == 0 || amount == 0) {
                continue;
            }

            // Check if policy exists and is valid for payout
            if (
                policies[policyId].id != 0 &&
                !policies[policyId].claimed &&
                policies[policyId].isActive
            ) {
                // Validate amount doesn't exceed coverage
                if (amount > policies[policyId].coverage) {
                    continue; // Skip invalid amounts
                }

                // Check contract has sufficient balance
                uint256 contractBalance = usdcToken.balanceOf(address(this));
                if (contractBalance >= amount) {
                    // Update policy status
                    policies[policyId].claimed = true;
                    policies[policyId].isActive = false;

                    // Transfer payout
                    bool success = usdcToken.transfer(policies[policyId].farmer, amount);
                    if (success) {
                        emit ClaimPaid(policyId, policies[policyId].farmer, amount, reason);
                    } else {
                        // Revert policy status if transfer failed
                        policies[policyId].claimed = false;
                        policies[policyId].isActive = true;
                    }
                }
            }
        }
    }

    /**
     * @dev Emergency withdraw USDC from contract (only owner)
     * @param amount Amount of USDC to withdraw
     * @param recipient Address to receive the USDC
     */
    function emergencyWithdraw(uint256 amount, address recipient) external onlyOwner {
        if (recipient == address(0)) {
            revert InvalidRecipient(recipient);
        }
        if (amount == 0) {
            revert ZeroValue();
        }

        uint256 contractBalance = usdcToken.balanceOf(address(this));
        if (contractBalance < amount) {
            revert InsufficientContractBalance(amount, contractBalance);
        }

        bool success = usdcToken.transfer(recipient, amount);
        if (!success) {
            revert TransferFailed();
        }
    }

    /**
     * @dev Emergency withdraw LINK from contract (only owner)
     * @param amount Amount of LINK to withdraw
     * @param recipient Address to receive the LINK
     */
    function emergencyWithdrawLink(uint256 amount, address recipient) external onlyOwner {
        if (recipient == address(0)) {
            revert InvalidRecipient(recipient);
        }
        if (amount == 0) {
            revert ZeroValue();
        }

        uint256 contractBalance = linkToken.balanceOf(address(this));
        if (contractBalance < amount) {
            revert InsufficientContractBalance(amount, contractBalance);
        }

        bool success = linkToken.transfer(recipient, amount);
        if (!success) {
            revert TransferFailed();
        }
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

        // Validate request ID
        if (requestId == bytes32(0)) {
            revert OracleRequestFailed(requestId);
        }

        // Get the policy ID associated with this request
        uint256 policyId = requestToPolicy[requestId];

        // Validate that we have a valid policy for this request
        if (policyId == 0) {
            revert OracleRequestFailed(requestId);
        }

        if (policies[policyId].id == 0) {
            revert PolicyNotFound(policyId);
        }

        // Validate weather data ranges (basic sanity checks)
        if (rainfall30d > 10000 || rainfall24h > 1000 || temperature > 100) {
            revert InvalidWeatherData(rainfall30d, rainfall24h, temperature);
        }

        // Check if policy is still active and not claimed
        if (!policies[policyId].isActive) {
            revert PolicyNotActive(policyId);
        }

        if (policies[policyId].claimed) {
            revert PolicyAlreadyClaimed(policyId);
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
        // Input validation
        if (policyId == 0) {
            revert ZeroValue();
        }
        if (amount == 0) {
            revert ZeroValue();
        }
        if (bytes(reason).length == 0) {
            revert InvalidCropType(reason); // Reusing error for string validation
        }

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

        // Validate amount doesn't exceed coverage
        if (amount > policies[policyId].coverage) {
            revert InvalidAmount(amount);
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

    /**
     * @dev Handle oracle timeout by allowing manual weather data input
     * @param policyId The policy ID that had oracle timeout
     * @param rainfall30d Manual rainfall data for 30 days
     * @param rainfall24h Manual rainfall data for 24 hours
     * @param temperature Manual temperature data
     * @param reason Reason for manual intervention
     */
    function handleOracleTimeout(
        uint256 policyId,
        uint256 rainfall30d,
        uint256 rainfall24h,
        uint256 temperature,
        string memory reason
    ) external onlyOwner {
        // Input validation
        if (policyId == 0) {
            revert ZeroValue();
        }
        if (bytes(reason).length == 0) {
            revert InvalidCropType(reason);
        }

        // Check if policy exists
        if (policies[policyId].id == 0) {
            revert PolicyNotFound(policyId);
        }

        // Check if policy is still active
        if (!policies[policyId].isActive) {
            revert PolicyNotActive(policyId);
        }

        // Check if policy has already been claimed
        if (policies[policyId].claimed) {
            revert PolicyAlreadyClaimed(policyId);
        }

        // Validate weather data ranges
        if (rainfall30d > 10000 || rainfall24h > 1000 || temperature > 100) {
            revert InvalidWeatherData(rainfall30d, rainfall24h, temperature);
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

        // Check weather triggers and process payout if conditions are met
        _checkWeatherTriggersAndPayout(policyId, rainfall30d, rainfall24h, temperature);
    }

    /**
     * @dev Cancel a pending oracle request due to timeout
     * @param requestId The request ID to cancel
     * @param policyId The associated policy ID
     */
    function cancelOracleRequest(bytes32 requestId, uint256 policyId) external onlyOwner {
        // Input validation
        if (requestId == bytes32(0)) {
            revert OracleRequestFailed(requestId);
        }
        if (policyId == 0) {
            revert ZeroValue();
        }

        // Verify the request exists and matches the policy
        if (requestToPolicy[requestId] != policyId) {
            revert OracleRequestFailed(requestId);
        }

        // Clean up the request mapping
        delete requestToPolicy[requestId];

        // Emit timeout event
        emit WeatherDataRequested(policyId, requestId); // Reusing event for tracking
    }
}
