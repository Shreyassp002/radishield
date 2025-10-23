const { ethers } = require("ethers");
require("dotenv").config();

class Web3Client {
  constructor() {
    this.provider = null;
    this.wallet = null;
    this.weatherOracleContract = null;
    this.initialized = false;
  }

  /**
   * Initialize Web3 connection and contract instances
   */
  async initialize() {
    try {
      // Validate required environment variables
      const requiredEnvVars = [
        "RPC_URL",
        "PRIVATE_KEY",
        "WEATHER_ORACLE_ADDRESS",
      ];

      for (const envVar of requiredEnvVars) {
        if (!process.env[envVar]) {
          throw new Error(`Missing required environment variable: ${envVar}`);
        }
      }

      // Initialize provider
      this.provider = new ethers.JsonRpcProvider(process.env.RPC_URL);

      // Test provider connection
      const network = await this.provider.getNetwork();
      console.log(
        `✅ Connected to network: ${network.name} (Chain ID: ${network.chainId})`
      );

      // Initialize wallet
      this.wallet = new ethers.Wallet(process.env.PRIVATE_KEY, this.provider);
      console.log(`✅ Wallet initialized: ${this.wallet.address}`);

      // Check wallet balance
      const balance = await this.provider.getBalance(this.wallet.address);
      const balanceEth = ethers.formatEther(balance);

      // Determine native token name based on chain ID
      let tokenName = "ETH";
      if (network.chainId === 114n) {
        tokenName = "C2FLR"; // Flare Testnet (Coston2)
      } else if (network.chainId === 14n) {
        tokenName = "FLR"; // Flare Mainnet
      } else if (network.chainId === 80002n) {
        tokenName = "POL"; // Polygon Amoy
      }

      console.log(`💰 Wallet balance: ${balanceEth} ${tokenName}`);

      if (parseFloat(balanceEth) < 0.001) {
        console.warn(
          `⚠️  Low wallet balance. May not be sufficient for transactions. Need more ${tokenName}.`
        );
      }

      // Initialize Weather Oracle contract
      const weatherOracleABI = [
        "function updateWeatherData(int256 latitude, int256 longitude, tuple(uint256 rainfall30d, uint256 rainfall24h, uint256 temperature, uint256 timestamp, bool isValid) data) external",
        "function getWeatherData(int256 latitude, int256 longitude) external view returns (tuple(uint256 rainfall30d, uint256 rainfall24h, uint256 temperature, uint256 timestamp, bool isValid))",
        "function isDataFresh(int256 latitude, int256 longitude, uint256 maxAge) external view returns (bool)",
        "function isAuthorizedOracle(address oracle) external view returns (bool)",
        "event WeatherDataUpdated(int256 indexed latitude, int256 indexed longitude, uint256 rainfall30d, uint256 rainfall24h, uint256 temperature, uint256 timestamp)",
      ];

      this.weatherOracleContract = new ethers.Contract(
        process.env.WEATHER_ORACLE_ADDRESS,
        weatherOracleABI,
        this.wallet
      );

      // Verify oracle authorization
      const isAuthorized = await this.weatherOracleContract.isAuthorizedOracle(
        this.wallet.address
      );
      if (!isAuthorized) {
        throw new Error(
          `Wallet ${this.wallet.address} is not authorized as an oracle. Please authorize this address in the WeatherOracle contract.`
        );
      }

      console.log(
        `✅ Oracle authorization verified for: ${this.wallet.address}`
      );

      this.initialized = true;
      console.log("🚀 Web3Client initialized successfully");
    } catch (error) {
      console.error("❌ Failed to initialize Web3Client:", error.message);
      throw error;
    }
  }

