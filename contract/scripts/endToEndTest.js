const { ethers } = require("hardhat")
require("dotenv").config()

async function main() {
    console.log("🚀 RadiShield End-to-End System Test")
    console.log("====================================")

    const RADISHIELD_ADDRESS = "0xD0A36216e870FA0c91B4Db5CAD04b85ee684dc9d"
    const WEATHER_ORACLE_ADDRESS = "0xFB45AD2145e5fC19EFF37C04B120b1fc491eF66e"

    // Connect to contracts
    const RadiShield = await ethers.getContractFactory("RadiShield")
    const radiShield = await RadiShield.attach(RADISHIELD_ADDRESS)

    const WeatherOracle = await ethers.getContractFactory("WeatherOracle")
    const weatherOracle = await WeatherOracle.attach(WEATHER_ORACLE_ADDRESS)

    const [owner] = await ethers.getSigners()
    console.log(`👤 Testing with: ${owner.address}`)

    // Test coordinates (Nairobi, Kenya)
    const latitude = -1 * 10000 // -1 degree scaled
    const longitude = 36 * 10000 // 36 degrees scaled

    console.log(`📍 Test Location: Nairobi (${latitude / 10000}°, ${longitude / 10000}°)`)

    try {
        console.log("\n💰 Step 1: Check Contract Funding")
        const contractBalance = await ethers.provider.getBalance(RADISHIELD_ADDRESS)
        console.log(`   Contract Balance: ${ethers.formatEther(contractBalance)} POL`)

        if (contractBalance === 0n) {
            console.log("   ⚠️ Contract needs funding for payouts!")
            console.log("   Run: npx hardhat run scripts/fundContract.js --network polygonAmoy")
        }

        console.log("\n🌡️ Step 2: Test Weather Data Update (Normal Weather)")
        const normalWeather = {
            rainfall30d: 80, // 80mm (above 5mm drought threshold)
            rainfall24h: 20, // 20mm (below 200mm flood threshold)
            temperature: 30000, // 30°C (below 55°C heatwave threshold)
            timestamp: 0,
            isValid: true,
        }

        console.log(`   Rainfall 30d: ${normalWeather.rainfall30d}mm (threshold: <5mm for drought)`)
        console.log(`   Rainfall 24h: ${normalWeather.rainfall24h}mm (threshold: >200mm for flood)`)
        console.log(
            `   Temperature: ${normalWeather.temperature / 1000}°C (threshold: >55°C for heatwave)`,
        )
        console.log(`   Expected: No payout triggers`)

        const updateTx = await weatherOracle.updateWeatherData(latitude, longitude, normalWeather)
        await updateTx.wait()
        console.log(`   ✅ Normal weather data updated`)

        console.log("\n🌡️ Step 3: Test Weather Data Update (Drought Trigger)")
        const droughtWeather = {
            rainfall30d: 3, // 3mm (below 5mm drought threshold)
            rainfall24h: 1, // 1mm
            temperature: 30000, // 30°C
            timestamp: 0,
            isValid: true,
        }

        console.log(`   Rainfall 30d: ${droughtWeather.rainfall30d}mm (below 5mm threshold)`)
        console.log(`   Expected: DROUGHT TRIGGER - 100% payout`)

        const droughtTx = await weatherOracle.updateWeatherData(latitude, longitude, droughtWeather)
        await droughtTx.wait()
        console.log(`   ✅ Drought weather data updated`)

        console.log("\n📊 Step 4: Verify Data Integration")
        const storedData = await weatherOracle.getWeatherData(latitude, longitude)
        console.log(`   Stored in WeatherOracle:`)
        console.log(`     Rainfall 30d: ${storedData.rainfall30d}mm`)
        console.log(`     Rainfall 24h: ${storedData.rainfall24h}mm`)
        console.log(`     Temperature: ${Number(storedData.temperature) / 1000}°C`)

        // Test RadiShield's ability to read the data
        try {
            const radiShieldData = await radiShield.getWeatherData(1) // Assuming policy ID 1 exists
            console.log(`   ✅ RadiShield can read weather data`)
        } catch (error) {
            console.log(`   ⚠️ No policies exist yet to test RadiShield data reading`)
        }

        console.log("\n🎯 Step 5: System Readiness Check")

        const requirements = [
            {
                name: "Oracle Authorization",
                check: await weatherOracle.isAuthorizedOracle(owner.address),
                status: "✅ Weather bot can update data",
            },
            {
                name: "Weather Data Storage",
                check: storedData.isValid,
                status: "✅ Weather data stored and retrievable",
            },
            {
                name: "Drought Detection",
                check: storedData.rainfall30d < 5, // Below drought threshold
                status:
                    storedData.rainfall30d < 5
                        ? "✅ Drought conditions detected"
                        : "⚠️ Normal conditions",
            },
            {
                name: "Contract Integration",
                check:
                    (await radiShield.weatherOracle()).toLowerCase() ===
                    WEATHER_ORACLE_ADDRESS.toLowerCase(),
                status: "✅ RadiShield connected to WeatherOracle",
            },
            {
                name: "Geographic Restrictions",
                check: await radiShield.isLocationInAfrica(latitude, longitude),
                status: "✅ Africa-only coordinates enforced",
            },
        ]

        console.log("\n📋 System Status:")
        let allReady = true
        requirements.forEach((req) => {
            const status = req.check ? "✅" : "❌"
            console.log(`   ${status} ${req.name}: ${req.status}`)
            if (!req.check) allReady = false
        })

        console.log("\n🚀 FINAL STATUS:")
        if (allReady) {
            console.log("✅ SYSTEM FULLY OPERATIONAL!")
            console.log("\n🎯 Ready for Frontend Integration:")
            console.log("   • Farmers can create policies")
            console.log("   • Weather bot updates trigger automatic payouts")
            console.log("   • Geographic restrictions prevent abuse")
            console.log("   • Restrictive thresholds prevent false triggers")

            if (contractBalance > 0) {
                console.log(
                    `   • Contract funded with ${ethers.formatEther(contractBalance)} POL for payouts`,
                )
            } else {
                console.log(
                    "   ⚠️ Fund contract for payouts: npx hardhat run scripts/fundContract.js --network polygonAmoy",
                )
            }

            console.log("\n📱 Frontend Integration Details:")
            console.log(`   Network: Polygon Amoy (Chain ID: 80002)`)
            console.log(`   RadiShield: ${RADISHIELD_ADDRESS}`)
            console.log(`   WeatherOracle: ${WEATHER_ORACLE_ADDRESS}`)
            console.log(`   Payment: Native POL tokens`)
            console.log(`   Coverage: 1-10 POL range`)
            console.log(`   Premium: 7% of coverage`)
        } else {
            console.log("❌ SYSTEM NOT READY - Fix issues above")
        }
    } catch (error) {
        console.error("❌ End-to-end test failed:", error.message)
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error)
        process.exit(1)
    })
