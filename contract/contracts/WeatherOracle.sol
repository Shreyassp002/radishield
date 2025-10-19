// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./interfaces/IWeatherOracle.sol";

/**
 * @title WeatherOracle
 * @dev Custom weather oracle contract that stores and provides weather data on-chain
 * Replaces Chainlink oracle dependency with a custom solution for RadiShield
 */
contract WeatherOracle is IWeatherOracle, Ownable, ReentrancyGuard {
    // Custom Errors for better error handling
    error InvalidCoordinates(int256 lat, int256 lon);
    error InvalidWeatherData(uint256 rainfall30d, uint256 rainfall24h, uint256 temperature);
    error UnauthorizedOracle(address caller);
    error DataNotFound(bytes32 locationHash);
    error StaleData(uint256 timestamp, uint256 maxAge);
    error ZeroAddress();
    error InvalidTimestamp(uint256 timestamp);

    // Using WeatherData struct from interface

    // State variables
    mapping(bytes32 => WeatherData) private weatherDataByLocation;
    mapping(bytes32 => uint256) private lastUpdateTime;
    mapping(address => bool) public authorizedOracles;

    // Constants
    uint256 public constant DATA_FRESHNESS_THRESHOLD = 24 hours; // 24 hours in seconds
    uint256 public constant MAX_RAINFALL_30D = 10000; // mm
    uint256 public constant MAX_RAINFALL_24H = 1000; // mm
    uint256 public constant MAX_TEMPERATURE = 10000; // 100°C * 100 (for decimals)
    uint256 public constant MIN_TEMPERATURE = 0; // -100°C * 100 (stored as 0, actual -100)

    // Events are defined in the interface

    /**
     * @dev Constructor initializes the contract with owner
     */
    constructor() Ownable(msg.sender) {
        // Owner is automatically authorized as oracle
        authorizedOracles[msg.sender] = true;
        emit OracleAuthorized(msg.sender);
    }

    /**
     * @dev Modifier to check if caller is authorized oracle
     */
    modifier onlyAuthorizedOracle() {
        if (!authorizedOracles[msg.sender]) {
            revert UnauthorizedOracle(msg.sender);
        }
        _;
    }

    /**
     * @dev Update weather data for specific GPS coordinates
     * @param latitude GPS latitude (scaled by 10000)
     * @param longitude GPS longitude (scaled by 10000)
     * @param data Weather data struct containing rainfall and temperature
     */
    function updateWeatherData(
        int256 latitude,
        int256 longitude,
        WeatherData memory data
    ) external override onlyAuthorizedOracle nonReentrant {
        // Validate GPS coordinates
        _validateCoordinates(latitude, longitude);

        // Validate weather data
        _validateWeatherData(data);

        // Generate location hash
        bytes32 locationHash = _getLocationHash(latitude, longitude);

        // Update timestamp to current block timestamp
        data.timestamp = block.timestamp;
        data.isValid = true;

        // Store weather data
        weatherDataByLocation[locationHash] = data;
        lastUpdateTime[locationHash] = block.timestamp;

        // Emit event
        emit WeatherDataUpdated(
            latitude,
            longitude,
            data.rainfall30d,
            data.rainfall24h,
            data.temperature,
            data.timestamp
        );
    }

    /**
     * @dev Get weather data for specific GPS coordinates
     * @param latitude GPS latitude (scaled by 10000)
     * @param longitude GPS longitude (scaled by 10000)
     * @return Weather data struct for the location
     */
    function getWeatherData(
        int256 latitude,
        int256 longitude
    ) external view override returns (WeatherData memory) {
        // Validate GPS coordinates
        _validateCoordinates(latitude, longitude);

        // Generate location hash
        bytes32 locationHash = _getLocationHash(latitude, longitude);

        // Check if data exists
        if (!weatherDataByLocation[locationHash].isValid) {
            revert DataNotFound(locationHash);
        }

        // Emit request event (view function, so this won't actually emit)
        // This is for interface compatibility - actual event emission would be in a separate function

        return weatherDataByLocation[locationHash];
    }

    /**
     * @dev Check if weather data is fresh (within freshness threshold)
     * @param latitude GPS latitude (scaled by 10000)
     * @param longitude GPS longitude (scaled by 10000)
     * @param maxAge Maximum age in seconds (0 uses default threshold)
     * @return True if data is fresh, false otherwise
     */
    function isDataFresh(
        int256 latitude,
        int256 longitude,
        uint256 maxAge
    ) external view override returns (bool) {
        // Validate GPS coordinates
        _validateCoordinates(latitude, longitude);

        // Use default threshold if maxAge is 0
        uint256 threshold = maxAge == 0 ? DATA_FRESHNESS_THRESHOLD : maxAge;

        // Generate location hash
        bytes32 locationHash = _getLocationHash(latitude, longitude);

        // Check if data exists
        if (!weatherDataByLocation[locationHash].isValid) {
            return false;
        }

        // Check if data is within freshness threshold
        uint256 dataAge = block.timestamp - weatherDataByLocation[locationHash].timestamp;
        return dataAge <= threshold;
    }

    /**
     * @dev Request weather data (emits event for oracle bot to pick up)
     * @param latitude GPS latitude (scaled by 10000)
     * @param longitude GPS longitude (scaled by 10000)
     */
    function requestWeatherData(int256 latitude, int256 longitude) external override {
        // Validate GPS coordinates
        _validateCoordinates(latitude, longitude);

        // Emit request event for oracle bot
        emit WeatherDataRequested(latitude, longitude, msg.sender);
    }

    /**
     * @dev Authorize an oracle address to update weather data
     * @param oracle Address to authorize as oracle
     */
    function authorizeOracle(address oracle) external override onlyOwner {
        if (oracle == address(0)) {
            revert ZeroAddress();
        }

        authorizedOracles[oracle] = true;
        emit OracleAuthorized(oracle);
    }

    /**
     * @dev Revoke oracle authorization
     * @param oracle Address to revoke oracle authorization from
     */
    function revokeOracle(address oracle) external override onlyOwner {
        if (oracle == address(0)) {
            revert ZeroAddress();
        }

        authorizedOracles[oracle] = false;
        emit OracleRevoked(oracle);
    }

    /**
     * @dev Check if an address is authorized as oracle
     * @param oracle Address to check
     * @return True if address is authorized oracle
     */
    function isAuthorizedOracle(address oracle) external view override returns (bool) {
        return authorizedOracles[oracle];
    }

    /**
     * @dev Get the last update time for a location
     * @param latitude GPS latitude (scaled by 10000)
     * @param longitude GPS longitude (scaled by 10000)
     * @return Last update timestamp
     */
    function getLastUpdateTime(
        int256 latitude,
        int256 longitude
    ) external view override returns (uint256) {
        // Validate GPS coordinates
        _validateCoordinates(latitude, longitude);

        // Generate location hash
        bytes32 locationHash = _getLocationHash(latitude, longitude);

        return lastUpdateTime[locationHash];
    }

    /**
     * @dev Internal function to validate GPS coordinates
     * @param latitude GPS latitude (scaled by 10000)
     * @param longitude GPS longitude (scaled by 10000)
     */
    function _validateCoordinates(int256 latitude, int256 longitude) internal pure {
        // Valid latitude range: -90 to 90 degrees (scaled by 10000: -900000 to 900000)
        // Valid longitude range: -180 to 180 degrees (scaled by 10000: -1800000 to 1800000)
        if (
            latitude < -900000 || latitude > 900000 || longitude < -1800000 || longitude > 1800000
        ) {
            revert InvalidCoordinates(latitude, longitude);
        }
    }

    /**
     * @dev Internal function to validate weather data
     * @param data Weather data to validate
     */
    function _validateWeatherData(WeatherData memory data) internal pure {
        // Validate rainfall ranges
        if (data.rainfall30d > MAX_RAINFALL_30D || data.rainfall24h > MAX_RAINFALL_24H) {
            revert InvalidWeatherData(data.rainfall30d, data.rainfall24h, data.temperature);
        }

        // Validate temperature range (0 to 10000 represents -100°C to 100°C)
        if (data.temperature > MAX_TEMPERATURE) {
            revert InvalidWeatherData(data.rainfall30d, data.rainfall24h, data.temperature);
        }

        // Validate logical consistency: 24h rainfall should not exceed 30d rainfall
        if (data.rainfall24h > data.rainfall30d) {
            revert InvalidWeatherData(data.rainfall30d, data.rainfall24h, data.temperature);
        }
    }

    /**
     * @dev Internal function to generate location hash from coordinates
     * @param latitude GPS latitude (scaled by 10000)
     * @param longitude GPS longitude (scaled by 10000)
     * @return Location hash for mapping key
     */
    function _getLocationHash(int256 latitude, int256 longitude) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked(latitude, longitude));
    }

    /**
     * @dev Get location hash for external use (for debugging/testing)
     * @param latitude GPS latitude (scaled by 10000)
     * @param longitude GPS longitude (scaled by 10000)
     * @return Location hash
     */
    function getLocationHash(
        int256 latitude,
        int256 longitude
    ) external pure override returns (bytes32) {
        return keccak256(abi.encodePacked(latitude, longitude));
    }

    /**
     * @dev Batch update weather data for multiple locations
     * @param latitudes Array of GPS latitudes (scaled by 10000)
     * @param longitudes Array of GPS longitudes (scaled by 10000)
     * @param weatherDataArray Array of weather data structs
     */
    function batchUpdateWeatherData(
        int256[] calldata latitudes,
        int256[] calldata longitudes,
        WeatherData[] calldata weatherDataArray
    ) external override onlyAuthorizedOracle nonReentrant {
        // Validate array lengths match
        require(
            latitudes.length == longitudes.length && longitudes.length == weatherDataArray.length,
            "Array length mismatch"
        );

        // Update each location
        for (uint256 i = 0; i < latitudes.length; i++) {
            // Validate coordinates and data
            _validateCoordinates(latitudes[i], longitudes[i]);

            WeatherData memory data = weatherDataArray[i];
            _validateWeatherData(data);

            // Generate location hash
            bytes32 locationHash = _getLocationHash(latitudes[i], longitudes[i]);

            // Update timestamp and validity
            data.timestamp = block.timestamp;
            data.isValid = true;

            // Store weather data
            weatherDataByLocation[locationHash] = data;
            lastUpdateTime[locationHash] = block.timestamp;

            // Emit event
            emit WeatherDataUpdated(
                latitudes[i],
                longitudes[i],
                data.rainfall30d,
                data.rainfall24h,
                data.temperature,
                data.timestamp
            );
        }
    }
}
