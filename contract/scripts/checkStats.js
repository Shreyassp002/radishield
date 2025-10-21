const { ethers } = require("hardhat")
require("dotenv").config()

// Helper function to get deployed RadiShield address
function getRadiShieldAddress() {
    try {
        const deployment = require("../deployments/polygonAmoy/RadiShield.json")
        return deployment.address
    } catch (error) {
        console.log("⚠️ Could not read RadiShield deployment file")
        console.log("Please deploy RadiShield first or provide address manually")
        return null
    }
}

async function checkContractStats() {
    console.log("📊 Checking RadiShield Contract Statistics...")
    console.log("=".repeat(60))

    try {
        // Get contract address
        const contractAddress = getRadiShieldAddress()
        if (!contractAddress) {
            return
        }

        console.log(`🛡️ RadiShield Contract: ${contractAddress}`)
        console.log(`🌐 Network: ${network.name}`)

        // Connect to contract
        const RadiShield = await ethers.getContractFactory("RadiShield")
        const radiShield = RadiShield.attach(contractAddress)

        // Get contract stats
        console.log("\n📈 Fetching contract statistics...")
        const stats = await radiShield.getContractStats()

        // Display stats
        console.log("\n" + "=".repeat(60))
        console.log("📊 RADISHIELD CONTRACT STATISTICS")
        console.log("=".repeat(60))

        console.log(`📋 Total Policies Created: ${stats.totalPolicies}`)
        console.log(`✅ Active Policies: ${stats.activePolicies}`)
        console.log(`💰 Claimed Policies: ${stats.claimedPolicies}`)
        console.log(`🏦 Total Coverage: ${ethers.formatEther(stats.totalCoverage)} POL`)
        console.log(`💵 Total Premiums Collected: ${ethers.formatEther(stats.totalPremiums)} POL`)
        console.log(`💎 Contract Balance: ${ethers.formatEther(stats.contractBalance)} POL`)

        // Calculate some additional metrics
        const claimRate =
            stats.totalPolicies > 0
                ? ((Number(stats.claimedPolicies) / Number(stats.totalPolicies)) * 100).toFixed(2)
                : 0

        const avgCoverage =
            stats.totalPolicies > 0
                ? ethers.formatEther(stats.totalCoverage / stats.totalPolicies)
                : 0

        const avgPremium =
            stats.totalPolicies > 0
                ? ethers.formatEther(stats.totalPremiums / stats.totalPolicies)
                : 0

        console.log("\n📊 CALCULATED METRICS")
        console.log("-".repeat(40))
        console.log(`📈 Claim Rate: ${claimRate}%`)
        console.log(`📊 Average Coverage: ${avgCoverage} POL`)
        console.log(`💰 Average Premium: ${avgPremium} POL`)

        // Risk assessment
        const exposureRatio =
            stats.contractBalance > 0
                ? (Number(stats.totalCoverage) / Number(stats.contractBalance)).toFixed(2)
                : "∞"

        console.log(`⚠️ Exposure Ratio: ${exposureRatio}x (Coverage/Balance)`)

        // Status indicators
        console.log("\n🚦 CONTRACT HEALTH")
        console.log("-".repeat(40))

        if (stats.contractBalance === 0n) {
            console.log("🔴 CRITICAL: No funds available for payouts!")
        } else if (Number(stats.totalCoverage) > Number(stats.contractBalance)) {
            console.log("🟡 WARNING: Total coverage exceeds contract balance")
            console.log(
                `   Need ${ethers.formatEther(stats.totalCoverage - stats.contractBalance)} more POL`,
            )
        } else {
            console.log("🟢 HEALTHY: Contract has sufficient funds for current policies")
        }

        if (stats.activePolicies === 0n) {
            console.log("📝 INFO: No active policies")
        } else {
            console.log(`📋 INFO: ${stats.activePolicies} policies currently active`)
        }

        console.log("\n" + "=".repeat(60))

        // Get individual policy details if there are policies
        if (stats.totalPolicies > 0) {
            console.log("\n📋 RECENT POLICIES")
            console.log("-".repeat(40))

            const maxPolicies = Math.min(Number(stats.totalPolicies), 5) // Show last 5 policies

            for (let i = 1; i <= maxPolicies; i++) {
                try {
                    const policy = await radiShield.getPolicy(i)
                    const status = policy.claimed
                        ? "🔴 CLAIMED"
                        : policy.isActive
                          ? "🟢 ACTIVE"
                          : "⚫ INACTIVE"

                    console.log(
                        `Policy #${i}: ${policy.cropType} | ${ethers.formatEther(policy.coverage)} POL | ${status}`,
                    )
                } catch (error) {
                    console.log(`Policy #${i}: Error reading policy`)
                }
            }

            if (Number(stats.totalPolicies) > 5) {
                console.log(`... and ${Number(stats.totalPolicies) - 5} more policies`)
            }
        }
    } catch (error) {
        console.error("❌ Error checking contract stats:", error.message)

        if (error.message.includes("call revert exception")) {
            console.log("\n💡 Possible issues:")
            console.log("   - Contract not deployed on this network")
            console.log("   - Wrong contract address")
            console.log("   - Network connection issues")
        }
    }
}

// Run the script
async function main() {
    await checkContractStats()
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error)
        process.exit(1)
    })
