require("dotenv").config();
const OpenMeteoClient = require("./openMeteoClient");
const WeatherApiClient = require("./weatherApiClient");
const WeatherValidator = require("./weatherValidator");

class WeatherOracleBot {
  constructor() {
    this.openMeteoClient = new OpenMeteoClient();
    this.weatherApiClient = new WeatherApiClient();
    this.validator = new WeatherValidator();
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
   * Test the bot functionality with both APIs and validation
   */
  async test() {
    try {
      console.log("🤖 Weather Oracle Bot - Testing Mode");

      // Test coordinate validation
      console.log("\n🧪 Testing coordinate validation...");
      const invalidCoords = this.validator.validateCoordinates(91, 181);
      if (!invalidCoords.isValid) {
        console.log("✅ Coordinate validation working correctly");
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
      console.log("\n🌍 Testing with sample coordinates (New York)...");
      const weatherData = await this.fetchWeatherData(40.7128, -74.006);

      console.log("\n📊 Weather Data Results:");
      console.log(`30-day rainfall: ${weatherData.rainfall30d}mm`);
      console.log(`24-hour rainfall: ${weatherData.rainfall24h}mm`);
      console.log(`Temperature: ${weatherData.temperature}°C`);
      console.log(
        `Timestamp: ${new Date(weatherData.timestamp).toISOString()}`
      );
      console.log(`Source: ${weatherData.source}`);
      console.log(`Validated: ${weatherData.isValid}`);

      // Test with invalid coordinates
      console.log("\n🧪 Testing error handling with invalid coordinates...");
      try {
        await this.fetchWeatherData(91, 181);
        console.log("❌ Should have failed with invalid coordinates");
      } catch (error) {
        console.log("✅ Invalid coordinates properly rejected");
      }

      console.log("\n✅ Bot test completed successfully!");
    } catch (error) {
      console.error("\n❌ Bot test failed:", error.message);
    }
  }
}

// Run bot in test mode if called directly
if (require.main === module) {
  const bot = new WeatherOracleBot();
  bot.test();
}

module.exports = WeatherOracleBot;
