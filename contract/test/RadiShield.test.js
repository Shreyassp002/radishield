const { expect } = require("chai")
const { ethers } = require("hardhat")

describe("RadiShield Premium Calculation", function () {
    let radiShield
    let mockUSDC
    let mockLINK
    let owner
    let farmer

    // Test constants
    const MOCK_ORACLE_ADDRESS = "0x1234567890123456789012345678901234567890"
    const MOCK_JOB_ID = "0x1234567890123456789012345678901234567890123456789012345678901234"
    const BASE_PREMIUM_RATE = 700 // 7%
    const MIN_COVERAGE = ethers.parseUnits("100", 6) // $100 USDC
    const MAX_COVERAGE = ethers.parseUnits("10000", 6) // $10,000 USDC

    beforeEach(async function () {
        ;[owner, farmer] = await ethers.getSigners()

        // Deploy mock USDC token
        const MockERC20 = await ethers.getContractFactory("MockERC20")
        mockUSDC = await MockERC20.deploy("Mock USDC", "USDC", 6)
        await mockUSDC.waitForDeployment()

        // Deploy mock LINK token
        mockLINK = await MockERC20.deploy("Mock LINK", "LINK", 18)
        await mockLINK.waitForDeployment()

        // Deploy RadiShield contract
        const RadiShield = await ethers.getContractFactory("RadiShield")
        radiShield = await RadiShield.deploy(
            await mockUSDC.getAddress(),
            await mockLINK.getAddress(),
            MOCK_ORACLE_ADDRESS,
            MOCK_JOB_ID,
        )
        await radiShield.waitForDeployment()
    })

    describe("calculatePremium", function () {
        it("should calculate correct premium for valid inputs", async function () {
            const coverage = ethers.parseUnits("1000", 6) // $1000 USDC
            const latitude = -129210 // Nairobi latitude scaled by 10000
            const longitude = 368219 // Nairobi longitude scaled by 10000

            const expectedPremium = (coverage * BigInt(BASE_PREMIUM_RATE)) / BigInt(10000)

            // Since the function is now state-changing, we need to use staticCall to get the return value
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

        it("should revert for invalid longitude (too low)", async function () {
            const coverage = ethers.parseUnits("1000", 6)
            const latitude = 0
            const longitude = -2000000 // Below -180 degrees scaled

            await expect(radiShield.calculatePremium(coverage, latitude, longitude))
                .to.be.revertedWithCustomError(radiShield, "InvalidLocation")
                .withArgs(latitude, longitude)
        })

        it("should revert for invalid longitude (too high)", async function () {
            const coverage = ethers.parseUnits("1000", 6)
            const latitude = 0
            const longitude = 2000000 // Above 180 degrees scaled

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

            const receipt = await tx.wait()
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

        it("should handle GPS coordinate scaling correctly", async function () {
            const cropType = "coffee"
            const coverage = ethers.parseUnits("500", 6)
            const duration = 60 * 24 * 60 * 60 // 60 days
            const latitude = -1 // Simple latitude that won't exceed bounds after scaling
            const longitude = 36 // Simple longitude that won't exceed bounds after scaling

            await radiShield
                .connect(farmer)
                .createPolicy(cropType, coverage, duration, latitude, longitude)

            const policy = await radiShield.getPolicy(1)
            // Should be scaled by 10000 in the contract
            expect(policy.latitude).to.equal(latitude * 10000)
            expect(policy.longitude).to.equal(longitude * 10000)
        })

        it("should increment policy IDs correctly", async function () {
            const cropType = "wheat"
            const coverage = ethers.parseUnits("1000", 6)
            const duration = 90 * 24 * 60 * 60 // 90 days
            const latitude = 40
            const longitude = -74

            // Create first policy
            await radiShield
                .connect(farmer)
                .createPolicy(cropType, coverage, duration, latitude, longitude)

            // Create second policy
            await radiShield
                .connect(farmer)
                .createPolicy(cropType, coverage, duration, latitude, longitude)

            // Check policy IDs
            const policy1 = await radiShield.getPolicy(1)
            const policy2 = await radiShield.getPolicy(2)

            expect(policy1.id).to.equal(1)
            expect(policy2.id).to.equal(2)
        })

        it("should add policy to farmer's policy list", async function () {
            const cropType = "rice"
            const coverage = ethers.parseUnits("2000", 6)
            const duration = 120 * 24 * 60 * 60 // 120 days
            const latitude = 14
            const longitude = 121

            await radiShield
                .connect(farmer)
                .createPolicy(cropType, coverage, duration, latitude, longitude)

            const farmerPolicies = await radiShield.getPoliciesByFarmer(farmer.address)
            expect(farmerPolicies.length).to.equal(1)
            expect(farmerPolicies[0]).to.equal(1)
        })

        it("should revert for invalid coverage (too low)", async function () {
            const cropType = "maize"
            const coverage = ethers.parseUnits("50", 6) // Below minimum
            const duration = 30 * 24 * 60 * 60
            const latitude = 0
            const longitude = 0

            await expect(
                radiShield
                    .connect(farmer)
                    .createPolicy(cropType, coverage, duration, latitude, longitude),
            )
                .to.be.revertedWithCustomError(radiShield, "InvalidCoverage")
                .withArgs(coverage)
        })

        it("should revert for invalid coverage (too high)", async function () {
            const cropType = "maize"
            const coverage = ethers.parseUnits("15000", 6) // Above maximum
            const duration = 30 * 24 * 60 * 60
            const latitude = 0
            const longitude = 0

            await expect(
                radiShield
                    .connect(farmer)
                    .createPolicy(cropType, coverage, duration, latitude, longitude),
            )
                .to.be.revertedWithCustomError(radiShield, "InvalidCoverage")
                .withArgs(coverage)
        })

        it("should revert for invalid duration (too short)", async function () {
            const cropType = "maize"
            const coverage = ethers.parseUnits("1000", 6)
            const duration = 15 * 24 * 60 * 60 // 15 days - below minimum
            const latitude = 0
            const longitude = 0

            await expect(
                radiShield
                    .connect(farmer)
                    .createPolicy(cropType, coverage, duration, latitude, longitude),
            )
                .to.be.revertedWithCustomError(radiShield, "InvalidDuration")
                .withArgs(duration)
        })

        it("should revert for invalid duration (too long)", async function () {
            const cropType = "maize"
            const coverage = ethers.parseUnits("1000", 6)
            const duration = 400 * 24 * 60 * 60 // 400 days - above maximum
            const latitude = 0
            const longitude = 0

            await expect(
                radiShield
                    .connect(farmer)
                    .createPolicy(cropType, coverage, duration, latitude, longitude),
            )
                .to.be.revertedWithCustomError(radiShield, "InvalidDuration")
                .withArgs(duration)
        })

        it("should revert for invalid GPS coordinates", async function () {
            const cropType = "maize"
            const coverage = ethers.parseUnits("1000", 6)
            const duration = 30 * 24 * 60 * 60
            const invalidLatitude = 100 // Above 90 degrees
            const validLongitude = 0

            await expect(
                radiShield
                    .connect(farmer)
                    .createPolicy(cropType, coverage, duration, invalidLatitude, validLongitude),
            ).to.be.revertedWithCustomError(radiShield, "InvalidLocation")
        })

        it("should revert when farmer has insufficient USDC balance", async function () {
            // Create a new farmer with no USDC
            const [, , poorFarmer] = await ethers.getSigners()

            const cropType = "maize"
            const coverage = ethers.parseUnits("1000", 6)
            const duration = 30 * 24 * 60 * 60
            const latitude = 0
            const longitude = 0

            await expect(
                radiShield
                    .connect(poorFarmer)
                    .createPolicy(cropType, coverage, duration, latitude, longitude),
            ).to.be.reverted // ERC20 will revert with insufficient balance
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

    describe("USDC Token Integration", function () {
        beforeEach(async function () {
            // Mint USDC to farmer and contract for testing
            const mintAmount = ethers.parseUnits("10000", 6) // $10,000 USDC
            await mockUSDC.mint(farmer.address, mintAmount)
            await mockUSDC.mint(await radiShield.getAddress(), mintAmount) // Fund contract for payouts

            // Approve RadiShield contract to spend farmer's USDC
            await mockUSDC.connect(farmer).approve(await radiShield.getAddress(), mintAmount)
        })

        describe("Premium Payment Processing", function () {
            it("should transfer premium from farmer to contract correctly", async function () {
                const coverage = ethers.parseUnits("1000", 6)
                const expectedPremium = (coverage * BigInt(700)) / BigInt(10000) // 7%

                const initialFarmerBalance = await mockUSDC.balanceOf(farmer.address)
                const initialContractBalance = await mockUSDC.balanceOf(
                    await radiShield.getAddress(),
                )

                await radiShield
                    .connect(farmer)
                    .createPolicy("maize", coverage, 30 * 24 * 60 * 60, 0, 0)

                const finalFarmerBalance = await mockUSDC.balanceOf(farmer.address)
                const finalContractBalance = await mockUSDC.balanceOf(await radiShield.getAddress())

                expect(finalFarmerBalance).to.equal(initialFarmerBalance - expectedPremium)
                expect(finalContractBalance).to.equal(initialContractBalance + expectedPremium)
            })

            it("should revert when farmer has insufficient USDC allowance", async function () {
                // Reset allowance to 0
                await mockUSDC.connect(farmer).approve(await radiShield.getAddress(), 0)

                await expect(
                    radiShield
                        .connect(farmer)
                        .createPolicy(
                            "maize",
                            ethers.parseUnits("1000", 6),
                            30 * 24 * 60 * 60,
                            0,
                            0,
                        ),
                ).to.be.reverted // ERC20 will revert with insufficient allowance
            })
        })

        describe("Payout Transfer Functionality", function () {
            let policyId

            beforeEach(async function () {
                // Create a policy first
                const tx = await radiShield
                    .connect(farmer)
                    .createPolicy("maize", ethers.parseUnits("1000", 6), 30 * 24 * 60 * 60, 0, 0)
                policyId = 1 // First policy ID
            })

            it("should process payout correctly with _processPayout", async function () {
                const payoutAmount = ethers.parseUnits("500", 6) // $500 payout

                const initialFarmerBalance = await mockUSDC.balanceOf(farmer.address)
                const initialContractBalance = await mockUSDC.balanceOf(
                    await radiShield.getAddress(),
                )

                // Call _processPayout through emergencyPayout (since _processPayout is internal)
                await expect(radiShield.emergencyPayout(policyId, payoutAmount, "Test payout"))
                    .to.emit(radiShield, "ClaimPaid")
                    .withArgs(policyId, farmer.address, payoutAmount, "Test payout")

                const finalFarmerBalance = await mockUSDC.balanceOf(farmer.address)
                const finalContractBalance = await mockUSDC.balanceOf(await radiShield.getAddress())

                expect(finalFarmerBalance).to.equal(initialFarmerBalance + payoutAmount)
                expect(finalContractBalance).to.equal(initialContractBalance - payoutAmount)

                // Check policy status updated
                const policy = await radiShield.getPolicy(policyId)
                expect(policy.claimed).to.be.true
                expect(policy.isActive).to.be.false
            })

            it("should revert payout for non-existent policy", async function () {
                const nonExistentPolicyId = 999
                const payoutAmount = ethers.parseUnits("500", 6)

                await expect(radiShield.emergencyPayout(nonExistentPolicyId, payoutAmount, "Test"))
                    .to.be.revertedWithCustomError(radiShield, "PolicyNotFound")
                    .withArgs(nonExistentPolicyId)
            })

            it("should revert payout for already claimed policy", async function () {
                const payoutAmount = ethers.parseUnits("500", 6)

                // Process first payout
                await radiShield.emergencyPayout(policyId, payoutAmount, "First payout")

                // Try to process second payout on same policy
                await expect(radiShield.emergencyPayout(policyId, payoutAmount, "Second payout"))
                    .to.be.revertedWithCustomError(radiShield, "PolicyAlreadyClaimed")
                    .withArgs(policyId)
            })

            it("should revert payout when contract has insufficient balance", async function () {
                // Create a new contract with minimal balance for this test
                const RadiShield = await ethers.getContractFactory("RadiShield")
                const testRadiShield = await RadiShield.deploy(
                    await mockUSDC.getAddress(),
                    await mockLINK.getAddress(),
                    MOCK_ORACLE_ADDRESS,
                    MOCK_JOB_ID,
                )
                await testRadiShield.waitForDeployment()

                // Give farmer some USDC and approve the new contract
                await mockUSDC
                    .connect(farmer)
                    .approve(await testRadiShield.getAddress(), ethers.parseUnits("1000", 6))

                // Create policy in new contract (this will add premium to contract balance)
                await testRadiShield
                    .connect(farmer)
                    .createPolicy("maize", ethers.parseUnits("1000", 6), 30 * 24 * 60 * 60, 0, 0)

                // Try to payout more than the contract balance (premium is only 7% = $70)
                const excessiveAmount = ethers.parseUnits("500", 6) // Much more than the $70 premium

                await expect(
                    testRadiShield.emergencyPayout(1, excessiveAmount, "Test"),
                ).to.be.revertedWithCustomError(testRadiShield, "InsufficientContractBalance")
            })
        })

        describe("Balance Checking and Validation", function () {
            it("should return correct contract USDC balance", async function () {
                const expectedBalance = await mockUSDC.balanceOf(await radiShield.getAddress())
                const contractBalance = await radiShield.getContractBalance()
                expect(contractBalance).to.equal(expectedBalance)
            })

            it("should validate balance before processing transfers", async function () {
                // Create policy to get some premium in contract
                await radiShield
                    .connect(farmer)
                    .createPolicy("maize", ethers.parseUnits("1000", 6), 30 * 24 * 60 * 60, 0, 0)

                const contractBalance = await radiShield.getContractBalance()
                expect(contractBalance).to.be.gt(0)

                // Try to payout more than contract balance
                const excessiveAmount = contractBalance + ethers.parseUnits("1000", 6)

                await expect(
                    radiShield.emergencyPayout(1, excessiveAmount, "Excessive payout"),
                ).to.be.revertedWithCustomError(radiShield, "InsufficientContractBalance")
            })
        })

        describe("Emergency Payout Function", function () {
            let policyId

            beforeEach(async function () {
                const tx = await radiShield.connect(farmer).createPolicy(
                    "coffee",
                    ethers.parseUnits("2000", 6),
                    60 * 24 * 60 * 60,
                    -1, // Simple coordinates that won't exceed bounds
                    36,
                )
                policyId = 1
            })

            it("should allow owner to process emergency payout", async function () {
                const payoutAmount = ethers.parseUnits("1500", 6)
                const reason = "Oracle failure - manual payout"

                await expect(radiShield.emergencyPayout(policyId, payoutAmount, reason))
                    .to.emit(radiShield, "ClaimPaid")
                    .withArgs(policyId, farmer.address, payoutAmount, reason)
            })

            it("should revert when non-owner tries emergency payout", async function () {
                const payoutAmount = ethers.parseUnits("1000", 6)

                await expect(
                    radiShield
                        .connect(farmer)
                        .emergencyPayout(policyId, payoutAmount, "Unauthorized"),
                ).to.be.revertedWithCustomError(radiShield, "OwnableUnauthorizedAccount")
            })

            it("should update policy status after emergency payout", async function () {
                const payoutAmount = ethers.parseUnits("1000", 6)

                await radiShield.emergencyPayout(policyId, payoutAmount, "Emergency")

                const policy = await radiShield.getPolicy(policyId)
                expect(policy.claimed).to.be.true
                expect(policy.isActive).to.be.false
            })
        })
    })

    describe("Chainlink Oracle Integration", function () {
        beforeEach(async function () {
            // Mint USDC and LINK to farmer and contract for testing
            const usdcAmount = ethers.parseUnits("10000", 6) // $10,000 USDC
            const linkAmount = ethers.parseUnits("100", 18) // 100 LINK

            await mockUSDC.mint(farmer.address, usdcAmount)
            await mockUSDC.mint(await radiShield.getAddress(), usdcAmount)
            await mockLINK.mint(await radiShield.getAddress(), linkAmount)

            // Approve RadiShield contract to spend farmer's USDC
            await mockUSDC.connect(farmer).approve(await radiShield.getAddress(), usdcAmount)

            // Create a test policy
            await radiShield
                .connect(farmer)
                .createPolicy("maize", ethers.parseUnits("1000", 6), 30 * 24 * 60 * 60, -1, 36)
        })

        describe("requestWeatherData", function () {
            it("should emit WeatherDataRequested event with correct parameters", async function () {
                const policyId = 1

                // Mock the Chainlink request - we expect it to emit the event
                const tx = await radiShield.requestWeatherData(policyId)
                const receipt = await tx.wait()

                // Find the WeatherDataRequested event
                const event = receipt.logs.find((log) => {
                    try {
                        const parsed = radiShield.interface.parseLog(log)
                        return parsed.name === "WeatherDataRequested"
                    } catch {
                        return false
                    }
                })

                expect(event).to.not.be.undefined
                const parsedEvent = radiShield.interface.parseLog(event)
                expect(parsedEvent.args[0]).to.equal(policyId) // policyId
                expect(parsedEvent.args[1]).to.not.equal(ethers.ZeroHash) // requestId should not be zero
            })

            it("should revert for non-existent policy", async function () {
                const nonExistentPolicyId = 999

                await expect(radiShield.requestWeatherData(nonExistentPolicyId))
                    .to.be.revertedWithCustomError(radiShield, "PolicyNotFound")
                    .withArgs(nonExistentPolicyId)
            })

            it("should revert for inactive policy", async function () {
                const policyId = 1

                // First claim the policy to make it inactive
                await radiShield.emergencyPayout(policyId, ethers.parseUnits("500", 6), "Test")

                await expect(radiShield.requestWeatherData(policyId))
                    .to.be.revertedWithCustomError(radiShield, "PolicyNotActive")
                    .withArgs(policyId)
            })

            it("should revert when contract has insufficient LINK balance", async function () {
                // Deploy a new contract with no LINK balance
                const RadiShield = await ethers.getContractFactory("RadiShield")
                const testRadiShield = await RadiShield.deploy(
                    await mockUSDC.getAddress(),
                    await mockLINK.getAddress(),
                    MOCK_ORACLE_ADDRESS,
                    MOCK_JOB_ID,
                )
                await testRadiShield.waitForDeployment()

                // Give farmer USDC and create policy
                await mockUSDC
                    .connect(farmer)
                    .approve(await testRadiShield.getAddress(), ethers.parseUnits("1000", 6))
                await testRadiShield
                    .connect(farmer)
                    .createPolicy("maize", ethers.parseUnits("1000", 6), 30 * 24 * 60 * 60, 0, 0)

                const oracleFee = ethers.parseUnits("0.1", 18) // 0.1 LINK
                await expect(testRadiShield.requestWeatherData(1))
                    .to.be.revertedWithCustomError(testRadiShield, "InsufficientContractBalance")
                    .withArgs(oracleFee, 0)
            })

            it("should check LINK balance before making request", async function () {
                const policyId = 1
                const expectedLinkBalance = await mockLINK.balanceOf(await radiShield.getAddress())
                const linkBalance = await radiShield.getLinkBalance()

                expect(linkBalance).to.equal(expectedLinkBalance)
                expect(linkBalance).to.be.gte(ethers.parseUnits("0.1", 18)) // Should have enough for oracle fee
            })
        })

        describe("fulfillWeatherData", function () {
            let requestId
            let policyId

            beforeEach(async function () {
                policyId = 1
                // First make a weather data request to get a valid requestId
                const tx = await radiShield.requestWeatherData(policyId)
                const receipt = await tx.wait()

                // Extract requestId from the WeatherDataRequested event
                const event = receipt.logs.find((log) => {
                    try {
                        const parsed = radiShield.interface.parseLog(log)
                        return parsed.name === "WeatherDataRequested"
                    } catch {
                        return false
                    }
                })
                const parsedEvent = radiShield.interface.parseLog(event)
                requestId = parsedEvent.args[1] // requestId is the second argument
            })

            it("should emit WeatherDataReceived event with correct data", async function () {
                const rainfall30d = 25 // mm - below drought threshold
                const rainfall24h = 10 // mm
                const temperature = 30 // Celsius

                await expect(
                    radiShield.testFulfillWeatherData(
                        requestId,
                        rainfall30d,
                        rainfall24h,
                        temperature,
                    ),
                )
                    .to.emit(radiShield, "WeatherDataReceived")
                    .withArgs(policyId, rainfall30d, rainfall24h, temperature)
            })

            it("should trigger drought payout for low rainfall", async function () {
                const rainfall30d = 25 // mm - below 50mm drought threshold
                const rainfall24h = 10 // mm
                const temperature = 30 // Celsius
                const expectedPayout = ethers.parseUnits("1000", 6) // Full coverage

                await expect(
                    radiShield.testFulfillWeatherData(
                        requestId,
                        rainfall30d,
                        rainfall24h,
                        temperature,
                    ),
                )
                    .to.emit(radiShield, "PayoutTriggered")
                    .withArgs(policyId, "drought", expectedPayout)
            })

            it("should trigger flood payout for high rainfall", async function () {
                const rainfall30d = 80 // mm
                const rainfall24h = 150 // mm - above 100mm flood threshold
                const temperature = 25 // Celsius
                const expectedPayout = ethers.parseUnits("1000", 6) // Full coverage

                await expect(
                    radiShield.testFulfillWeatherData(
                        requestId,
                        rainfall30d,
                        rainfall24h,
                        temperature,
                    ),
                )
                    .to.emit(radiShield, "PayoutTriggered")
                    .withArgs(policyId, "flood", expectedPayout)
            })

            it("should trigger heatwave payout for high temperature", async function () {
                const rainfall30d = 80 // mm
                const rainfall24h = 20 // mm
                const temperature = 40 // Celsius - above 38°C heatwave threshold
                const coverage = ethers.parseUnits("1000", 6)
                const expectedPayout = (coverage * BigInt(75)) / BigInt(100) // 75% payout

                await expect(
                    radiShield.testFulfillWeatherData(
                        requestId,
                        rainfall30d,
                        rainfall24h,
                        temperature,
                    ),
                )
                    .to.emit(radiShield, "PayoutTriggered")
                    .withArgs(policyId, "heatwave", expectedPayout)
            })

            it("should not trigger payout for normal weather conditions", async function () {
                const rainfall30d = 80 // mm - above drought threshold
                const rainfall24h = 20 // mm - below flood threshold
                const temperature = 30 // Celsius - below heatwave threshold

                const tx = await radiShield.testFulfillWeatherData(
                    requestId,
                    rainfall30d,
                    rainfall24h,
                    temperature,
                )
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

            it("should store weather data correctly", async function () {
                const rainfall30d = 60
                const rainfall24h = 15
                const temperature = 32

                await radiShield.testFulfillWeatherData(
                    requestId,
                    rainfall30d,
                    rainfall24h,
                    temperature,
                )

                const weatherData = await radiShield.getWeatherData(policyId)
                expect(weatherData.rainfall30d).to.equal(rainfall30d)
                expect(weatherData.rainfall24h).to.equal(rainfall24h)
                expect(weatherData.temperature).to.equal(temperature)
                expect(weatherData.isValid).to.be.true
                expect(weatherData.timestamp).to.be.gt(0)
            })
        })

        describe("Weather trigger thresholds", function () {
            it("should have correct drought threshold (50mm)", async function () {
                const droughtThreshold = await radiShield.DROUGHT_THRESHOLD()
                expect(droughtThreshold).to.equal(50)
            })

            it("should have correct flood threshold (100mm)", async function () {
                const floodThreshold = await radiShield.FLOOD_THRESHOLD()
                expect(floodThreshold).to.equal(100)
            })

            it("should have correct heatwave threshold (38°C)", async function () {
                const heatwaveThreshold = await radiShield.HEATWAVE_THRESHOLD()
                expect(heatwaveThreshold).to.equal(38)
            })

            it("should have correct heatwave payout rate (75%)", async function () {
                const heatwavePayoutRate = await radiShield.HEATWAVE_PAYOUT_RATE()
                expect(heatwavePayoutRate).to.equal(75)
            })

            it("should have correct oracle fee (0.1 LINK)", async function () {
                const oracleFee = await radiShield.ORACLE_FEE()
                expect(oracleFee).to.equal(ethers.parseUnits("0.1", 18))
            })
        })

        describe("LINK token integration", function () {
            it("should return correct LINK balance", async function () {
                const expectedBalance = await mockLINK.balanceOf(await radiShield.getAddress())
                const contractLinkBalance = await radiShield.getLinkBalance()
                expect(contractLinkBalance).to.equal(expectedBalance)
            })

            it("should have sufficient LINK for oracle requests", async function () {
                const linkBalance = await radiShield.getLinkBalance()
                const oracleFee = await radiShield.ORACLE_FEE()
                expect(linkBalance).to.be.gte(oracleFee)
            })
        })

        describe("Integer to string conversion", function () {
            it("should handle coordinate conversion correctly", async function () {
                // Test the coordinate scaling and conversion by creating a policy
                // and checking that the coordinates are stored correctly
                const latitude = -1 // Will be scaled to -10000
                const longitude = 36 // Will be scaled to 360000

                await radiShield
                    .connect(farmer)
                    .createPolicy(
                        "coffee",
                        ethers.parseUnits("500", 6),
                        60 * 24 * 60 * 60,
                        latitude,
                        longitude,
                    )

                const policy = await radiShield.getPolicy(2) // Second policy
                expect(policy.latitude).to.equal(latitude * 10000)
                expect(policy.longitude).to.equal(longitude * 10000)
            })
        })
    })
})
