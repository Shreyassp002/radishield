const { expect } = require("chai")
const { ethers } = require("hardhat")
const axios = require("axios")

describe("Bot Configuration Test", function () {
    let weatherOracle
    let deployer

    const WEATHER_ORACLE_ADDRESS = "0x36E4f5F0C95D31F9f280CB607796212E2B0b71AF"
    const BOT_URL = "https://radishield-production.up.railway.app"

    before(async function () {
        ;[deployer] = await ethers.getSigners()

        const WeatherOracle = await ethers.getContractFactory("WeatherOracle")
        weatherOracle = WeatherOracle.attach(WEATHER_ORACLE_ADDRESS)

        console.log(`🔗 Connected to WeatherOracle: ${WEATHER_ORACLE_ADDRESS}`)
        console.log(`🤖 Bot URL: ${BOT_URL}`)
        console.log(`👤 Deployer: ${deployer.address}`)
    })

    it("Should check if bot wallet is authorized", async function () {
        console.log("🔐 Checking bot authorization...")

        // First, let's see what the bot thinks its wallet address is
        try {
            const statusResponse = await axios.get(`${BOT_URL}/status`)
            console.log(`✅ Bot is running: ${statusResponse.data.status}`)
        } catch (error) {
            console.log(`❌ Bot status check failed: ${error.message}`)
        }

        // Check if deployer is authorized (should be)
        const deployerAuthorized = await weatherOracle.isAuthorizedOracle(deployer.address)
        console.log(`Deployer authorized: ${deployerAuthorized}`)

        // The bot might be using the same wallet as deployer
        if (deployerAuthorized) {
            console.log("✅ Deployer wallet is authorized - bot might be using same wallet")
        }
    })

    it("Should check current weather data on contract", async function () {
        console.log("📊 Checking existing data on contract...")

        const locations = [
            { name: "Nairobi", lat: -12921, lon: 368219 },
            { name: "New York", lat: 407128, lon: -740060 },
            { name: "London", lat: 515074, lon: -12780 },
        ]

        for (const location of locations) {
            try {
                const data = await weatherOracle.getWeatherData(location.lat, location.lon)

                if (Number(data.timestamp) > 0) {
                    console.log(`✅ ${location.name} has data:`)
                    console.log(`   Rainfall 30d: ${Number(data.rainfall30d) / 1000}mm`)
                    console.log(`   Rainfall 24h: ${Number(data.rainfall24h) / 1000}mm`)
                    console.log(`   Temperature: ${Number(data.temperature) / 1000}°C`)
                    console.log(`   Timestamp: ${new Date(Number(data.timestamp) * 1000)}`)
                    console.log(`   Valid: ${data.isValid}`)

                    const age = Math.floor(Date.now() / 1000) - Number(data.timestamp)
                    console.log(`   Age: ${Math.floor(age / 60)} minutes`)
                } else {
                    console.log(`❌ ${location.name}: No data found`)
                }
            } catch (error) {
                console.log(`❌ ${location.name}: Error reading data - ${error.message}`)
            }
        }
    })

    it("Should test bot with a new location", async function () {
        console.log("🌍 Testing bot with a new location (Mumbai)...")

        const mumbai = { lat: 19.076, lon: 72.8777 }

        try {
            const response = await axios.get(`${BOT_URL}/weather/${mumbai.lat}/${mumbai.lon}`)

            console.log(`✅ Bot Response for Mumbai:`)
            console.log(`   Success: ${response.data.success}`)
            console.log(`   Updated: ${response.data.updated}`)

            if (response.data.updated && response.data.blockchain) {
                console.log(`   Transaction: ${response.data.blockchain.txHash}`)
                console.log(`   Gas Used: ${response.data.blockchain.gasUsed}`)
                console.log("✅ Bot successfully updated contract for new location!")
            } else if (!response.data.updated) {
                console.log("ℹ️ Bot says data is already fresh (no update needed)")
            }

            if (response.data.weatherData) {
                const data = response.data.weatherData
                console.log(
                    `   Weather: ${data.rainfall30d / 1000}mm, ${data.temperature / 1000}°C`,
                )
            }
        } catch (error) {
            console.error(`❌ Mumbai test failed: ${error.message}`)
            if (error.response) {
                console.error(`   Status: ${error.response.status}`)
                console.error(`   Data: ${JSON.stringify(error.response.data)}`)
            }
        }
    })

    it("Should check bot configuration", async function () {
        console.log("⚙️ Bot should be configured with:")
        console.log(`   WEATHER_ORACLE_ADDRESS=${WEATHER_ORACLE_ADDRESS}`)
        console.log(`   RPC_URL=https://rpc-amoy.polygon.technology/`)
        console.log(`   PRIVATE_KEY=<same as deployer or authorized wallet>`)

        console.log("\n🔍 If bot is not updating:")
        console.log("   1. Check bot wallet is authorized on WeatherOracle")
        console.log("   2. Check bot has enough MATIC for gas")
        console.log("   3. Check bot environment variables")
        console.log("   4. Check bot logs on Railway")
    })
})
