// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IWeatherOracle
 * @dev Interface for the WeatherOracle contract
 */
interface IWeatherOracle {
    struct WeatherData {
        uint256 rainfall30d; // Total rainfall in last 30 days (mm)
        uint256 rainfall24h; // Total rainfall in last 24 hours (mm)
        uint256 temperature; // Current temperature (Celsius * 1000 for decimals)
        uint256 timestamp; // Unix timestamp of data collection
        bool isValid; // Data validation flag
    }

    event WeatherDataUpdated(
        int256 indexed latitude,
        int256 indexed longitude,
        uint256 rainfall30d,
        uint256 rainfall24h,
        uint256 temperature,
        uint256 timestamp
    );

    event WeatherDataRequested(
        int256 indexed latitude,
        int256 indexed longitude,
        address indexed requester
    );

    event OracleAuthorized(address indexed oracle);
    event OracleRevoked(address indexed oracle);

    function updateWeatherData(int256 latitude, int256 longitude, WeatherData memory data) external;

    function getWeatherData(
        int256 latitude,
        int256 longitude
    ) external view returns (WeatherData memory);

    function isDataFresh(
        int256 latitude,
        int256 longitude,
        uint256 maxAge
    ) external view returns (bool);

    function requestWeatherData(int256 latitude, int256 longitude) external;

    function authorizeOracle(address oracle) external;

    function revokeOracle(address oracle) external;

    function isAuthorizedOracle(address oracle) external view returns (bool);

    function getLastUpdateTime(int256 latitude, int256 longitude) external view returns (uint256);

    function getLocationHash(int256 latitude, int256 longitude) external pure returns (bytes32);

    function batchUpdateWeatherData(
        int256[] calldata latitudes,
        int256[] calldata longitudes,
        WeatherData[] calldata weatherDataArray
    ) external;
}
