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

describe("RadiShield Weather Oracle Integration", function () {
    let radiShield
    let weatherOracle
    let owner
    let farmer
    let oracleBot

    // Test constants
    const BASE_PREMIUM_RATE = 700 // 7%
    const MIN_COVERAGE = ethers.parseUnits("1", 18) // 1 POL
    const MAX_COVERAGE = ethers.parseUnits("10", 18) // 10 POL
    const CONTRACT_ADDRESSES = getContractAddresses()

    // Helper function to ensure contract has minimum funding
    async function ensureContractFunding(minAmount = "1") {
        const contractBalance = await ethers.provider.getBalance(CONTRACT_ADDRESSES.radiShield)
        const requiredBalance = ethers.parseEther(minAmount)

        if (contractBalance < requiredBalance) {
            console.log(
                `💰 Contract needs funding: ${ethers.formatEther(contractBalance)} < ${minAmount} POL`,
            )

            // Only fund on local network or if explicitly testing funding
            if (network.name === "hardhat") {
                const fundTx = await owner.sendTransaction({
                    to: CONTRACT_ADDRESSES.radiShield,
                    value: ethers.parseEther("2"),
                })
                await fundTx.wait()
                console.log(`✅ Contract funded with 2 POL`)
            } else {
                console.log(
                    `⚠️ Contract needs funding on testnet. Run: npx hardhat run scripts/fundNewContract.js --network polygonAmoy`,
                )
            }
        }
    }

    before(async function () {
        // Set timeout for testnet operations
        this.timeout(60000)
        const signers = await ethers.getSigners()
        owner = signers[0]
        oracleBot = signers[1] || signers[0] // Use owner as oracleBot if only one signer

        // Create farmer from private key if provided, otherwise use default signer
        if (
            process.env.FARMER_PRIVATE_KEY &&
            process.env.FARMER_PRIVATE_KEY !== "your_farmer_testnet_private_key_here"
        ) {
            farmer = new ethers.Wallet(process.env.FARMER_PRIVATE_KEY, ethers.provider)
            console.log(`🌾 Using testnet farmer account: ${farmer.address}`)

            // Check farmer balance
            const balance = await ethers.provider.getBalance(farmer.address)
            console.log(`💰 Farmer POL balance: ${ethers.formatEther(balance)} POL`)

            // Fund farmer on local network if needed
            if (balance < ethers.parseEther("0.1") && network.name === "hardhat") {
                console.log("💰 Funding farmer account for local testing...")
                const fundTx = await owner.sendTransaction({
                    to: farmer.address,
                    value: ethers.parseEther("10"),
                })
                await fundTx.wait()
                const newBalance = await ethers.provider.getBalance(farmer.address)
                console.log(
                    `✅ Funded farmer with 10 POL - New balance: ${ethers.formatEther(newBalance)} POL`,
                )
            } else if (balance < ethers.parseEther("0.1")) {
                console.log(
                    "⚠️ Warning: Farmer account has low POL balance. Get POL from faucet: https://faucet.polygon.technology/",
                )
            }
        } else {
            farmer = owner // Use default signer for local testing
            console.log("🧪 Using local test account for farmer")
        }

        // Connect to deployed contracts
        const WeatherOracle = await ethers.getContractFactory("WeatherOracle")
        weatherOracle = WeatherOracle.attach(CONTRACT_ADDRESSES.weatherOracle)
        console.log(`📍 Connected to WeatherOracle: ${CONTRACT_ADDRESSES.weatherOracle}`)

        const RadiShield = await ethers.getContractFactory("RadiShield")
        radiShield = RadiShield.attach(CONTRACT_ADDRESSES.radiShield)
        console.log(`📍 Connected to RadiShield: ${CONTRACT_ADDRESSES.radiShield}`)

        // Verify oracle bot is authorized (owner should be authorized by default)
        const isAuthorized = await weatherOracle.isAuthorizedOracle(owner.address)
        if (!isAuthorized) {
            console.log("⚠️ Owner not authorized as oracle - some tests may fail")
        } else {
            console.log("✅ Owner authorized as oracle")
        }
    })

    describe("calculatePremium", function () {
        it("should calculate correct premium for valid inputs", async function () {
            const coverage = ethers.parseUnits("10", 18) // 10 POL
            const latitude = -129210 // Nairobi latitude scaled by 10000
            const longitude = 368219 // Nairobi longitude scaled by 10000

            const expectedPremium = (coverage * BigInt(BASE_PREMIUM_RATE)) / BigInt(10000)

            const premium = await radiShield.calculatePremium.staticCall(
                coverage,
                latitude,
                longitude,
            )
            expect(premium).to.equal(expectedPremium)
        })

        it("should emit PremiumCalculated event", async function () {
            const coverage = ethers.parseUnits("5", 18)
            const latitude = -129210
            const longitude = 368219

            await expect(radiShield.calculatePremium(coverage, latitude, longitude))
                .to.emit(radiShield, "PremiumCalculated")
                .withArgs(
                    coverage,
                    latitude,
                    longitude,
                    (coverage * BigInt(BASE_PREMIUM_RATE)) / BigInt(10000),
                )
        })

        it("should calculate 7% premium rate correctly", async function () {
            const testCases = [
                ethers.parseUnits("1", 18), // 1 POL
                ethers.parseUnits("3", 18), // 3 POL
                ethers.parseUnits("5", 18), // 5 POL
                ethers.parseUnits("8", 18), // 8 POL (within 10 POL max)
            ]

            const latitude = 0 // Equator
            const longitude = 0 // Prime meridian

            for (const coverage of testCases) {
                const premium = await radiShield.calculatePremium.staticCall(
                    coverage,
                    latitude,
                    longitude,
                )
                const expectedPremium = (coverage * BigInt(7)) / BigInt(100) // 7%
                expect(premium).to.equal(expectedPremium)
            }
        })

        it("should revert for coverage below minimum", async function () {
            const coverage = ethers.parseUnits("0.5", 18) // 0.5 POL - below minimum
            const latitude = 0
            const longitude = 0

            await expect(radiShield.calculatePremium(coverage, latitude, longitude))
                .to.be.revertedWithCustomError(radiShield, "InvalidCoverage")
                .withArgs(coverage)
        })

        it("should revert for coverage above maximum", async function () {
            const coverage = ethers.parseUnits("15", 18) // 15 POL - above maximum
            const latitude = 0
            const longitude = 0

            await expect(radiShield.calculatePremium(coverage, latitude, longitude))
                .to.be.revertedWithCustomError(radiShield, "InvalidCoverage")
                .withArgs(coverage)
        })

        it("should revert for invalid latitude (too low)", async function () {
            const coverage = ethers.parseEther("5") // 5 POL (valid amount)
            const latitude = -1000000 // Below -90 degrees scaled
            const longitude = 0

            await expect(radiShield.calculatePremium(coverage, latitude, longitude))
                .to.be.revertedWithCustomError(radiShield, "InvalidLocation")
                .withArgs(latitude, longitude)
        })

        it("should revert for invalid latitude (too high)", async function () {
            const coverage = ethers.parseEther("5") // 5 POL (valid amount)
            const latitude = 1000000 // Above 90 degrees scaled
            const longitude = 0

            await expect(radiShield.calculatePremium(coverage, latitude, longitude))
                .to.be.revertedWithCustomError(radiShield, "InvalidLocation")
                .withArgs(latitude, longitude)
        })

        it("should accept valid African coordinates", async function () {
            const coverage = ethers.parseEther("5") // 5 POL (valid amount)

            // Test valid African coordinates
            const validCoordinates = [
                { lat: -129210, lon: 368219 }, // Nairobi, Kenya
                { lat: 65244, lon: 33792 }, // Lagos, Nigeria
                { lat: 300444, lon: 312357 }, // Cairo, Egypt
                { lat: -339249, lon: 184241 }, // Cape Town, South Africa
            ]

            for (const coord of validCoordinates) {
                const premium = await radiShield.calculatePremium.staticCall(
                    coverage,
                    coord.lat,
                    coord.lon,
                )
                expect(premium).to.be.gt(0)
            }
        })
    })

    describe("createPolicy", function () {
        it("should create policy with correct parameters", async function () {
            const cropType = "maize"
            const coverage = ethers.parseUnits("5", 18) // 5 POL (reasonable for testing)
            const duration = 30 * 24 * 60 * 60 // 30 days in seconds
            const latitude = -1 // -1 degree (will be scaled to -10000)
            const longitude = 36 // 36 degrees (will be scaled to 360000)

            const expectedPremium = (coverage * BigInt(BASE_PREMIUM_RATE)) / BigInt(10000)

            const policyId = 1 // First policy should have ID 1

            // Check PolicyCreated event
            await expect(
                radiShield
                    .connect(farmer)
                    .createPolicy(cropType, coverage, duration, latitude, longitude, {
                        value: expectedPremium, // Send POL as payment
                    }),
            )
                .to.emit(radiShield, "PolicyCreated")
                .withArgs(policyId, farmer.address, coverage, cropType)

            // Verify policy details
            const policy = await radiShield.getPolicy(policyId)
            expect(policy.id).to.equal(policyId)
            expect(policy.farmer).to.equal(farmer.address)
            expect(policy.cropType).to.equal(cropType)
            expect(policy.coverage).to.equal(coverage)
            expect(policy.latitude).to.equal(-10000) // Scaled latitude
            expect(policy.longitude).to.equal(360000) // Scaled longitude
            expect(policy.isActive).to.be.true
            expect(policy.claimed).to.be.false

            // Check that premium was calculated and transferred
            expect(policy.premium).to.equal(expectedPremium)
        })

        it("should transfer premium from farmer to contract", async function () {
            const cropType = "maize"
            const coverage = ethers.parseUnits("10", 18)
            const duration = 30 * 24 * 60 * 60
            const latitude = 0
            const longitude = 0

            const expectedPremium = (coverage * BigInt(BASE_PREMIUM_RATE)) / BigInt(10000)
            const initialFarmerBalance = await ethers.provider.getBalance(farmer.address)
            const initialContractBalance = await ethers.provider.getBalance(
                await radiShield.getAddress(),
            )

            const tx = await radiShield
                .connect(farmer)
                .createPolicy(cropType, coverage, duration, latitude, longitude, {
                    value: expectedPremium,
                })

            const receipt = await tx.wait()
            const gasUsed = receipt.gasUsed * receipt.gasPrice

            const finalFarmerBalance = await ethers.provider.getBalance(farmer.address)
            const finalContractBalance = await ethers.provider.getBalance(
                await radiShield.getAddress(),
            )

            expect(finalFarmerBalance).to.equal(initialFarmerBalance - expectedPremium - gasUsed)
            expect(finalContractBalance).to.equal(initialContractBalance + expectedPremium)
        })
    })

    describe("Weather Oracle Integration", function () {
        let policyId

        beforeEach(async function () {
            // Skip if farmer has no POL
            const farmerBalance = await ethers.provider.getBalance(farmer.address)
            if (farmerBalance < ethers.parseEther("0.5")) {
                console.log("⏭️ Skipping weather tests - farmer needs POL")
                this.skip()
            }

            // Ensure contract has funding for payouts
            await ensureContractFunding("0.5")

            // Create a test policy with POL
            const coverage = ethers.parseEther("1") // 1 POL (minimum allowed)
            const premium = (coverage * 700n) / 10000n // 7% premium

            await radiShield
                .connect(farmer)
                .createPolicy("maize", coverage, 30 * 24 * 60 * 60, -1, 36, { value: premium })
            policyId = 1
        })

        describe("requestWeatherData", function () {
            it("should request weather data when no fresh data exists", async function () {
                const result = await radiShield.requestWeatherData.staticCall(policyId)
                expect(result).to.be.false // No fresh data available

                await expect(radiShield.requestWeatherData(policyId))
                    .to.emit(weatherOracle, "WeatherDataRequested")
                    .withArgs(-10000, 360000, await radiShield.getAddress())
            })

            it("should use existing fresh data immediately", async function () {
                // First, add fresh weather data to oracle
                const weatherData = {
                    rainfall30d: 80, // 80mm (unscaled - WeatherOracle expects raw mm)
                    rainfall24h: 20, // 20mm (unscaled - WeatherOracle expects raw mm)
                    temperature: 25000, // 25°C - scaled by 1000 (WeatherOracle expects bot format)
                    timestamp: 0, // Will be set by contract
                    isValid: true,
                }

                await weatherOracle
                    .connect(oracleBot)
                    .updateWeatherData(-10000, 360000, weatherData)

                // Now request should return true (fresh data available)
                const result = await radiShield.requestWeatherData.staticCall(policyId)
                expect(result).to.be.true
            })

            it("should revert for non-existent policy", async function () {
                const nonExistentPolicyId = 999

                await expect(radiShield.requestWeatherData(nonExistentPolicyId))
                    .to.be.revertedWithCustomError(radiShield, "PolicyNotFound")
                    .withArgs(nonExistentPolicyId)
            })

            it("should revert for already claimed policy", async function () {
                // First claim the policy
                await radiShield.emergencyPayout(policyId, ethers.parseEther("0.2"), "Test")

                await expect(radiShield.requestWeatherData(policyId))
                    .to.be.revertedWithCustomError(radiShield, "PolicyAlreadyClaimed")
                    .withArgs(policyId)
            })
        })

        describe("processWeatherData", function () {
            beforeEach(async function () {
                // Add weather data to oracle
                const weatherData = {
                    rainfall30d: 3, // 3mm - below drought threshold (5mm) - unscaled
                    rainfall24h: 1, // 1mm - unscaled
                    temperature: 30000, // 30°C - scaled by 1000
                    timestamp: 0,
                    isValid: true,
                }

                await weatherOracle
                    .connect(oracleBot)
                    .updateWeatherData(-10000, 360000, weatherData)
            })

            it("should process weather data and trigger drought payout", async function () {
                const expectedPayout = ethers.parseEther("1") // Full coverage for drought (1 POL)

                await expect(radiShield.processWeatherData(policyId))
                    .to.emit(radiShield, "WeatherDataReceived")
                    .withArgs(policyId, 3, 1, 30000)
                    .and.to.emit(radiShield, "PayoutTriggered")
                    .withArgs(policyId, "severe_drought", expectedPayout)
                    .and.to.emit(radiShield, "ClaimPaid")
                    .withArgs(policyId, farmer.address, expectedPayout, "Weather trigger")
            })

            it("should revert for invalid weather data", async function () {
                // Create policy at different location where no weather data exists
                const coverage = ethers.parseEther("1") // 1 POL
                const premium = (coverage * 700n) / 10000n // 7% premium

                await radiShield
                    .connect(farmer)
                    .createPolicy("coffee", coverage, 30 * 24 * 60 * 60, -2, 37, { value: premium })

                // Try to process weather data for location with no data
                await expect(radiShield.processWeatherData(2)).to.be.revertedWithCustomError(
                    weatherOracle,
                    "DataNotFound",
                )
            })
        })

        describe("Weather trigger thresholds", function () {
            it("should trigger drought payout for rainfall < 5mm in 30 days", async function () {
                const droughtWeatherData = {
                    rainfall30d: 3, // 3mm (below 5mm threshold) - unscaled
                    rainfall24h: 1, // 1mm - unscaled
                    temperature: 25000, // 25°C - scaled by 1000
                    timestamp: 0,
                    isValid: true,
                }

                await weatherOracle
                    .connect(oracleBot)
                    .updateWeatherData(-10000, 360000, droughtWeatherData)

                const tx = await radiShield.processWeatherData(policyId)
                await expect(tx)
                    .to.emit(radiShield, "PayoutTriggered")
                    .withArgs(policyId, "severe_drought", ethers.parseEther("1")) // 1 POL coverage
            })

            it("should trigger flood payout for rainfall > 200mm in 24 hours", async function () {
                const floodWeatherData = {
                    rainfall30d: 250, // 250mm - unscaled
                    rainfall24h: 220, // 220mm (above 200mm threshold) - unscaled
                    temperature: 25000, // 25°C - scaled by 1000
                    timestamp: 0,
                    isValid: true,
                }

                await weatherOracle
                    .connect(oracleBot)
                    .updateWeatherData(-10000, 360000, floodWeatherData)

                const tx = await radiShield.processWeatherData(policyId)
                await expect(tx)
                    .to.emit(radiShield, "PayoutTriggered")
                    .withArgs(policyId, "severe_flood", ethers.parseEther("1")) // 1 POL coverage
            })

            it("should trigger heatwave payout for temperature > 55°C", async function () {
                const heatwaveWeatherData = {
                    rainfall30d: 80, // 80mm - unscaled
                    rainfall24h: 20, // 20mm - unscaled
                    temperature: 57000, // 57°C (above 55°C threshold) - scaled by 1000
                    timestamp: 0,
                    isValid: true,
                }

                await weatherOracle
                    .connect(oracleBot)
                    .updateWeatherData(-10000, 360000, heatwaveWeatherData)

                const expectedPayout = (ethers.parseEther("1") * BigInt(75)) / BigInt(100) // 75% of 1 POL

                const tx = await radiShield.processWeatherData(policyId)
                await expect(tx)
                    .to.emit(radiShield, "PayoutTriggered")
                    .withArgs(policyId, "extreme_heatwave", expectedPayout)
            })

            it("should not trigger payout for normal weather conditions", async function () {
                const normalWeatherData = {
                    rainfall30d: 80, // 80mm (above 5mm drought threshold) - unscaled
                    rainfall24h: 20, // 20mm (below 200mm flood threshold) - unscaled
                    temperature: 30000, // 30°C (below 55°C heatwave threshold) - scaled by 1000
                    timestamp: 0,
                    isValid: true,
                }

                await weatherOracle
                    .connect(oracleBot)
                    .updateWeatherData(-10000, 360000, normalWeatherData)

                const tx = await radiShield.processWeatherData(policyId)
                const receipt = await tx.wait()

                // Check that no PayoutTriggered event was emitted
                const payoutEvents = receipt.logs.filter((log) => {
                    try {
                        const parsed = radiShield.interface.parseLog(log)
                        return parsed.name === "PayoutTriggered"
                    } catch {
                        return false
                    }
                })
                expect(payoutEvents.length).to.equal(0)
            })
        })

        describe("getWeatherData", function () {
            it("should return weather data for a policy", async function () {
                const weatherData = {
                    rainfall30d: 60, // 60mm - unscaled
                    rainfall24h: 15, // 15mm - unscaled
                    temperature: 32000, // 32°C - scaled by 1000
                    timestamp: 0,
                    isValid: true,
                }

                await weatherOracle
                    .connect(oracleBot)
                    .updateWeatherData(-10000, 360000, weatherData)

                const retrievedData = await radiShield.getWeatherData(policyId)
                expect(retrievedData.rainfall30d).to.equal(60)
                expect(retrievedData.rainfall24h).to.equal(15)
                expect(retrievedData.temperature).to.equal(32000)
                expect(retrievedData.isValid).to.be.true
                expect(retrievedData.timestamp).to.be.gt(0)
            })

            it("should revert for non-existent policy", async function () {
                await expect(radiShield.getWeatherData(999))
                    .to.be.revertedWithCustomError(radiShield, "PolicyNotFound")
                    .withArgs(999)
            })
        })
    })

    describe("Emergency Functions", function () {
        let policyId

        beforeEach(async function () {
            // Skip if farmer has no POL
            const farmerBalance = await ethers.provider.getBalance(farmer.address)
            if (farmerBalance < ethers.parseEther("0.5")) {
                console.log("⏭️ Skipping emergency tests - farmer needs POL")
                this.skip()
            }

            // Ensure contract has funding for payouts
            await ensureContractFunding("0.5")

            // Create test policy with POL
            const coverage = ethers.parseEther("1") // 1 POL (minimum allowed)
            const premium = (coverage * 700n) / 10000n // 7% premium

            await radiShield
                .connect(farmer)
                .createPolicy("maize", coverage, 30 * 24 * 60 * 60, 0, 0, { value: premium })
            policyId = 1
        })

        describe("emergencyPayout", function () {
            it("should allow owner to process emergency payout", async function () {
                const payoutAmount = ethers.parseEther("0.2") // 0.2 POL
                const reason = "Oracle failure - manual payout"

                const tx = await radiShield.emergencyPayout(policyId, payoutAmount, reason)
                await expect(tx)
                    .to.emit(radiShield, "ClaimPaid")
                    .withArgs(policyId, farmer.address, payoutAmount, reason)

                const policy = await radiShield.getPolicy(policyId)
                expect(policy.claimed).to.be.true
                expect(policy.isActive).to.be.false
            })

            it("should revert when non-owner tries emergency payout", async function () {
                await expect(
                    radiShield
                        .connect(farmer)
                        .emergencyPayout(policyId, ethers.parseEther("0.1"), "Unauthorized"),
                ).to.be.revertedWithCustomError(radiShield, "OwnableUnauthorizedAccount")
            })
        })

        describe("emergencyWithdraw", function () {
            it("should allow owner to withdraw POL", async function () {
                const withdrawAmount = ethers.parseEther("0.1") // 0.1 POL
                const initialBalance = await ethers.provider.getBalance(owner.address)

                const tx = await radiShield.emergencyWithdraw(withdrawAmount, owner.address)
                const receipt = await tx.wait()
                const gasUsed = receipt.gasUsed * receipt.gasPrice

                const finalBalance = await ethers.provider.getBalance(owner.address)
                expect(finalBalance).to.equal(initialBalance + withdrawAmount - gasUsed)
            })

            it("should revert when non-owner tries to withdraw", async function () {
                await expect(
                    radiShield
                        .connect(farmer)
                        .emergencyWithdraw(ethers.parseEther("0.1"), farmer.address),
                ).to.be.revertedWithCustomError(radiShield, "OwnableUnauthorizedAccount")
            })
        })
    })

    describe("Contract Statistics", function () {
        beforeEach(async function () {
            // Skip if farmer has no POL
            const farmerBalance = await ethers.provider.getBalance(farmer.address)
            if (farmerBalance < ethers.parseEther("0.5")) {
                console.log("⏭️ Skipping statistics tests - farmer needs POL")
                return
            }

            // Ensure contract has funding for payouts
            await ensureContractFunding("0.3")

            // Create multiple policies with POL (minimum amounts)
            const coverage1 = ethers.parseEther("1") // 1 POL (minimum)
            const coverage2 = ethers.parseEther("1") // 1 POL (minimum)
            const coverage3 = ethers.parseEther("1") // 1 POL (minimum)

            const premium1 = (coverage1 * 700n) / 10000n
            const premium2 = (coverage2 * 700n) / 10000n
            const premium3 = (coverage3 * 700n) / 10000n

            await radiShield
                .connect(farmer)
                .createPolicy("maize", coverage1, 30 * 24 * 60 * 60, -1, 36, { value: premium1 })
            await radiShield
                .connect(farmer)
                .createPolicy("coffee", coverage2, 60 * 24 * 60 * 60, -2, 37, { value: premium2 })
            await radiShield
                .connect(farmer)
                .createPolicy("wheat", coverage3, 90 * 24 * 60 * 60, -3, 38, { value: premium3 })
        })

        it("should return correct contract statistics", async function () {
            const stats = await radiShield.getContractStats()

            expect(stats.totalPolicies).to.equal(3)
            expect(stats.activePolicies).to.equal(3)
            expect(stats.claimedPolicies).to.equal(0)
            expect(stats.totalCoverage).to.equal(
                ethers.parseEther("1") + // 1 POL
                    ethers.parseEther("1") + // 1 POL
                    ethers.parseEther("1"), // 1 POL = 3 POL total
            )
            expect(stats.contractBalance).to.be.gt(0)
        })

        it("should update statistics after policy claim", async function () {
            // Create a policy first
            const coverage = ethers.parseUnits("2", 18)
            const premium = (coverage * BigInt(BASE_PREMIUM_RATE)) / BigInt(10000)

            await radiShield
                .connect(farmer)
                .createPolicy("maize", coverage, 30 * 24 * 60 * 60, -1, 36, { value: premium })

            // Check initial stats
            let stats = await radiShield.getContractStats()
            console.log(`\n📊 Initial Stats:`)
            console.log(`   Total Policies: ${stats.totalPolicies}`)
            console.log(`   Active Policies: ${stats.activePolicies}`)
            console.log(`   Contract Balance: ${ethers.formatEther(stats.contractBalance)} POL`)

            // Process emergency payout
            await radiShield.emergencyPayout(1, ethers.parseEther("0.1"), "Test claim")

            // Check updated stats
            stats = await radiShield.getContractStats()
            console.log(`\n📊 After Claim Stats:`)
            console.log(`   Total Policies: ${stats.totalPolicies}`)
            console.log(`   Active Policies: ${stats.activePolicies}`)
            console.log(`   Claimed Policies: ${stats.claimedPolicies}`)
            console.log(`   Contract Balance: ${ethers.formatEther(stats.contractBalance)} POL`)

            expect(stats.totalPolicies).to.equal(1) // One policy created
            expect(stats.activePolicies).to.equal(0) // None active after claim
            expect(stats.claimedPolicies).to.equal(1) // One claimed
        })
    })
})
