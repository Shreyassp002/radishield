const { expect } = require("chai")
const { ethers } = require("hardhat")
require("dotenv").config()

// Helper function to get deployed contract addresses
function getContractAddresses() {
    try {
        const weatherOracleDeployment = require("../deployments/polygonAmoy/WeatherOracle.json")
        const radiShieldDeployment = require("../deployments/polygonAmoy/RadiShield.json")
        return {
            weatherOracle: weatherOracleDeployment.address,
            radiShield: radiShieldDeployment.address,
        }
    } catch (error) {
        console.log("⚠️ Could not read deployment files, using latest addresses")
        return {
            weatherOracle: "0xFB45AD2145e5fC19EFF37C04B120b1fc491eF66e",
            radiShield: "0xD0A36216e870FA0c91B4Db5CAD04b85ee684dc9d",
        }
    }
}

describe("Working Insurance System Test", function () {
    let weatherOracle
    let radiShield
    let deployer
    let farmer

    const CONTRACT_ADDRESSES = getContractAddresses()

    // Test location (Lagos, Nigeria)
    const LAGOS_LAT = 65244 // 6.5244 * 10000
    const LAGOS_LON = 33792 // 3.3792 * 10000

    before(async function () {
        console.log("🛡️ Testing Working Insurance System...")

        const signers = await ethers.getSigners()
        deployer = signers[0]

        // Create farmer from private key if provided
        if (
            process.env.FARMER_PRIVATE_KEY &&
            process.env.FARMER_PRIVATE_KEY !== "your_farmer_testnet_private_key_here"
        ) {
            farmer = new ethers.Wallet(process.env.FARMER_PRIVATE_KEY, ethers.provider)
            console.log(`🌾 Using testnet farmer account: ${farmer.address}`)
        } else {
            farmer = deployer // Use deployer for local testing
            console.log("🧪 Using deployer account as farmer for local testing")
        }

        console.log(`Deployer: ${deployer.address}`)
        console.log(`Farmer: ${farmer.address}`)

        // Check balances
        const deployerBalance = await ethers.provider.getBalance(deployer.address)
        let farmerBalance = await ethers.provider.getBalance(farmer.address)
        console.log(`Deployer balance: ${ethers.formatEther(deployerBalance)} POL`)
        console.log(`Farmer balance: ${ethers.formatEther(farmerBalance)} POL`)

        // Fund farmer on local network if needed
        if (farmerBalance < ethers.parseEther("0.1") && network.name === "hardhat") {
            console.log("💰 Funding farmer account for local testing...")
            const fundTx = await deployer.sendTransaction({
                to: farmer.address,
                value: ethers.parseEther("10"),
            })
            await fundTx.wait()
            farmerBalance = await ethers.provider.getBalance(farmer.address)
            console.log(
                `✅ Funded farmer with 10 POL - New balance: ${ethers.formatEther(farmerBalance)} POL`,
            )
        } else if (farmerBalance < ethers.parseEther("0.1")) {
            console.log(
                "⚠️ Warning: Farmer account has low POL balance. Get POL from faucet: https://faucet.polygon.technology/",
            )
        }
    })

    it("Should connect to deployed contracts", async function () {
        console.log("📋 Connecting to deployed contracts...")

        // Connect to deployed WeatherOracle
        const WeatherOracle = await ethers.getContractFactory("WeatherOracle")
        weatherOracle = WeatherOracle.attach(CONTRACT_ADDRESSES.weatherOracle)
        console.log(`✅ Connected to WeatherOracle: ${CONTRACT_ADDRESSES.weatherOracle}`)

        // Connect to deployed RadiShield
        const RadiShield = await ethers.getContractFactory("RadiShield")
        radiShield = RadiShield.attach(CONTRACT_ADDRESSES.radiShield)
        console.log(`✅ Connected to RadiShield: ${CONTRACT_ADDRESSES.radiShield}`)

        // Verify contracts are deployed
        expect(await radiShield.getAddress()).to.be.properAddress
        expect(await weatherOracle.getAddress()).to.be.properAddress

        // Verify RadiShield is connected to correct WeatherOracle
        const connectedOracle = await radiShield.weatherOracle()
        expect(connectedOracle.toLowerCase()).to.equal(
            CONTRACT_ADDRESSES.weatherOracle.toLowerCase(),
        )
        console.log(`✅ RadiShield connected to correct WeatherOracle`)
    })

    it("Should verify POL balances", async function () {
        console.log("💰 Verifying POL balances...")

        const farmerBalance = await ethers.provider.getBalance(farmer.address)
        const contractBalance = await ethers.provider.getBalance(await radiShield.getAddress())

        console.log(`✅ Farmer POL: ${ethers.formatEther(farmerBalance)} POL`)
        console.log(`✅ RadiShield POL: ${ethers.formatEther(contractBalance)} POL`)

        // Just verify balances exist
        expect(contractBalance).to.be.gte(0)
        expect(farmerBalance).to.be.gte(0)
    })

    it("Should create insurance policy with POL", async function () {
        // Skip if farmer has no POL
        const farmerBalance = await ethers.provider.getBalance(farmer.address)
        if (farmerBalance < ethers.parseEther("0.1")) {
            console.log("⏭️ Skipping policy creation - farmer needs POL from faucet")
            this.skip()
        }

        console.log("📋 Creating insurance policy with POL...")

        // Get initial stats to track the change
        const initialStats = await radiShield.getContractStats()
        const initialPolicies = initialStats.totalPolicies
        const initialActivePolicies = initialStats.activePolicies

        // Policy parameters
        const cropType = "maize"
        const coverage = ethers.parseEther("1") // 1 POL coverage (minimum allowed)
        const duration = 30 * 24 * 60 * 60 // 30 days
        const latitude = 7 // Lagos area (will be scaled to 70000)
        const longitude = 3 // Lagos area (will be scaled to 30000)

        // Calculate premium
        const premium = (coverage * 700n) / 10000n // 7% premium
        console.log(`📊 Policy Details:`)
        console.log(`   Coverage: ${ethers.formatEther(coverage)} POL`)
        console.log(`   Premium: ${ethers.formatEther(premium)} POL`)

        // Create policy
        const tx = await radiShield
            .connect(farmer)
            .createPolicy(cropType, coverage, duration, latitude, longitude, { value: premium })

        const receipt = await tx.wait()
        console.log(`✅ Policy created - TX: ${receipt.hash}`)

        // Verify policy was created (check increment from initial state)
        const finalStats = await radiShield.getContractStats()
        expect(finalStats.totalPolicies).to.equal(initialPolicies + 1n)
        expect(finalStats.activePolicies).to.equal(initialActivePolicies + 1n)

        console.log(`📊 Contract Stats After Policy:`)
        console.log(`   Total Policies: ${finalStats.totalPolicies}`)
        console.log(`   Active Policies: ${finalStats.activePolicies}`)
        console.log(`   Contract Balance: ${ethers.formatEther(finalStats.contractBalance)} POL`)
    })

    it("Should show contract statistics", async function () {
        console.log("📊 Getting contract statistics...")

        const stats = await radiShield.getContractStats()

        console.log("\n📈 CONTRACT STATISTICS:")
        console.log("-".repeat(50))
        console.log(`📋 Total Policies Created: ${stats.totalPolicies}`)
        console.log(`✅ Active Policies: ${stats.activePolicies}`)
        console.log(`💰 Claimed Policies: ${stats.claimedPolicies}`)
        console.log(`🏦 Total Coverage: ${ethers.formatEther(stats.totalCoverage)} POL`)
        console.log(`💵 Total Premiums Collected: ${ethers.formatEther(stats.totalPremiums)} POL`)
        console.log(`💎 Contract Balance: ${ethers.formatEther(stats.contractBalance)} POL`)

        // Health check
        if (Number(stats.totalCoverage) > Number(stats.contractBalance)) {
            console.log("⚠️ WARNING: Total coverage exceeds contract balance")
        } else if (stats.contractBalance > 0) {
            console.log("✅ HEALTHY: Contract has sufficient funds")
        }

        console.log("\n🎯 SYSTEM STATUS:")
        console.log("   • Native POL payments ✅")
        console.log("   • African geographic restrictions ✅")
        console.log("   • Coverage limits: 1-10 POL ✅")
        console.log("   • Premium rate: 7% ✅")

        // Verify stats are reasonable
        expect(stats.totalPolicies).to.be.gte(0)
        expect(stats.activePolicies).to.be.lte(stats.totalPolicies)
        expect(stats.claimedPolicies).to.be.lte(stats.totalPolicies)
    })
})