  /**
   * Update weather data on the blockchain
   * @param {number} latitude - GPS latitude
   * @param {number} longitude - GPS longitude
   * @param {Object} weatherData - Weather data object
   * @returns {Object} Transaction result
   */
  async updateWeatherData(latitude, longitude, weatherData) {
    if (!this.initialized) {
      throw new Error("Web3Client not initialized. Call initialize() first.");
    }

    try {
      // Scale coordinates by 10000 for Solidity compatibility
      const scaledLat = Math.round(latitude * 10000);
      const scaledLon = Math.round(longitude * 10000);

      // Scale temperature by 100 for decimal precision in Solidity
      const scaledTemp = Math.round(weatherData.temperature * 100);

      // Prepare weather data struct for contract
      const contractWeatherData = {
        rainfall30d: Math.round(weatherData.rainfall30d),
        rainfall24h: Math.round(weatherData.rainfall24h),
        temperature: scaledTemp,
        timestamp: Math.floor(Date.now() / 1000), // Current timestamp
        isValid: true,
      };

      console.log(`📡 Updating weather data on blockchain...`);
      console.log(
        `   Coordinates: ${latitude}, ${longitude} (scaled: ${scaledLat}, ${scaledLon})`
      );
      console.log(`   Data: ${JSON.stringify(contractWeatherData)}`);

      // Estimate gas for the transaction
      const gasEstimate =
        await this.weatherOracleContract.updateWeatherData.estimateGas(
          scaledLat,
          scaledLon,
          contractWeatherData
        );

      console.log(`⛽ Estimated gas: ${gasEstimate.toString()}`);

      // Send transaction with gas limit buffer
      const tx = await this.weatherOracleContract.updateWeatherData(
        scaledLat,
        scaledLon,
        contractWeatherData,
        {
          gasLimit: (gasEstimate * 120n) / 100n, // 20% buffer
        }
      );

      console.log(`📤 Transaction sent: ${tx.hash}`);
      console.log("⏳ Waiting for confirmation...");

      // Wait for transaction confirmation
      const receipt = await tx.wait();

      console.log(`✅ Transaction confirmed in block: ${receipt.blockNumber}`);
      console.log(`💰 Gas used: ${receipt.gasUsed.toString()}`);

      return {
        success: true,
        txHash: tx.hash,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed.toString(),
        coordinates: { latitude, longitude },
        weatherData: contractWeatherData,
      };
    } catch (error) {
      console.error(
        "❌ Failed to update weather data on blockchain:",
        error.message
      );

      // Parse common error types
      if (error.message.includes("insufficient funds")) {
        throw new Error(
          "Insufficient funds for transaction. Please add more native tokens (C2FLR/FLR/POL) to the wallet."
        );
      } else if (error.message.includes("UnauthorizedOracle")) {
        throw new Error(
          "Oracle not authorized. Please authorize this address in the WeatherOracle contract."
        );
      } else if (error.message.includes("InvalidCoordinates")) {
        throw new Error("Invalid GPS coordinates provided.");
      } else if (error.message.includes("InvalidWeatherData")) {
        throw new Error("Invalid weather data values provided.");
      }

      throw error;
    }
  }

  /**
   * Check if weather data is fresh for given coordinates
   * @param {number} latitude - GPS latitude
   * @param {number} longitude - GPS longitude
   * @param {number} maxAge - Maximum age in seconds (default: 24 hours)
   * @returns {boolean} True if data is fresh
   */
  async isDataFresh(latitude, longitude, maxAge = 86400) {
    if (!this.initialized) {
      throw new Error("Web3Client not initialized. Call initialize() first.");
    }

    try {
      const scaledLat = Math.round(latitude * 10000);
      const scaledLon = Math.round(longitude * 10000);

      const isFresh = await this.weatherOracleContract.isDataFresh(
        scaledLat,
        scaledLon,
        maxAge
      );

      return isFresh;
    } catch (error) {
      console.error("❌ Failed to check data freshness:", error.message);
      return false;
    }
  }

  /**
   * Get existing weather data from blockchain
   * @param {number} latitude - GPS latitude
   * @param {number} longitude - GPS longitude
   * @returns {Object} Weather data from blockchain
   */
  async getWeatherData(latitude, longitude) {
    if (!this.initialized) {
      throw new Error("Web3Client not initialized. Call initialize() first.");
    }

    try {
      const scaledLat = Math.round(latitude * 10000);
      const scaledLon = Math.round(longitude * 10000);

      const data = await this.weatherOracleContract.getWeatherData(
        scaledLat,
        scaledLon
      );

      return {
        rainfall30d: Number(data.rainfall30d),
        rainfall24h: Number(data.rainfall24h),
        temperature: Number(data.temperature) / 100, // Unscale temperature
        timestamp: Number(data.timestamp),
        isValid: data.isValid,
      };
    } catch (error) {
      console.error(
        "❌ Failed to get weather data from blockchain:",
        error.message
      );
      throw error;
    }
  }

  /**
   * Get wallet address
   * @returns {string} Wallet address
   */
  getWalletAddress() {
    return this.wallet ? this.wallet.address : null;
  }

  /**
   * Get current network information
   * @returns {Object} Network info
   */
  async getNetworkInfo() {
    if (!this.provider) {
      throw new Error("Provider not initialized");
    }

    const network = await this.provider.getNetwork();
    return {
      name: network.name,
      chainId: Number(network.chainId),
    };
  }

  /**
   * Test blockchain connection
   * @returns {boolean} True if connection is working
   */
  async testConnection() {
    try {
      if (!this.initialized) {
        await this.initialize();
      }

      // Test by getting latest block number
      const blockNumber = await this.provider.getBlockNumber();
      console.log(`🔗 Connected to blockchain. Latest block: ${blockNumber}`);

      return true;
    } catch (error) {
      console.error("❌ Blockchain connection test failed:", error.message);
      return false;
    }
  }
}

module.exports = Web3Client;
