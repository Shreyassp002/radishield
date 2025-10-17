// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IRadiShield
 * @dev Interface for the RadiShield parametric crop insurance contract
 */
interface IRadiShield {
    struct Policy {
        uint256 id;
        address farmer;
        string cropType;
        uint256 coverage;
        uint256 premium;
        int256 latitude;
        int256 longitude;
        uint256 startDate;
        uint256 endDate;
        bool isActive;
        bool claimed;
    }

    struct WeatherData {
        uint256 rainfall30d;
        uint256 rainfall24h;
        uint256 temperature;
        uint256 timestamp;
        bool isValid;
    }

    event PolicyCreated(
        uint256 indexed policyId,
        address indexed farmer,
        uint256 coverage,
        string cropType
    );
    event WeatherDataRequested(uint256 indexed policyId, bytes32 indexed requestId);
    event ClaimPaid(
        uint256 indexed policyId,
        address indexed farmer,
        uint256 amount,
        string reason
    );

    function createPolicy(
        string memory cropType,
        uint256 coverage,
        uint256 duration,
        int256 latitude,
        int256 longitude
    ) external returns (uint256);

    function calculatePremium(
        uint256 coverage,
        int256 latitude,
        int256 longitude
    ) external view returns (uint256);

    function getPolicy(uint256 policyId) external view returns (Policy memory);

    function getPoliciesByFarmer(address farmer) external view returns (uint256[] memory);
}
