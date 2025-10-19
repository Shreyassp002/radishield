require("dotenv").config();
const OpenMeteoClient = require("./openMeteoClient");
const WeatherApiClient = require("./weatherApiClient");
const WeatherValidator = require("./weatherValidator");
const Web3Client = require("./web3Client");

class WeatherOracleBot {
  constructor() {
    this.openMeteoClient = new OpenMeteoClient();
    this.weatherApiClient = new WeatherApiClient();
    this.validator = new WeatherValidator();
    this.web3Client = new Web3Client();
  }

  /**
   * Fetch weather data for given coordinates with fallback and validation
   * @param {number} lat - Latitude
   * @param {number} lon - Longitude
   * @returns {Object} Validated weather data
   */
  async fetchWeatherData(lat, lon) {
    // Validate coordinates first
    const coordValidation = this.validator.validateCoordinates(lat, lon);
    if (!coordValidation.isValid) {
      throw new Error(
        `Invalid coordinates: ${coordValidation.errors.join(", ")}`
      );
    }

    console.log(`\n=== Fetching Weather Data ===`);
    console.log(`Coordinates: ${lat}, ${lon}`);

    let weatherData = null;
    let dataSource = null;

    try {
      // Try Open-Meteo first (primary source)
      console.log("📡 Trying Open-Meteo API (primary)...");
      weatherData = await this.openMeteoClient.getWeatherData(lat, lon);
      dataSource = "open-meteo";
      console.log("✅ Open-Meteo data fetched successfully");
    } catch (openMeteoError) {
      console.log("⚠️  Open-Meteo failed, trying WeatherAPI fallback...");
      console.log(`Open-Meteo error: ${openMeteoError.message}`);

      try {
        // Fallback to WeatherAPI
        weatherData = await this.weatherApiClient.getWeatherData(lat, lon);
        dataSource = "weatherapi";
        console.log("✅ WeatherAPI fallback data fetched successfully");
      } catch (weatherApiError) {
        console.error("❌ Both APIs failed");
        console.error(`WeatherAPI error: ${weatherApiError.message}`);
        throw new Error(
          `All weather APIs failed. Open-Meteo: ${openMeteoError.message}, WeatherAPI: ${weatherApiError.message}`
        );
      }
    }

    // Validate the fetched weather data
    const validation = this.validator.validateWeatherData(weatherData);

    if (!validation.isValid) {
      console.error("❌ Weather data validation failed:");
      validation.errors.forEach((error) => console.error(`  - ${error}`));
      throw new Error(
        `Weather data validation failed: ${validation.errors.join(", ")}`
      );
    }

    if (validation.warnings.length > 0) {
      console.warn("⚠️  Weather data warnings:");
      validation.warnings.forEach((warning) => console.warn(`  - ${warning}`));
    }

    console.log(
      `✅ Weather data validated successfully (source: ${dataSource})`
    );
    return validation.weatherData;
  }

  /**
   * Update weather data on blockchain for given coordinates
   * @param {number} lat - Latitude
   * @param {number} lon - Longitude
   * @returns {Object} Update result
   */
  async updateWeatherOnChain(lat, lon) {
    try {
      console.log(`\n=== Updating Weather Data on Blockchain ===`);
      console.log(`Coordinates: ${lat}, ${lon}`);

      // Initialize Web3 client if not already done
      if (!this.web3Client.initialized) {
        await this.web3Client.initialize();
      }

      // Check if data is already fresh on blockchain
      const isFresh = await this.web3Client.isDataFresh(lat, lon, 3600); // 1 hour freshness
      if (isFresh) {
        console.log("✅ Weather data is already fresh on blockchain");
        const existingData = await this.web3Client.getWeatherData(lat, lon);
        return {
          success: true,
          updated: false,
          reason: "Data already fresh",
          data: existingData,
        };
      }

      // Fetch fresh weather data from APIs
      const weatherData = await this.fetchWeatherData(lat, lon);

      // Update blockchain with fresh data
      const updateResult = await this.web3Client.updateWeatherData(
        lat,
        lon,
        weatherData
      );

      console.log("✅ Weather data successfully updated on blockchain");
      return {
        success: true,
        updated: true,
        blockchain: updateResult,
        weatherData: weatherData,
      };
    } catch (error) {
      console.error(
        "❌ Failed to update weather data on blockchain:",
        error.message
      );
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Test the bot functionality with APIs, validation, and blockchain integration
   */
  async test() {
    try {
      console.log("🤖 Weather Oracle Bot - Full Integration Testing");

      // Test coordinate validation
      console.log("\n🧪 Testing coordinate validation...");
      const invalidCoords = this.validator.validateCoordinates(91, 181);
      if (!invalidCoords.isValid) {
        console.log("✅ Coordinate validation working correctly");
      }

      // Test blockchain connection
      console.log("\n🔗 Testing blockchain connection...");
      const blockchainConnected = await this.web3Client.testConnection();
      console.log(
        blockchainConnected
          ? "✅ Blockchain connected"
          : "❌ Blockchain connection failed"
      );

      if (!blockchainConnected) {
        console.log("❌ Cannot proceed without blockchain connection");
        return;
      }

      // Test Open-Meteo connection
      console.log("\n📡 Testing Open-Meteo API...");
      const openMeteoConnected = await this.openMeteoClient.testConnection();
      console.log(
        openMeteoConnected
          ? "✅ Open-Meteo API connected"
          : "❌ Open-Meteo API failed"
      );

      // Test WeatherAPI connection
      console.log("\n📡 Testing WeatherAPI fallback...");
      const weatherApiConnected = await this.weatherApiClient.testConnection();
      console.log(
        weatherApiConnected
          ? "✅ WeatherAPI connected"
          : "⚠️  WeatherAPI not configured or failed"
      );

      if (!openMeteoConnected && !weatherApiConnected) {
        console.log("❌ No weather APIs available");
        return;
      }

      // Test with sample coordinates (New York)
      console.log(
        "\n🌍 Testing full workflow with sample coordinates (New York)..."
      );
      const updateResult = await this.updateWeatherOnChain(40.7128, -74.006);

      if (updateResult.success) {
        console.log("\n📊 Update Results:");
        console.log(`Updated: ${updateResult.updated}`);
        if (updateResult.updated) {
          console.log(`Transaction Hash: ${updateResult.blockchain.txHash}`);
          console.log(`Block Number: ${updateResult.blockchain.blockNumber}`);
          console.log(`Gas Used: ${updateResult.blockchain.gasUsed}`);
        }
        if (updateResult.weatherData) {
          console.log(
            `30-day rainfall: ${updateResult.weatherData.rainfall30d}mm`
          );
          console.log(
            `24-hour rainfall: ${updateResult.weatherData.rainfall24h}mm`
          );
          console.log(`Temperature: ${updateResult.weatherData.temperature}°C`);
          console.log(`Source: ${updateResult.weatherData.source}`);
        }
      } else {
        console.log(`❌ Update failed: ${updateResult.error}`);
      }

      // Test with invalid coordinates
      console.log("\n🧪 Testing error handling with invalid coordinates...");
      try {
        await this.fetchWeatherData(91, 181);
        console.log("❌ Should have failed with invalid coordinates");
      } catch (error) {
        console.log("✅ Invalid coordinates properly rejected");
      }

      console.log("\n✅ Full integration test completed!");
    } catch (error) {
      console.error("\n❌ Integration test failed:", error.message);
    }
  }
}

// Run bot in test mode if called directly
if (require.main === module) {
  const bot = new WeatherOracleBot();
  bot.test();
}

module.exports = WeatherOracleBot;
