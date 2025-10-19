const { expect } = require("chai")
const { ethers } = require("hardhat")

describe("RadiShield Weather Oracle Integration", function () {
    let radiShield
    let weatherOracle
    let mockUSDC
    let owner
    let farmer
    let oracleBot

    // Test constants
    const BASE_PREMIUM_RATE = 700 // 7%
    const MIN_COVERAGE = ethers.parseUnits("100", 6) // $100 USDC
    const MAX_COVERAGE = ethers.parseUnits("10000", 6) // $10,000 USDC

    beforeEach(async function () {
        ;[owner, farmer, oracleBot] = await ethers.getSigners()

        // Deploy mock USDC token
        const MockERC20 = await ethers.getContractFactory("MockERC20")
        mockUSDC = await MockERC20.deploy("Mock USDC", "USDC", 6)
        await mockUSDC.waitForDeployment()

        // Deploy WeatherOracle contract
        const WeatherOracle = await ethers.getContractFactory("WeatherOracle")
        weatherOracle = await WeatherOracle.deploy()
        await weatherOracle.waitForDeployment()

        // Deploy RadiShield contract with WeatherOracle
        const RadiShield = await ethers.getContractFactory("RadiShield")
        radiShield = await RadiShield.deploy(
            await mockUSDC.getAddress(),
            await weatherOracle.getAddress(),
        )
        await radiShield.waitForDeployment()

        // Authorize oracle bot to update weather data
        await weatherOracle.authorizeOracle(oracleBot.address)
    })

    describe("calculatePremium", function () {
        it("should calculate correct premium for valid inputs", async function () {
            const coverage = ethers.parseUnits("1000", 6) // $1000 USDC
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
            const coverage = ethers.parseUnits("500", 6)
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
                ethers.parseUnits("100", 6), // $100
                ethers.parseUnits("500", 6), // $500
                ethers.parseUnits("1000", 6), // $1000
                ethers.parseUnits("5000", 6), // $5000
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
            const coverage = ethers.parseUnits("50", 6) // $50 - below minimum
            const latitude = 0
            const longitude = 0

            await expect(radiShield.calculatePremium(coverage, latitude, longitude))
                .to.be.revertedWithCustomError(radiShield, "InvalidCoverage")
                .withArgs(coverage)
        })

        it("should revert for coverage above maximum", async function () {
            const coverage = ethers.parseUnits("15000", 6) // $15,000 - above maximum
            const latitude = 0
            const longitude = 0

            await expect(radiShield.calculatePremium(coverage, latitude, longitude))
                .to.be.revertedWithCustomError(radiShield, "InvalidCoverage")
                .withArgs(coverage)
        })

        it("should revert for invalid latitude (too low)", async function () {
            const coverage = ethers.parseUnits("1000", 6)
            const latitude = -1000000 // Below -90 degrees scaled
            const longitude = 0

            await expect(radiShield.calculatePremium(coverage, latitude, longitude))
                .to.be.revertedWithCustomError(radiShield, "InvalidLocation")
                .withArgs(latitude, longitude)
        })

        it("should revert for invalid latitude (too high)", async function () {
            const coverage = ethers.parseUnits("1000", 6)
            const latitude = 1000000 // Above 90 degrees scaled
            const longitude = 0

            await expect(radiShield.calculatePremium(coverage, latitude, longitude))
                .to.be.revertedWithCustomError(radiShield, "InvalidLocation")
                .withArgs(latitude, longitude)
        })

        it("should accept valid boundary coordinates", async function () {
            const coverage = ethers.parseUnits("1000", 6)

            // Test valid boundary coordinates
            const validCoordinates = [
                { lat: -900000, lon: -1800000 }, // South Pole, -180 longitude
                { lat: 900000, lon: 1800000 }, // North Pole, 180 longitude
                { lat: 0, lon: 0 }, // Equator, Prime meridian
                { lat: -129210, lon: 368219 }, // Nairobi coordinates
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
        beforeEach(async function () {
            // Mint USDC to farmer for testing
            const mintAmount = ethers.parseUnits("10000", 6) // $10,000 USDC
            await mockUSDC.mint(farmer.address, mintAmount)

            // Approve RadiShield contract to spend farmer's USDC
            await mockUSDC.connect(farmer).approve(await radiShield.getAddress(), mintAmount)
        })

        it("should create policy with correct parameters", async function () {
            const cropType = "maize"
            const coverage = ethers.parseUnits("1000", 6) // $1000 USDC
            const duration = 30 * 24 * 60 * 60 // 30 days in seconds
            const latitude = -1 // -1 degree (will be scaled to -10000)
            const longitude = 36 // 36 degrees (will be scaled to 360000)

            const tx = await radiShield
                .connect(farmer)
                .createPolicy(cropType, coverage, duration, latitude, longitude)

            const policyId = 1 // First policy should have ID 1

            // Check PolicyCreated event
            await expect(tx)
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
            const expectedPremium = (coverage * BigInt(BASE_PREMIUM_RATE)) / BigInt(10000)
            expect(policy.premium).to.equal(expectedPremium)
        })

        it("should transfer premium from farmer to contract", async function () {
            const cropType = "maize"
            const coverage = ethers.parseUnits("1000", 6)
            const duration = 30 * 24 * 60 * 60
            const latitude = 0
            const longitude = 0

            const expectedPremium = (coverage * BigInt(BASE_PREMIUM_RATE)) / BigInt(10000)
            const initialFarmerBalance = await mockUSDC.balanceOf(farmer.address)
            const initialContractBalance = await mockUSDC.balanceOf(await radiShield.getAddress())

            await radiShield
                .connect(farmer)
                .createPolicy(cropType, coverage, duration, latitude, longitude)

            const finalFarmerBalance = await mockUSDC.balanceOf(farmer.address)
            const finalContractBalance = await mockUSDC.balanceOf(await radiShield.getAddress())

            expect(finalFarmerBalance).to.equal(initialFarmerBalance - expectedPremium)
            expect(finalContractBalance).to.equal(initialContractBalance + expectedPremium)
        })
    })

    describe("Weather Oracle Integration", function () {
        let policyId

        beforeEach(async function () {
            // Mint USDC to farmer and contract for testing
            const usdcAmount = ethers.parseUnits("10000", 6) // $10,000 USDC
            await mockUSDC.mint(farmer.address, usdcAmount)
            await mockUSDC.mint(await radiShield.getAddress(), usdcAmount)

            // Approve RadiShield contract to spend farmer's USDC
            await mockUSDC.connect(farmer).approve(await radiShield.getAddress(), usdcAmount)

            // Create a test policy
            await radiShield
                .connect(farmer)
                .createPolicy("maize", ethers.parseUnits("1000", 6), 30 * 24 * 60 * 60, -1, 36)
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
                    rainfall30d: 80,
                    rainfall24h: 20,
                    temperature: 2500, // 25°C * 100
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
                await radiShield.emergencyPayout(policyId, ethers.parseUnits("500", 6), "Test")

                await expect(radiShield.requestWeatherData(policyId))
                    .to.be.revertedWithCustomError(radiShield, "PolicyAlreadyClaimed")
                    .withArgs(policyId)
            })
        })

        describe("processWeatherData", function () {
            beforeEach(async function () {
                // Add weather data to oracle
                const weatherData = {
                    rainfall30d: 25, // Below drought threshold (50mm)
                    rainfall24h: 10,
                    temperature: 3000, // 30°C * 100
                    timestamp: 0,
                    isValid: true,
                }

                await weatherOracle
                    .connect(oracleBot)
                    .updateWeatherData(-10000, 360000, weatherData)
            })

            it("should process weather data and trigger drought payout", async function () {
                const expectedPayout = ethers.parseUnits("1000", 6) // Full coverage for drought

                await expect(radiShield.processWeatherData(policyId))
                    .to.emit(radiShield, "WeatherDataReceived")
                    .withArgs(policyId, 25, 10, 3000)
                    .and.to.emit(radiShield, "PayoutTriggered")
                    .withArgs(policyId, "drought", expectedPayout)
                    .and.to.emit(radiShield, "ClaimPaid")
                    .withArgs(policyId, farmer.address, expectedPayout, "Weather trigger")
            })

            it("should revert for invalid weather data", async function () {
                // Create policy at different location where no weather data exists
                await radiShield
                    .connect(farmer)
                    .createPolicy("coffee", ethers.parseUnits("1000", 6), 30 * 24 * 60 * 60, -2, 72)

                // Try to process weather data for location with no data
                await expect(radiShield.processWeatherData(2)).to.be.revertedWithCustomError(
                    weatherOracle,
                    "DataNotFound",
                )
            })
        })

        describe("Weather trigger thresholds", function () {
            it("should trigger drought payout for rainfall < 50mm in 30 days", async function () {
                const droughtWeatherData = {
                    rainfall30d: 25, // Below 50mm threshold
                    rainfall24h: 10,
                    temperature: 2500,
                    timestamp: 0,
                    isValid: true,
                }

                await weatherOracle
                    .connect(oracleBot)
                    .updateWeatherData(-10000, 360000, droughtWeatherData)

                await expect(radiShield.processWeatherData(policyId))
                    .to.emit(radiShield, "PayoutTriggered")
                    .withArgs(policyId, "drought", ethers.parseUnits("1000", 6))
            })

            it("should trigger flood payout for rainfall > 100mm in 24 hours", async function () {
                const floodWeatherData = {
                    rainfall30d: 150,
                    rainfall24h: 120, // Above 100mm threshold
                    temperature: 2500,
                    timestamp: 0,
                    isValid: true,
                }

                await weatherOracle
                    .connect(oracleBot)
                    .updateWeatherData(-10000, 360000, floodWeatherData)

                await expect(radiShield.processWeatherData(policyId))
                    .to.emit(radiShield, "PayoutTriggered")
                    .withArgs(policyId, "flood", ethers.parseUnits("1000", 6))
            })

            it("should trigger heatwave payout for temperature > 38°C", async function () {
                const heatwaveWeatherData = {
                    rainfall30d: 80,
                    rainfall24h: 20,
                    temperature: 4000, // 40°C * 100, above 38°C threshold
                    timestamp: 0,
                    isValid: true,
                }

                await weatherOracle
                    .connect(oracleBot)
                    .updateWeatherData(-10000, 360000, heatwaveWeatherData)

                const expectedPayout = (ethers.parseUnits("1000", 6) * BigInt(75)) / BigInt(100) // 75% payout

                await expect(radiShield.processWeatherData(policyId))
                    .to.emit(radiShield, "PayoutTriggered")
                    .withArgs(policyId, "heatwave", expectedPayout)
            })

            it("should not trigger payout for normal weather conditions", async function () {
                const normalWeatherData = {
                    rainfall30d: 80, // Above drought threshold
                    rainfall24h: 20, // Below flood threshold
                    temperature: 3000, // 30°C, below heatwave threshold
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
                    rainfall30d: 60,
                    rainfall24h: 15,
                    temperature: 3200,
                    timestamp: 0,
                    isValid: true,
                }

                await weatherOracle
                    .connect(oracleBot)
                    .updateWeatherData(-10000, 360000, weatherData)

                const retrievedData = await radiShield.getWeatherData(policyId)
                expect(retrievedData.rainfall30d).to.equal(60)
                expect(retrievedData.rainfall24h).to.equal(15)
                expect(retrievedData.temperature).to.equal(3200)
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
            // Mint USDC to farmer and contract
            const usdcAmount = ethers.parseUnits("10000", 6)
            await mockUSDC.mint(farmer.address, usdcAmount)
            await mockUSDC.mint(await radiShield.getAddress(), usdcAmount)
            await mockUSDC.connect(farmer).approve(await radiShield.getAddress(), usdcAmount)

            // Create test policy
            await radiShield
                .connect(farmer)
                .createPolicy("maize", ethers.parseUnits("1000", 6), 30 * 24 * 60 * 60, 0, 0)
            policyId = 1
        })

        describe("emergencyPayout", function () {
            it("should allow owner to process emergency payout", async function () {
                const payoutAmount = ethers.parseUnits("500", 6)
                const reason = "Oracle failure - manual payout"

                await expect(radiShield.emergencyPayout(policyId, payoutAmount, reason))
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
                        .emergencyPayout(policyId, ethers.parseUnits("500", 6), "Unauthorized"),
                ).to.be.revertedWithCustomError(radiShield, "OwnableUnauthorizedAccount")
            })
        })

        describe("emergencyWithdraw", function () {
            it("should allow owner to withdraw USDC", async function () {
                const withdrawAmount = ethers.parseUnits("1000", 6)
                const initialBalance = await mockUSDC.balanceOf(owner.address)

                await radiShield.emergencyWithdraw(withdrawAmount, owner.address)

                const finalBalance = await mockUSDC.balanceOf(owner.address)
                expect(finalBalance).to.equal(initialBalance + withdrawAmount)
            })

            it("should revert when non-owner tries to withdraw", async function () {
                await expect(
                    radiShield
                        .connect(farmer)
                        .emergencyWithdraw(ethers.parseUnits("1000", 6), farmer.address),
                ).to.be.revertedWithCustomError(radiShield, "OwnableUnauthorizedAccount")
            })
        })
    })

    describe("Contract Statistics", function () {
        beforeEach(async function () {
            // Setup multiple policies for testing
            const usdcAmount = ethers.parseUnits("20000", 6)
            await mockUSDC.mint(farmer.address, usdcAmount)
            await mockUSDC.mint(await radiShield.getAddress(), usdcAmount)
            await mockUSDC.connect(farmer).approve(await radiShield.getAddress(), usdcAmount)

            // Create multiple policies
            await radiShield
                .connect(farmer)
                .createPolicy("maize", ethers.parseUnits("1000", 6), 30 * 24 * 60 * 60, -1, 36)
            await radiShield
                .connect(farmer)
                .createPolicy("coffee", ethers.parseUnits("2000", 6), 60 * 24 * 60 * 60, -2, 37)
            await radiShield
                .connect(farmer)
                .createPolicy("wheat", ethers.parseUnits("1500", 6), 90 * 24 * 60 * 60, -3, 38)
        })

        it("should return correct contract statistics", async function () {
            const stats = await radiShield.getContractStats()

            expect(stats.totalPolicies).to.equal(3)
            expect(stats.activePolicies).to.equal(3)
            expect(stats.claimedPolicies).to.equal(0)
            expect(stats.totalCoverage).to.equal(
                ethers.parseUnits("1000", 6) +
                    ethers.parseUnits("2000", 6) +
                    ethers.parseUnits("1500", 6),
            )
            expect(stats.contractBalance).to.be.gt(0)
        })

        it("should update statistics after policy claim", async function () {
            await radiShield.emergencyPayout(1, ethers.parseUnits("500", 6), "Test claim")

            const stats = await radiShield.getContractStats()
            expect(stats.totalPolicies).to.equal(3) // Total doesn't change
            expect(stats.activePolicies).to.equal(2) // One less active
            expect(stats.claimedPolicies).to.equal(1) // One claimed
        })
    })
})
