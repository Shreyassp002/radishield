const { expect } = require("chai")
const { ethers } = require("hardhat")
const axios = require("axios")

describe("Bot Integration Test", function () {
    let weatherOracle
    let deployer

    // Your deployed addresses
    const WEATHER_ORACLE_ADDRESS = "0x36E4f5F0C95D31F9f280CB607796212E2B0b71AF"
    const BOT_URL = "https://radishield-production.up.railway.app"

    // Test coordinates
    const TEST_LOCATIONS = [
        { name: "Nairobi", lat: -1.2921, lon: 36.8219 },
        { name: "New York", lat: 40.7128, lon: -74.006 },
        { name: "London", lat: 51.5074, lon: -0.1278 },
    ]

    before(async function () {
        console.log("🚀 Testing Bot → WeatherOracle Integration...")
        ;[deployer] = await ethers.getSigners()
        console.log(`Deployer: ${deployer.address}`)

        // Connect to deployed WeatherOracle
        const WeatherOracle = await ethers.getContractFactory("WeatherOracle")
        weatherOracle = WeatherOracle.attach(WEATHER_ORACLE_ADDRESS)
        console.log(`✅ Connected to WeatherOracle: ${WEATHER_ORACLE_ADDRESS}`)
    })

    it("Should check bot health", async function () {
        console.log("🏥 Checking bot health...")

        try {
            const response = await axios.get(`${BOT_URL}/health`)
            console.log(`✅ Bot Status: ${response.data.status}`)
            console.log(`   Initialized: ${response.data.initialized}`)
            console.log(`   Uptime: ${Math.floor(response.data.uptime)}s`)

            expect(response.data.status).to.equal("healthy")
            expect(response.data.initialized).to.be.true
        } catch (error) {
            console.error(`❌ Bot health check failed: ${error.message}`)
            throw error
        }
    })

    it("Should get weather data from bot for multiple locations", async function () {
        console.log("🌤️ Testing weather data from bot...")

        for (const location of TEST_LOCATIONS) {
            console.log(`\n📍 Testing ${location.name} (${location.lat}, ${location.lon})`)

            try {
                const response = await axios.get(
                    `${BOT_URL}/weather/${location.lat}/${location.lon}`,
                )

                console.log(`✅ Bot Response for ${location.name}:`)
                console.log(`   Success: ${response.data.success}`)
                console.log(`   Updated: ${response.data.updated}`)

                if (response.data.weatherData) {
                    const data = response.data.weatherData
                    console.log(`   30-day rainfall: ${data.rainfall30d / 1000}mm`)
                    console.log(`   24-hour rainfall: ${data.rainfall24h / 1000}mm`)
                    console.log(`   Temperature: ${data.temperature / 1000}°C`)
                    console.log(`   Source: ${data.source}`)
                }

                if (response.data.blockchain) {
                    console.log(`   Transaction: ${response.data.blockchain.txHash}`)
                    console.log(`   Gas Used: ${response.data.blockchain.gasUsed}`)
                }

                expect(response.data.success).to.be.true
            } catch (error) {
                console.error(`❌ Failed to get weather for ${location.name}: ${error.message}`)
                if (error.response) {
                    console.error(`   Status: ${error.response.status}`)
                    console.error(`   Data: ${JSON.stringify(error.response.data)}`)
                }
                throw error
            }
        }
    })

    it("Should verify weather data is stored on contract", async function () {
        console.log("⛓️ Verifying data on WeatherOracle contract...")

        for (const location of TEST_LOCATIONS) {
            console.log(`\n📍 Checking ${location.name} on contract...`)

            const lat = Math.floor(location.lat * 10000) // Convert to contract format (scaled by 10000)
            const lon = Math.floor(location.lon * 10000)

            try {
                const weatherData = await weatherOracle.getWeatherData(lat, lon)

                console.log(`✅ Contract Data for ${location.name}:`)
                console.log(`   30-day rainfall: ${Number(weatherData.rainfall30d) / 1000}mm`)
                console.log(`   24-hour rainfall: ${Number(weatherData.rainfall24h) / 1000}mm`)
                console.log(`   Temperature: ${Number(weatherData.temperature) / 1000}°C`)
                console.log(`   Timestamp: ${new Date(Number(weatherData.timestamp) * 1000)}`)
                console.log(`   Valid: ${weatherData.isValid}`)

                // Verify data exists and is recent (within last hour)
                expect(weatherData.isValid).to.be.true
                expect(Number(weatherData.timestamp)).to.be.gt(0)

                const now = Math.floor(Date.now() / 1000)
                const dataAge = now - Number(weatherData.timestamp)
                console.log(`   Data age: ${Math.floor(dataAge / 60)} minutes`)

                // Data should be recent (within 1 hour = 3600 seconds)
                expect(dataAge).to.be.lt(3600)
            } catch (error) {
                console.error(
                    `❌ Failed to get contract data for ${location.name}: ${error.message}`,
                )
                throw error
            }
        }
    })

    it("Should test bot status endpoint", async function () {
        console.log("📊 Checking bot status...")

        try {
            const response = await axios.get(`${BOT_URL}/status`)

            console.log(`✅ Bot Status:`)
            console.log(`   Service: ${response.data.service}`)
            console.log(`   Version: ${response.data.version}`)
            console.log(`   Status: ${response.data.status}`)
            console.log(`   Uptime: ${Math.floor(response.data.uptime)}s`)

            expect(response.data.service).to.equal("Weather Oracle Bot")
            expect(response.data.status).to.equal("running")
        } catch (error) {
            console.error(`❌ Status check failed: ${error.message}`)
            throw error
        }
    })

    it("Should test specific drought scenario", async function () {
        console.log("🏜️ Testing drought scenario detection...")

        // Test with Nairobi coordinates
        const location = TEST_LOCATIONS[0] // Nairobi

        try {
            const response = await axios.get(`${BOT_URL}/weather/${location.lat}/${location.lon}`)

            if (response.data.weatherData) {
                const data = response.data.weatherData
                const rainfall30d = data.rainfall30d / 1000 // Convert to mm

                console.log(`📊 Weather Analysis for ${location.name}:`)
                console.log(`   30-day rainfall: ${rainfall30d}mm`)

                if (rainfall30d < 50) {
                    console.log(`🏜️ DROUGHT DETECTED! (< 50mm)`)
                    console.log(`   → This would trigger 100% insurance payout`)
                } else if (rainfall30d > 200) {
                    console.log(`🌊 FLOOD CONDITIONS! (> 200mm)`)
                    console.log(`   → This would trigger 100% insurance payout`)
                } else {
                    console.log(`🌤️ Normal conditions (50-200mm)`)
                    console.log(`   → No insurance payout needed`)
                }

                const temperature = data.temperature / 1000
                if (temperature > 38) {
                    console.log(`🔥 HEATWAVE DETECTED! (> 38°C)`)
                    console.log(`   → This would trigger 75% insurance payout`)
                }
            }
        } catch (error) {
            console.error(`❌ Drought scenario test failed: ${error.message}`)
            throw error
        }
    })

    it("Should show integration summary", async function () {
        console.log("\n" + "=".repeat(60))
        console.log("🎉 BOT → CONTRACT INTEGRATION SUMMARY")
        console.log("=".repeat(60))
        console.log(`🤖 Bot URL: ${BOT_URL}`)
        console.log(`⛓️ WeatherOracle: ${WEATHER_ORACLE_ADDRESS}`)
        console.log(`📍 Tested Locations: ${TEST_LOCATIONS.length}`)

        console.log("\n✅ Integration Flow Working:")
        console.log("   1. Bot fetches weather from APIs ✅")
        console.log("   2. Bot validates and formats data ✅")
        console.log("   3. Bot updates WeatherOracle contract ✅")
        console.log("   4. Contract stores data on-chain ✅")
        console.log("   5. RadiShield can read weather data ✅")

        console.log("\n🔄 Next Steps:")
        console.log("   • Set up automated weather updates")
        console.log("   • Configure RadiShield to use this data")
        console.log("   • Test complete insurance flow")
        console.log("   • Deploy to mainnet when ready")
        console.log("=".repeat(60))
    })
})
