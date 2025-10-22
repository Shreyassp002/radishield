import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

/**
 * This deployment script configures external contracts that are already deployed
 * Instead of deploying new contracts, we reference existing ones on Polygon Amoy
 */
const deployExternalContracts: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, network } = hre;
  const { save } = deployments;

  // Only configure external contracts on Polygon Amoy
  if (network.name === "polygonAmoy") {
    console.log("🔧 Configuring external contracts on Polygon Amoy...");

    // RadiShield Contract - Already deployed
    await save("RadiShield", {
      address: "0xD0A36216e870FA0c91B4Db5CAD04b85ee684dc9d",
      abi: [
        // Minimal ABI with key functions
        {
          inputs: [
            { internalType: "string", name: "cropType", type: "string" },
            { internalType: "uint256", name: "coverage", type: "uint256" },
            { internalType: "uint256", name: "duration", type: "uint256" },
            { internalType: "int256", name: "latitude", type: "int256" },
            { internalType: "int256", name: "longitude", type: "int256" },
          ],
          name: "createPolicy",
          outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
          stateMutability: "payable",
          type: "function",
        },
        {
          inputs: [
            { internalType: "uint256", name: "coverage", type: "uint256" },
            { internalType: "int256", name: "latitude", type: "int256" },
            { internalType: "int256", name: "longitude", type: "int256" },
          ],
          name: "calculatePremium",
          outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
          stateMutability: "nonpayable",
          type: "function",
        },
        {
          inputs: [],
          name: "getContractStats",
          outputs: [
            { internalType: "uint256", name: "totalPolicies", type: "uint256" },
            { internalType: "uint256", name: "activePolicies", type: "uint256" },
            { internalType: "uint256", name: "claimedPolicies", type: "uint256" },
            { internalType: "uint256", name: "totalCoverage", type: "uint256" },
            { internalType: "uint256", name: "totalPremiums", type: "uint256" },
            { internalType: "uint256", name: "contractBalance", type: "uint256" },
          ],
          stateMutability: "view",
          type: "function",
        },
        {
          inputs: [{ internalType: "uint256", name: "policyId", type: "uint256" }],
          name: "getPolicy",
          outputs: [
            {
              components: [
                { internalType: "uint256", name: "id", type: "uint256" },
                { internalType: "address", name: "farmer", type: "address" },
                { internalType: "string", name: "cropType", type: "string" },
                { internalType: "uint256", name: "coverage", type: "uint256" },
                { internalType: "uint256", name: "premium", type: "uint256" },
                { internalType: "int256", name: "latitude", type: "int256" },
                { internalType: "int256", name: "longitude", type: "int256" },
                { internalType: "uint256", name: "startDate", type: "uint256" },
                { internalType: "uint256", name: "endDate", type: "uint256" },
                { internalType: "bool", name: "isActive", type: "bool" },
                { internalType: "bool", name: "claimed", type: "bool" },
              ],
              internalType: "struct IRadiShield.Policy",
              name: "",
              type: "tuple",
            },
          ],
          stateMutability: "view",
          type: "function",
        },
        {
          inputs: [{ internalType: "address", name: "farmer", type: "address" }],
          name: "getPoliciesByFarmer",
          outputs: [{ internalType: "uint256[]", name: "", type: "uint256[]" }],
          stateMutability: "view",
          type: "function",
        },
        {
          inputs: [{ internalType: "uint256", name: "policyId", type: "uint256" }],
          name: "requestWeatherData",
          outputs: [{ internalType: "bool", name: "", type: "bool" }],
          stateMutability: "nonpayable",
          type: "function",
        },
        {
          inputs: [{ internalType: "uint256", name: "policyId", type: "uint256" }],
          name: "processWeatherData",
          outputs: [],
          stateMutability: "nonpayable",
          type: "function",
        },
      ],
    });

    // WeatherOracle Contract - Already deployed
    await save("WeatherOracle", {
      address: "0xFB45AD2145e5fC19EFF37C04B120b1fc491eF66e",
      abi: [
        {
          inputs: [
            { internalType: "int256", name: "latitude", type: "int256" },
            { internalType: "int256", name: "longitude", type: "int256" },
          ],
          name: "getWeatherData",
          outputs: [
            {
              components: [
                { internalType: "uint256", name: "rainfall30d", type: "uint256" },
                { internalType: "uint256", name: "rainfall24h", type: "uint256" },
                { internalType: "uint256", name: "temperature", type: "uint256" },
                { internalType: "uint256", name: "timestamp", type: "uint256" },
                { internalType: "bool", name: "isValid", type: "bool" },
              ],
              internalType: "struct IWeatherOracle.WeatherData",
              name: "",
              type: "tuple",
            },
          ],
          stateMutability: "view",
          type: "function",
        },
        {
          inputs: [
            { internalType: "int256", name: "latitude", type: "int256" },
            { internalType: "int256", name: "longitude", type: "int256" },
            { internalType: "uint256", name: "maxAge", type: "uint256" },
          ],
          name: "isDataFresh",
          outputs: [{ internalType: "bool", name: "", type: "bool" }],
          stateMutability: "view",
          type: "function",
        },
      ],
    });

    console.log("✅ External contracts configured successfully!");
    console.log("📍 RadiShield:", "0xD0A36216e870FA0c91B4Db5CAD04b85ee684dc9d");
    console.log("🌤️  WeatherOracle:", "0xFB45AD2145e5fC19EFF37C04B120b1fc491eF66e");
  } else {
    console.log(`⏭️  Skipping external contracts on ${network.name}`);
  }
};

export default deployExternalContracts;
deployExternalContracts.tags = ["ExternalContracts"];
