const axios = require("axios");

class OpenMeteoClient {
  constructor() {
    this.baseUrl = "https://archive-api.open-meteo.com/v1/archive";
  }

  /**
   * Fetch 30-day rainfall data from Open-Meteo Historical API
   * @param {number} lat - Latitude
   * @param {number} lon - Longitude
   * @returns {Object} Weather data with rainfall30d, rainfall24h, temperature
   */
  async getWeatherData(lat, lon) {
    try {
      // Calculate date range for last 30 days
      const endDate = new Date();
      const startDate = new Date(endDate);
      startDate.setDate(startDate.getDate() - 30);

      const startDateStr = startDate.toISOString().split("T")[0];
      const endDateStr = endDate.toISOString().split("T")[0];

      // Build API URL
      const url =
        `${this.baseUrl}?` +
        `latitude=${lat}&` +
        `longitude=${lon}&` +
        `start_date=${startDateStr}&` +
        `end_date=${endDateStr}&` +
        `daily=precipitation_sum,temperature_2m_max&` +
        `timezone=UTC`;

      console.log(`Fetching weather data from Open-Meteo: ${lat}, ${lon}`);

      const response = await axios.get(url, {
        timeout: 10000, // 10 second timeout
      });

      if (!response.data || !response.data.daily) {
        throw new Error("Invalid response from Open-Meteo API");
      }

      return this.processWeatherData(response.data);
    } catch (error) {
      console.error("Open-Meteo API Error:", error.message);
      throw new Error(`Open-Meteo API failed: ${error.message}`);
    }
  }

  /**
   * Process raw API response into required format
   * @param {Object} data - Raw API response
   * @returns {Object} Processed weather data
   */
  processWeatherData(data) {
    const { daily } = data;

    if (!daily.precipitation_sum || !daily.temperature_2m_max) {
      throw new Error("Missing precipitation or temperature data");
    }

    // Calculate 30-day rainfall total
    const rainfall30d = daily.precipitation_sum
      .filter((val) => val !== null)
      .reduce((sum, val) => sum + val, 0);

    // Calculate 24-hour rainfall (yesterday's data)
    const rainfall24h =
      daily.precipitation_sum[daily.precipitation_sum.length - 2] || 0;

    // Get latest temperature
    const temperature =
      daily.temperature_2m_max.filter((val) => val !== null).pop() || 0;

    const weatherData = {
      rainfall30d: Math.round(rainfall30d * 100) / 100, // Round to 2 decimals
      rainfall24h: Math.round(rainfall24h * 100) / 100,
      temperature: Math.round(temperature * 100) / 100,
      timestamp: Date.now(),
      source: "open-meteo",
    };

    console.log("Processed weather data:", weatherData);
    return weatherData;
  }

  /**
   * Test API connectivity
   * @returns {boolean} True if API is accessible
   */
  async testConnection() {
    try {
      // Test with London coordinates
      await this.getWeatherData(51.5074, -0.1278);
      return true;
    } catch (error) {
      console.error("Open-Meteo connection test failed:", error.message);
      return false;
    }
  }
}

module.exports = OpenMeteoClient;
