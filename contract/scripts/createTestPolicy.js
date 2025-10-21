const { ethers } = require("hardhat")
require("dotenv").config()

// Helper function to get deployed RadiShield address
function getRadiShieldAddress() {
    try {
        const deployment = require("../deployments/polygonAmoy/RadiShield.json")
        return deployment.address
    } catch (error) {
        console.log("⚠️ Could not read RadiShield deployment file")
        return null
    }
}

async function createTestPolicy() {
    console.log("📋 Creating Test Insurance Policy...")
    console.log("=".repeat(50))

    try {
        // Get contract address
        const contractAddress = getRadiShieldAddress()
        if (!contractAddress) {
            return
        }

        console.log(`🛡️ RadiShield Contract: ${contractAddress}`)

        // Get signer (farmer account)
        let farmer
        if (
            process.env.FARMER_PRIVATE_KEY &&
            process.env.FARMER_PRIVATE_KEY !== "your_farmer_testnet_private_key_here"
        ) {
            farmer = new ethers.Wallet(process.env.FARMER_PRIVATE_KEY, ethers.provider)
            console.log(`🌾 Using farmer account: ${farmer.address}`)
        } else {
            ;[farmer] = await ethers.getSigners()
            console.log(`🧪 Using default account: ${farmer.address}`)
        }

        // Check farmer balance
        const farmerBalance = await ethers.provider.getBalance(farmer.address)
        console.log(`💰 Farmer balance: ${ethers.formatEther(farmerBalance)} POL`)

        if (farmerBalance < ethers.parseEther("0.1")) {
            console.log(
                "❌ Farmer needs more POL. Get from faucet: https://faucet.polygon.technology/",
            )
            return
        }

        // Connect to contract
        const RadiShield = await ethers.getContractFactory("RadiShield")
        const radiShield = RadiShield.attach(contractAddress)

        // Policy parameters
        const cropType = "maize"
        const coverage = ethers.parseEther("2") // 2 POL coverage
        const duration = 30 * 24 * 60 * 60 // 30 days
        const latitude = 7 // Lagos area (will be scaled to 70000)
        const longitude = 3 // Lagos area (will be scaled to 30000)

        // Calculate premium
        const premium = (coverage * 700n) / 10000n // 7% premium
        console.log(`📊 Policy Details:`)
        console.log(`   Crop: ${cropType}`)
        console.log(`   Coverage: ${ethers.formatEther(coverage)} POL`)
        console.log(`   Premium: ${ethers.formatEther(premium)} POL`)
        console.log(`   Duration: 30 days`)
        console.log(`   Location: Lagos area (${latitude}, ${longitude})`)

        // Create policy
        console.log("\n🚀 Creating policy...")
        const tx = await radiShield
            .connect(farmer)
            .createPolicy(cropType, coverage, duration, latitude, longitude, { value: premium })

        console.log("⏳ Waiting for transaction confirmation...")
        const receipt = await tx.wait()

        console.log(`✅ Policy created successfully!`)
        console.log(`   Transaction: ${receipt.hash}`)
        console.log(`   Gas used: ${receipt.gasUsed}`)

        // Get updated stats
        console.log("\n📊 Updated Contract Stats:")
        const stats = await radiShield.getContractStats()
        console.log(`   Total Policies: ${stats.totalPolicies}`)
        console.log(`   Active Policies: ${stats.activePolicies}`)
        console.log(`   Contract Balance: ${ethers.formatEther(stats.contractBalance)} POL`)
        console.log(`   Total Coverage: ${ethers.formatEther(stats.totalCoverage)} POL`)
        console.log(`   Total Premiums: ${ethers.formatEther(stats.totalPremiums)} POL`)

        // Get policy details
        const policyId = stats.totalPolicies
        const policy = await radiShield.getPolicy(policyId)

        console.log(`\n📋 Policy #${policyId} Details:`)
        console.log(`   Farmer: ${policy.farmer}`)
        console.log(`   Crop: ${policy.cropType}`)
        console.log(`   Coverage: ${ethers.formatEther(policy.coverage)} POL`)
        console.log(`   Premium: ${ethers.formatEther(policy.premium)} POL`)
        console.log(`   Active: ${policy.isActive}`)
        console.log(`   Claimed: ${policy.claimed}`)

        console.log("\n🎉 Test policy created successfully!")
        console.log(
            "Run 'npx hardhat run scripts/checkStats.js --network polygonAmoy' to see updated stats",
        )
    } catch (error) {
        console.error("❌ Error creating test policy:", error.message)

        if (error.message.includes("InsufficientBalance")) {
            console.log("\n💡 Issue: Not enough POL sent for premium")
            console.log("   Solution: Check premium calculation")
        } else if (error.message.includes("InvalidLocation")) {
            console.log("\n💡 Issue: Location not in Africa")
            console.log("   Solution: Use African coordinates")
        }
    }
}

// Run the script
async function main() {
    await createTestPolicy()
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error)
        process.exit(1)
    })
