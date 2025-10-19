const axios = require("axios");

class WeatherApiClient {
  constructor() {
    this.baseUrl = "http://api.weatherapi.com/v1";
    this.apiKey = process.env.WEATHER_API_KEY;

    if (!this.apiKey) {
      console.warn("⚠️  WEATHER_API_KEY not found in environment variables");
    }
  }

  /**
   * Fetch current weather data with API key
   * @param {number} lat - Latitude
   * @param {number} lon - Longitude
   * @returns {Object} Weather data with rainfall30d, rainfall24h, temperature
   */
  async getWeatherData(lat, lon) {
    if (!this.apiKey) {
      throw new Error("WeatherAPI key not configured");
    }

    try {
      console.log(`Fetching weather data from WeatherAPI: ${lat}, ${lon}`);

      // Get current weather and 7-day history (free tier limitation)
      const [currentData, historyData] = await Promise.all([
        this.getCurrentWeather(lat, lon),
        this.getHistoricalData(lat, lon, 7), // Limited to 7 days on free tier
      ]);

      return this.processWeatherData(currentData, historyData);
    } catch (error) {
      console.error("WeatherAPI Error:", error.message);
      throw new Error(`WeatherAPI failed: ${error.message}`);
    }
  }

  /**
   * Get current weather conditions
   * @param {number} lat - Latitude
   * @param {number} lon - Longitude
   * @returns {Object} Current weather data
   */
  async getCurrentWeather(lat, lon) {
    const url = `${this.baseUrl}/current.json?key=${this.apiKey}&q=${lat},${lon}&aqi=no`;

    const response = await axios.get(url, {
      timeout: 10000,
    });

    if (!response.data || !response.data.current) {
      throw new Error("Invalid current weather response from WeatherAPI");
    }

    return response.data;
  }

  /**
   * Get historical weather data for the last N days
   * @param {number} lat - Latitude
   * @param {number} lon - Longitude
   * @param {number} days - Number of days to fetch (max 7 on free tier)
   * @returns {Array} Historical weather data
   */
  async getHistoricalData(lat, lon, days = 7) {
    const historyPromises = [];

    for (let i = 1; i <= days; i++) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split("T")[0];

      const url = `${this.baseUrl}/history.json?key=${this.apiKey}&q=${lat},${lon}&dt=${dateStr}`;
      historyPromises.push(axios.get(url, { timeout: 10000 }));
    }

    const responses = await Promise.all(historyPromises);
    return responses.map((response) => {
      if (!response.data || !response.data.forecast) {
        throw new Error("Invalid historical weather response from WeatherAPI");
      }
      return response.data;
    });
  }

  /**
   * Process raw API responses into required format
   * @param {Object} currentData - Current weather response
   * @param {Array} historyData - Historical weather responses
   * @returns {Object} Processed weather data
   */
  processWeatherData(currentData, historyData) {
    // Get current temperature
    const temperature = currentData.current.temp_c;

    // Calculate 24-hour rainfall (yesterday's data)
    let rainfall24h = 0;
    if (historyData.length > 0 && historyData[0].forecast.forecastday[0]) {
      rainfall24h =
        historyData[0].forecast.forecastday[0].day.totalprecip_mm || 0;
    }

    // Calculate rainfall from available history (limited to 7 days on free tier)
    let rainfall30d = rainfall24h; // Start with 24h data

    historyData.forEach((dayData) => {
      if (dayData.forecast.forecastday[0]) {
        const dayRainfall =
          dayData.forecast.forecastday[0].day.totalprecip_mm || 0;
        rainfall30d += dayRainfall;
      }
    });

    // Note: WeatherAPI free tier only provides 7 days of history
    // For 30-day data, we'd need a paid plan or use Open-Meteo as primary

    const weatherData = {
      rainfall30d: Math.round(rainfall30d * 100) / 100, // Limited to ~7 days
      rainfall24h: Math.round(rainfall24h * 100) / 100,
      temperature: Math.round(temperature * 100) / 100,
      timestamp: Date.now(),
      source: "weatherapi",
      note: "30-day rainfall limited to 7 days on free tier",
    };

    console.log("Processed WeatherAPI data:", weatherData);
    return weatherData;
  }

  /**
   * Test API connectivity and key validity
   * @returns {boolean} True if API is accessible and key is valid
   */
  async testConnection() {
    if (!this.apiKey) {
      console.error("WeatherAPI key not configured");
      return false;
    }

    try {
      // Test with London coordinates
      await this.getCurrentWeather(51.5074, -0.1278);
      console.log("✅ WeatherAPI connection and key validation successful");
      return true;
    } catch (error) {
      console.error("WeatherAPI connection test failed:", error.message);

      if (error.response && error.response.status === 401) {
        console.error("❌ Invalid WeatherAPI key");
      } else if (error.response && error.response.status === 403) {
        console.error("❌ WeatherAPI key quota exceeded");
      }

      return false;
    }
  }

  /**
   * Check API key status and quota
   * @returns {Object} API status information
   */
  async getApiStatus() {
    if (!this.apiKey) {
      return { valid: false, error: "No API key configured" };
    }

    try {
      const response = await this.getCurrentWeather(51.5074, -0.1278);
      return {
        valid: true,
        quota: "Available", // WeatherAPI doesn't provide quota info in free tier
        message: "API key is working",
      };
    } catch (error) {
      return {
        valid: false,
        error: error.message,
        status: error.response ? error.response.status : "Network Error",
      };
    }
  }
}

module.exports = WeatherApiClient;
