const { expect } = require("chai")
const { ethers } = require("hardhat")

describe("Weather Oracle Testnet Test", function () {
    let weatherOracle
    let deployer
    let oracleBot

    // UPDATE THIS WITH YOUR DEPLOYED WEATHER ORACLE ADDRESS
    const WEATHER_ORACLE_ADDRESS = "0x36E4f5F0C95D31F9f280CB607796212E2B0b71AF"

    // Test coordinates
    const NAIROBI_LAT = -129210 // -1.2921 * 100000
    const NAIROBI_LON = 3682190 // 36.8219 * 100000

    before(async function () {
        console.log("🚀 Testing Weather Oracle on testnet...")

        const signers = await ethers.getSigners()
        deployer = signers[0]
        oracleBot = signers[0] // Use same wallet as deployer for simplicity

        console.log(`Deployer: ${deployer.address}`)
        console.log(`Oracle Bot: ${oracleBot.address}`)

        // Check balance
        const deployerBalance = await ethers.provider.getBalance(deployer.address)
        console.log(`Wallet balance: ${ethers.formatEther(deployerBalance)} MATIC`)
    })

    it("Should connect to deployed Weather Oracle", async function () {
        console.log("📋 Connecting to Weather Oracle...")

        const WeatherOracle = await ethers.getContractFactory("WeatherOracle")
        weatherOracle = WeatherOracle.attach(WEATHER_ORACLE_ADDRESS)

        console.log(`✅ Connected to WeatherOracle: ${await weatherOracle.getAddress()}`)

        // Test basic contract functionality
        try {
            const currentData = await weatherOracle.getWeatherData(NAIROBI_LAT, NAIROBI_LON)
            console.log(`Current weather data timestamp: ${currentData.timestamp}`)
        } catch (error) {
            console.log("⚠️ Make sure Weather Oracle address is correct!")
            throw error
        }
    })

    it("Should check and authorize oracle bot", async function () {
        console.log("🔐 Checking oracle bot authorization...")

        const isAuthorized = await weatherOracle.isAuthorizedOracle(oracleBot.address)
        console.log(`Oracle bot authorized: ${isAuthorized}`)

        if (!isAuthorized) {
            console.log("⚠️ Authorizing oracle bot...")
            const tx = await weatherOracle.connect(deployer).authorizeOracle(oracleBot.address)
            await tx.wait()
            console.log(`✅ Oracle bot ${oracleBot.address} authorized`)
        }

        const finalCheck = await weatherOracle.isAuthorizedOracle(oracleBot.address)
        expect(finalCheck).to.be.true
    })

    it("Should update weather data from bot", async function () {
        console.log("🌤️ Testing weather data update from bot...")

        // Get current weather data
        const currentData = await weatherOracle.getWeatherData(NAIROBI_LAT, NAIROBI_LON)
        console.log(`Current timestamp: ${currentData.timestamp}`)

        // Bot updates weather data (drought conditions)
        const rainfall30d = 45000 // 45mm (drought)
        const rainfall24h = 2000 // 2mm
        const temperature = 40000 // 40°C

        console.log("📡 Bot updating weather data...")
        const weatherData = {
            rainfall30d: rainfall30d,
            rainfall24h: rainfall24h,
            temperature: temperature,
            timestamp: Math.floor(Date.now() / 1000),
            isValid: true,
        }

        const tx = await weatherOracle
            .connect(oracleBot)
            .updateWeatherData(NAIROBI_LAT, NAIROBI_LON, weatherData)

        const receipt = await tx.wait()
        console.log(`✅ Update successful - TX: ${receipt.hash}`)
        console.log(`Gas used: ${receipt.gasUsed}`)

        // Verify data was updated
        const newData = await weatherOracle.getWeatherData(NAIROBI_LAT, NAIROBI_LON)

        expect(newData.rainfall30d).to.equal(rainfall30d)
        expect(newData.rainfall24h).to.equal(rainfall24h)
        expect(newData.temperature).to.equal(temperature)
        expect(newData.timestamp).to.be.gt(currentData.timestamp)

        console.log(`✅ Weather data verified:`)
        console.log(`   30-day rainfall: ${newData.rainfall30d / 1000}mm`)
        console.log(`   24-hour rainfall: ${newData.rainfall24h / 1000}mm`)
        console.log(`   Temperature: ${newData.temperature / 1000}°C`)
        console.log(`   Updated: ${new Date(Number(newData.timestamp) * 1000)}`)
    })

    it("Should test different weather conditions", async function () {
        console.log("🌦️ Testing different weather scenarios...")

        // Test normal weather
        console.log("Testing normal weather...")
        await weatherOracle.connect(oracleBot).updateWeatherData(NAIROBI_LAT, NAIROBI_LON, {
            rainfall30d: 80000, // 80mm normal rainfall
            rainfall24h: 15000, // 15mm normal daily
            temperature: 28000, // 28°C normal temp
            timestamp: Math.floor(Date.now() / 1000),
            isValid: true,
        })

        let data = await weatherOracle.getWeatherData(NAIROBI_LAT, NAIROBI_LON)
        console.log(`Normal: ${data.rainfall30d / 1000}mm, ${data.temperature / 1000}°C`)

        // Test flood conditions
        console.log("Testing flood conditions...")
        await weatherOracle.connect(oracleBot).updateWeatherData(NAIROBI_LAT, NAIROBI_LON, {
            rainfall30d: 200000, // 200mm heavy rainfall
            rainfall24h: 120000, // 120mm flood daily
            temperature: 25000, // 25°C
            timestamp: Math.floor(Date.now() / 1000),
            isValid: true,
        })

        data = await weatherOracle.getWeatherData(NAIROBI_LAT, NAIROBI_LON)
        console.log(`Flood: ${data.rainfall30d / 1000}mm, ${data.rainfall24h / 1000}mm daily`)

        // Test heatwave
        console.log("Testing heatwave conditions...")
        await weatherOracle.connect(oracleBot).updateWeatherData(NAIROBI_LAT, NAIROBI_LON, {
            rainfall30d: 60000, // 60mm
            rainfall24h: 10000, // 10mm
            temperature: 42000, // 42°C heatwave
            timestamp: Math.floor(Date.now() / 1000),
            isValid: true,
        })

        data = await weatherOracle.getWeatherData(NAIROBI_LAT, NAIROBI_LON)
        console.log(`Heatwave: ${data.temperature / 1000}°C`)

        console.log("✅ All weather scenarios tested successfully")
    })

    it("Should show bot configuration info", async function () {
        console.log("\n🤖 Bot Configuration:")
        console.log(`WeatherOracle Address: ${await weatherOracle.getAddress()}`)
        console.log(`Oracle Bot Address: ${oracleBot.address}`)
        console.log(`RPC URL: ${process.env.POLYGON_AMOY_RPC_URL}`)

        console.log("\n📝 Update your bot .env file:")
        console.log(`WEATHER_ORACLE_ADDRESS=${await weatherOracle.getAddress()}`)
        console.log(`PRIVATE_KEY=${process.env.PRIVATE_KEY}`)
        console.log(`RPC_URL=${process.env.POLYGON_AMOY_RPC_URL}`)

        // Show current weather data
        const weatherData = await weatherOracle.getWeatherData(NAIROBI_LAT, NAIROBI_LON)
        console.log("\n🌤️ Current weather data on contract:")
        console.log(`   30-day rainfall: ${weatherData.rainfall30d / 1000}mm`)
        console.log(`   24-hour rainfall: ${weatherData.rainfall24h / 1000}mm`)
        console.log(`   Temperature: ${weatherData.temperature / 1000}°C`)
        console.log(`   Last update: ${new Date(Number(weatherData.timestamp) * 1000)}`)

        console.log("\n✅ Weather Oracle testnet test completed!")
    })
})
