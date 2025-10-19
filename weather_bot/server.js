require("dotenv").config();
const express = require("express");
const WeatherOracleBot = require("./index");

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize the weather oracle bot
const bot = new WeatherOracleBot();
let botStatus = {
  initialized: false,
  lastUpdate: null,
  error: null,
};

// Initialize bot on startup
async function initializeBot() {
  try {
    console.log("🤖 Initializing Weather Oracle Bot...");

    // Test blockchain connection
    const blockchainConnected = await bot.web3Client.testConnection();
    if (!blockchainConnected) {
      throw new Error("Blockchain connection failed");
    }

    // Test at least one weather API
    const openMeteoConnected = await bot.openMeteoClient.testConnection();
    const weatherApiConnected = await bot.weatherApiClient.testConnection();

    if (!openMeteoConnected && !weatherApiConnected) {
      throw new Error("No weather APIs available");
    }

    botStatus.initialized = true;
    botStatus.lastUpdate = new Date().toISOString();
    botStatus.error = null;

    console.log("✅ Weather Oracle Bot initialized successfully");
  } catch (error) {
    console.error("❌ Bot initialization failed:", error.message);
    botStatus.initialized = false;
    botStatus.error = error.message;
  }
}

// Health check endpoint for Railway
app.get("/health", (req, res) => {
  const health = {
    status: botStatus.initialized ? "healthy" : "unhealthy",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    initialized: botStatus.initialized,
    lastUpdate: botStatus.lastUpdate,
    error: botStatus.error,
  };

  const statusCode = botStatus.initialized ? 200 : 503;
  res.status(statusCode).json(health);
});

// Status endpoint
app.get("/status", (req, res) => {
  res.json({
    service: "Weather Oracle Bot",
    version: "1.0.0",
    status: botStatus.initialized ? "running" : "error",
    initialized: botStatus.initialized,
    lastUpdate: botStatus.lastUpdate,
    error: botStatus.error,
    uptime: process.uptime(),
  });
});

// Weather data endpoint (for testing)
app.get("/weather/:lat/:lon", async (req, res) => {
  try {
    const { lat, lon } = req.params;
    const latitude = parseFloat(lat);
    const longitude = parseFloat(lon);

    if (isNaN(latitude) || isNaN(longitude)) {
      return res.status(400).json({ error: "Invalid coordinates" });
    }

    if (!botStatus.initialized) {
      return res.status(503).json({ error: "Bot not initialized" });
    }

    const result = await bot.updateWeatherOnChain(latitude, longitude);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Root endpoint
app.get("/", (req, res) => {
  res.json({
    service: "Weather Oracle Bot",
    version: "1.0.0",
    endpoints: {
      health: "/health",
      status: "/status",
      weather: "/weather/:lat/:lon",
    },
  });
});

// Start server
app.listen(PORT, async () => {
  console.log(`🚀 Weather Oracle Bot server running on port ${PORT}`);

  // Initialize bot after server starts
  await initializeBot();

  // Set up periodic health checks (every 5 minutes)
  setInterval(async () => {
    try {
      if (botStatus.initialized) {
        // Test blockchain connection periodically
        const connected = await bot.web3Client.testConnection();
        if (!connected) {
          botStatus.initialized = false;
          botStatus.error = "Blockchain connection lost";
          console.error("❌ Blockchain connection lost");
        } else {
          botStatus.lastUpdate = new Date().toISOString();
        }
      }
    } catch (error) {
      console.error("❌ Health check failed:", error.message);
      botStatus.initialized = false;
      botStatus.error = error.message;
    }
  }, 5 * 60 * 1000); // 5 minutes
});

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("🛑 SIGTERM received, shutting down gracefully");
  process.exit(0);
});

process.on("SIGINT", () => {
  console.log("🛑 SIGINT received, shutting down gracefully");
  process.exit(0);
});
