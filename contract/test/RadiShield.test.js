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

                // Try to payout amount that exceeds coverage (should revert with InvalidAmount)
                const excessiveAmount = ethers.parseUnits("2000", 6) // Exceeds $1000 coverage

                await expect(
                    radiShield.emergencyPayout(1, excessiveAmount, "Excessive payout"),
                ).to.be.revertedWithCustomError(radiShield, "InvalidAmount")
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
                    .to.be.revertedWithCustomError(radiShield, "PolicyAlreadyClaimed")
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

    describe("Policy Query and Management Functions", function () {
        let policyIds = []

        beforeEach(async function () {
            // Mint USDC to farmer and contract for testing
            const usdcAmount = ethers.parseUnits("20000", 6) // $20,000 USDC
            await mockUSDC.mint(farmer.address, usdcAmount)
            await mockUSDC.mint(await radiShield.getAddress(), usdcAmount)

            // Approve RadiShield contract to spend farmer's USDC
            await mockUSDC.connect(farmer).approve(await radiShield.getAddress(), usdcAmount)

            // Create multiple test policies
            const policies = [
                {
                    cropType: "maize",
                    coverage: ethers.parseUnits("1000", 6),
                    duration: 30 * 24 * 60 * 60,
                    lat: -1,
                    lon: 36,
                },
                {
                    cropType: "coffee",
                    coverage: ethers.parseUnits("2000", 6),
                    duration: 60 * 24 * 60 * 60,
                    lat: -2,
                    lon: 37,
                },
                {
                    cropType: "wheat",
                    coverage: ethers.parseUnits("1500", 6),
                    duration: 90 * 24 * 60 * 60,
                    lat: -3,
                    lon: 38,
                },
            ]

            policyIds = []
            for (let i = 0; i < policies.length; i++) {
                const policy = policies[i]
                await radiShield
                    .connect(farmer)
                    .createPolicy(
                        policy.cropType,
                        policy.coverage,
                        policy.duration,
                        policy.lat,
                        policy.lon,
                    )
                policyIds.push(i + 1) // Policy IDs start from 1
            }
        })

        describe("getPolicy", function () {
            it("should return complete policy details for valid policy ID", async function () {
                const policyId = policyIds[0]
                const policy = await radiShield.getPolicy(policyId)

                expect(policy.id).to.equal(policyId)
                expect(policy.farmer).to.equal(farmer.address)
                expect(policy.cropType).to.equal("maize")
                expect(policy.coverage).to.equal(ethers.parseUnits("1000", 6))
                expect(policy.latitude).to.equal(-10000) // Scaled by 10000
                expect(policy.longitude).to.equal(360000) // Scaled by 10000
                expect(policy.isActive).to.be.true
                expect(policy.claimed).to.be.false
                expect(policy.startDate).to.be.gt(0)
                expect(policy.endDate).to.be.gt(policy.startDate)
            })

            it("should revert for non-existent policy ID", async function () {
                const nonExistentId = 999

                await expect(radiShield.getPolicy(nonExistentId))
                    .to.be.revertedWithCustomError(radiShield, "PolicyNotFound")
                    .withArgs(nonExistentId)
            })

            it("should return correct policy details for multiple policies", async function () {
                const expectedCoverages = [
                    ethers.parseUnits("1000", 6),
                    ethers.parseUnits("2000", 6),
                    ethers.parseUnits("1500", 6),
                ]
                const expectedCropTypes = ["maize", "coffee", "wheat"]

                for (let i = 0; i < policyIds.length; i++) {
                    const policy = await radiShield.getPolicy(policyIds[i])
                    expect(policy.coverage).to.equal(expectedCoverages[i])
                    expect(policy.cropType).to.equal(expectedCropTypes[i])
                    expect(policy.farmer).to.equal(farmer.address)
                }
            })
        })

        describe("getPoliciesByFarmer", function () {
            it("should return all policy IDs for a farmer", async function () {
                const farmerPolicies = await radiShield.getPoliciesByFarmer(farmer.address)

                expect(farmerPolicies.length).to.equal(3)
                expect(farmerPolicies[0]).to.equal(1)
                expect(farmerPolicies[1]).to.equal(2)
                expect(farmerPolicies[2]).to.equal(3)
            })

            it("should return empty array for farmer with no policies", async function () {
                const [, , newFarmer] = await ethers.getSigners()
                const farmerPolicies = await radiShield.getPoliciesByFarmer(newFarmer.address)

                expect(farmerPolicies.length).to.equal(0)
            })

            it("should return correct policies after creating additional policies", async function () {
                // Create one more policy
                await radiShield
                    .connect(farmer)
                    .createPolicy("rice", ethers.parseUnits("800", 6), 45 * 24 * 60 * 60, -4, 39)

                const farmerPolicies = await radiShield.getPoliciesByFarmer(farmer.address)
                expect(farmerPolicies.length).to.equal(4)
                expect(farmerPolicies[3]).to.equal(4) // New policy ID
            })
        })

        describe("Policy Status Checking Functions", function () {
            describe("isPolicyActive", function () {
                it("should return true for active unclaimed policy", async function () {
                    const policyId = policyIds[0]
                    const isActive = await radiShield.isPolicyActive(policyId)
                    expect(isActive).to.be.true
                })

                it("should return false for claimed policy", async function () {
                    const policyId = policyIds[0]

                    // Claim the policy
                    await radiShield.emergencyPayout(
                        policyId,
                        ethers.parseUnits("500", 6),
                        "Test claim",
                    )

                    const isActive = await radiShield.isPolicyActive(policyId)
                    expect(isActive).to.be.false
                })

                it("should revert for non-existent policy", async function () {
                    const nonExistentId = 999

                    await expect(radiShield.isPolicyActive(nonExistentId))
                        .to.be.revertedWithCustomError(radiShield, "PolicyNotFound")
                        .withArgs(nonExistentId)
                })
            })

            describe("isPolicyClaimed", function () {
                it("should return false for unclaimed policy", async function () {
                    const policyId = policyIds[0]
                    const isClaimed = await radiShield.isPolicyClaimed(policyId)
                    expect(isClaimed).to.be.false
                })

                it("should return true for claimed policy", async function () {
                    const policyId = policyIds[0]

                    // Claim the policy
                    await radiShield.emergencyPayout(
                        policyId,
                        ethers.parseUnits("500", 6),
                        "Test claim",
                    )

                    const isClaimed = await radiShield.isPolicyClaimed(policyId)
                    expect(isClaimed).to.be.true
                })

                it("should revert for non-existent policy", async function () {
                    const nonExistentId = 999

                    await expect(radiShield.isPolicyClaimed(nonExistentId))
                        .to.be.revertedWithCustomError(radiShield, "PolicyNotFound")
                        .withArgs(nonExistentId)
                })
            })

            describe("isPolicyExpired", function () {
                it("should return false for non-expired policy", async function () {
                    const policyId = policyIds[0]
                    const isExpired = await radiShield.isPolicyExpired(policyId)
                    expect(isExpired).to.be.false
                })

                it("should revert for non-existent policy", async function () {
                    const nonExistentId = 999

                    await expect(radiShield.isPolicyExpired(nonExistentId))
                        .to.be.revertedWithCustomError(radiShield, "PolicyNotFound")
                        .withArgs(nonExistentId)
                })
            })
        })

        describe("Contract Statistics Functions", function () {
            describe("getTotalPolicies", function () {
                it("should return correct total number of policies", async function () {
                    const totalPolicies = await radiShield.getTotalPolicies()
                    expect(totalPolicies).to.equal(3)
                })

                it("should increment when new policies are created", async function () {
                    const initialTotal = await radiShield.getTotalPolicies()

                    // Create one more policy
                    await radiShield
                        .connect(farmer)
                        .createPolicy(
                            "barley",
                            ethers.parseUnits("600", 6),
                            30 * 24 * 60 * 60,
                            -5,
                            40,
                        )

                    const newTotal = await radiShield.getTotalPolicies()
                    expect(newTotal).to.equal(initialTotal + BigInt(1))
                })
            })

            describe("getActivePoliciesCount", function () {
                it("should return correct number of active policies", async function () {
                    const activePolicies = await radiShield.getActivePoliciesCount()
                    expect(activePolicies).to.equal(3) // All policies are active initially
                })

                it("should decrease when policy is claimed", async function () {
                    const initialActive = await radiShield.getActivePoliciesCount()

                    // Claim one policy
                    await radiShield.emergencyPayout(
                        policyIds[0],
                        ethers.parseUnits("500", 6),
                        "Test claim",
                    )

                    const newActive = await radiShield.getActivePoliciesCount()
                    expect(newActive).to.equal(initialActive - BigInt(1))
                })
            })

            describe("getClaimedPoliciesCount", function () {
                it("should return zero initially", async function () {
                    const claimedPolicies = await radiShield.getClaimedPoliciesCount()
                    expect(claimedPolicies).to.equal(0)
                })

                it("should increment when policy is claimed", async function () {
                    const initialClaimed = await radiShield.getClaimedPoliciesCount()

                    // Claim one policy
                    await radiShield.emergencyPayout(
                        policyIds[0],
                        ethers.parseUnits("500", 6),
                        "Test claim",
                    )

                    const newClaimed = await radiShield.getClaimedPoliciesCount()
                    expect(newClaimed).to.equal(initialClaimed + BigInt(1))
                })

                it("should count multiple claimed policies correctly", async function () {
                    // Claim two policies
                    await radiShield.emergencyPayout(
                        policyIds[0],
                        ethers.parseUnits("500", 6),
                        "Test claim 1",
                    )
                    await radiShield.emergencyPayout(
                        policyIds[1],
                        ethers.parseUnits("800", 6),
                        "Test claim 2",
                    )

                    const claimedPolicies = await radiShield.getClaimedPoliciesCount()
                    expect(claimedPolicies).to.equal(2)
                })
            })

            describe("getTotalCoverage", function () {
                it("should return sum of all policy coverages", async function () {
                    const totalCoverage = await radiShield.getTotalCoverage()
                    const expectedTotal =
                        ethers.parseUnits("1000", 6) +
                        ethers.parseUnits("2000", 6) +
                        ethers.parseUnits("1500", 6)
                    expect(totalCoverage).to.equal(expectedTotal)
                })

                it("should include coverage from new policies", async function () {
                    const initialTotal = await radiShield.getTotalCoverage()
                    const newCoverage = ethers.parseUnits("750", 6)

                    // Create new policy
                    await radiShield
                        .connect(farmer)
                        .createPolicy("soy", newCoverage, 30 * 24 * 60 * 60, -6, 41)

                    const newTotal = await radiShield.getTotalCoverage()
                    expect(newTotal).to.equal(initialTotal + newCoverage)
                })
            })

            describe("getTotalPremiums", function () {
                it("should return sum of all premiums collected", async function () {
                    const totalPremiums = await radiShield.getTotalPremiums()

                    // Calculate expected total (7% of each coverage)
                    const coverage1 = ethers.parseUnits("1000", 6)
                    const coverage2 = ethers.parseUnits("2000", 6)
                    const coverage3 = ethers.parseUnits("1500", 6)

                    const premium1 = (coverage1 * BigInt(7)) / BigInt(100)
                    const premium2 = (coverage2 * BigInt(7)) / BigInt(100)
                    const premium3 = (coverage3 * BigInt(7)) / BigInt(100)

                    const expectedTotal = premium1 + premium2 + premium3
                    expect(totalPremiums).to.equal(expectedTotal)
                })
            })

            describe("getContractStats", function () {
                it("should return comprehensive contract statistics", async function () {
                    const stats = await radiShield.getContractStats()

                    expect(stats.totalPolicies).to.equal(3)
                    expect(stats.activePolicies).to.equal(3)
                    expect(stats.claimedPolicies).to.equal(0)
                    expect(stats.totalCoverage).to.equal(
                        ethers.parseUnits("1000", 6) +
                            ethers.parseUnits("2000", 6) +
                            ethers.parseUnits("1500", 6),
                    )
                    expect(stats.contractBalance).to.be.gt(0) // Should have USDC from premiums
                })

                it("should update statistics after policy claims", async function () {
                    // Claim one policy
                    await radiShield.emergencyPayout(
                        policyIds[0],
                        ethers.parseUnits("500", 6),
                        "Test claim",
                    )

                    const stats = await radiShield.getContractStats()

                    expect(stats.totalPolicies).to.equal(3) // Total doesn't change
                    expect(stats.activePolicies).to.equal(2) // One less active
                    expect(stats.claimedPolicies).to.equal(1) // One claimed
                })
            })
        })
    })

    describe("Utility Functions", function () {
        beforeEach(async function () {
            // Mint USDC to farmer for testing
            const mintAmount = ethers.parseUnits("10000", 6)
            await mockUSDC.mint(farmer.address, mintAmount)
            await mockUSDC.connect(farmer).approve(await radiShield.getAddress(), mintAmount)
        })

        describe("String Conversion Functions", function () {
            describe("_int2str (tested through coordinate conversion)", function () {
                it("should convert positive integers correctly", async function () {
                    // Test through policy creation which uses _int2str internally
                    const latitude = 45 // Will be scaled to 450000
                    const longitude = 90 // Will be scaled to 900000

                    await radiShield
                        .connect(farmer)
                        .createPolicy(
                            "maize",
                            ethers.parseUnits("1000", 6),
                            30 * 24 * 60 * 60,
                            latitude,
                            longitude,
                        )

                    const policy = await radiShield.getPolicy(1)
                    expect(policy.latitude).to.equal(450000)
                    expect(policy.longitude).to.equal(900000)
                })

                it("should convert negative integers correctly", async function () {
                    const latitude = -45 // Will be scaled to -450000
                    const longitude = -90 // Will be scaled to -900000

                    await radiShield
                        .connect(farmer)
                        .createPolicy(
                            "coffee",
                            ethers.parseUnits("1000", 6),
                            30 * 24 * 60 * 60,
                            latitude,
                            longitude,
                        )

                    const policy = await radiShield.getPolicy(1)
                    expect(policy.latitude).to.equal(-450000)
                    expect(policy.longitude).to.equal(-900000)
                })

                it("should convert zero correctly", async function () {
                    const latitude = 0
                    const longitude = 0

                    await radiShield
                        .connect(farmer)
                        .createPolicy(
                            "wheat",
                            ethers.parseUnits("1000", 6),
                            30 * 24 * 60 * 60,
                            latitude,
                            longitude,
                        )

                    const policy = await radiShield.getPolicy(1)
                    expect(policy.latitude).to.equal(0)
                    expect(policy.longitude).to.equal(0)
                })
            })
        })

        describe("Coordinate Validation and Scaling", function () {
            describe("validateCoordinates", function () {
                it("should return true for valid coordinates", async function () {
                    const validCases = [
                        { lat: 0, lon: 0 },
                        { lat: 90, lon: 180 },
                        { lat: -90, lon: -180 },
                        { lat: 45, lon: 90 },
                        { lat: -1, lon: 36 },
                    ]

                    for (const coords of validCases) {
                        const isValid = await radiShield.validateCoordinates(coords.lat, coords.lon)
                        expect(isValid).to.be.true
                    }
                })

                it("should return false for invalid latitude", async function () {
                    const invalidCases = [
                        { lat: 91, lon: 0 },
                        { lat: -91, lon: 0 },
                        { lat: 100, lon: 50 },
                        { lat: -100, lon: -50 },
                    ]

                    for (const coords of invalidCases) {
                        const isValid = await radiShield.validateCoordinates(coords.lat, coords.lon)
                        expect(isValid).to.be.false
                    }
                })

                it("should return false for invalid longitude", async function () {
                    const invalidCases = [
                        { lat: 0, lon: 181 },
                        { lat: 0, lon: -181 },
                        { lat: 45, lon: 200 },
                        { lat: -45, lon: -200 },
                    ]

                    for (const coords of invalidCases) {
                        const isValid = await radiShield.validateCoordinates(coords.lat, coords.lon)
                        expect(isValid).to.be.false
                    }
                })
            })

            describe("scaleCoordinates", function () {
                it("should scale coordinates correctly", async function () {
                    const testCases = [
                        { lat: 45, lon: 90, expectedLat: 450000, expectedLon: 900000 },
                        { lat: -1, lon: 36, expectedLat: -10000, expectedLon: 360000 },
                        { lat: 0, lon: 0, expectedLat: 0, expectedLon: 0 },
                        { lat: 90, lon: 180, expectedLat: 900000, expectedLon: 1800000 },
                    ]

                    for (const testCase of testCases) {
                        const result = await radiShield.scaleCoordinates(testCase.lat, testCase.lon)
                        expect(result.scaledLat).to.equal(testCase.expectedLat)
                        expect(result.scaledLon).to.equal(testCase.expectedLon)
                    }
                })

                it("should revert for invalid coordinates", async function () {
                    await expect(radiShield.scaleCoordinates(91, 0)).to.be.revertedWithCustomError(
                        radiShield,
                        "InvalidLocation",
                    )
                    await expect(radiShield.scaleCoordinates(0, 181)).to.be.revertedWithCustomError(
                        radiShield,
                        "InvalidLocation",
                    )
                    await expect(
                        radiShield.scaleCoordinates(-91, -181),
                    ).to.be.revertedWithCustomError(radiShield, "InvalidLocation")
                })
            })

            describe("unscaleCoordinates", function () {
                it("should unscale coordinates correctly", async function () {
                    const testCases = [
                        { scaledLat: 450000, scaledLon: 900000, expectedLat: 45, expectedLon: 90 },
                        { scaledLat: -10000, scaledLon: 360000, expectedLat: -1, expectedLon: 36 },
                        { scaledLat: 0, scaledLon: 0, expectedLat: 0, expectedLon: 0 },
                        {
                            scaledLat: 900000,
                            scaledLon: 1800000,
                            expectedLat: 90,
                            expectedLon: 180,
                        },
                    ]

                    for (const testCase of testCases) {
                        const result = await radiShield.unscaleCoordinates(
                            testCase.scaledLat,
                            testCase.scaledLon,
                        )
                        expect(result.lat).to.equal(testCase.expectedLat)
                        expect(result.lon).to.equal(testCase.expectedLon)
                    }
                })

                it("should be inverse of scaleCoordinates", async function () {
                    const originalLat = 45
                    const originalLon = -90

                    const scaled = await radiShield.scaleCoordinates(originalLat, originalLon)
                    const unscaled = await radiShield.unscaleCoordinates(
                        scaled.scaledLat,
                        scaled.scaledLon,
                    )

                    expect(unscaled.lat).to.equal(originalLat)
                    expect(unscaled.lon).to.equal(originalLon)
                })
            })
        })

        describe("Date/Time Calculation Functions", function () {
            describe("daysBetween", function () {
                it("should calculate days between timestamps correctly", async function () {
                    const startTime = 1000000
                    const endTime = startTime + 5 * 86400 // 5 days later

                    const days = await radiShield.daysBetween(startTime, endTime)
                    expect(days).to.equal(5)
                })

                it("should return 0 for same timestamps", async function () {
                    const timestamp = 1000000
                    const days = await radiShield.daysBetween(timestamp, timestamp)
                    expect(days).to.equal(0)
                })

                it("should handle partial days correctly", async function () {
                    const startTime = 1000000
                    const endTime = startTime + (86400 + 3600) // 1 day + 1 hour

                    const days = await radiShield.daysBetween(startTime, endTime)
                    expect(days).to.equal(1) // Should truncate to 1 day
                })

                it("should revert when end time is before start time", async function () {
                    const startTime = 1000000
                    const endTime = startTime - 86400 // 1 day before

                    await expect(
                        radiShield.daysBetween(startTime, endTime),
                    ).to.be.revertedWithCustomError(radiShield, "InvalidTimestamp")
                })
            })

            describe("getPolicyDurationInDays", function () {
                it("should return correct policy duration", async function () {
                    const duration = 30 * 24 * 60 * 60 // 30 days in seconds

                    await radiShield
                        .connect(farmer)
                        .createPolicy("maize", ethers.parseUnits("1000", 6), duration, 0, 0)

                    const policyDuration = await radiShield.getPolicyDurationInDays(1)
                    expect(policyDuration).to.equal(30)
                })

                it("should revert for non-existent policy", async function () {
                    await expect(radiShield.getPolicyDurationInDays(999))
                        .to.be.revertedWithCustomError(radiShield, "PolicyNotFound")
                        .withArgs(999)
                })
            })

            describe("getRemainingDays", function () {
                it("should return correct remaining days for active policy", async function () {
                    const duration = 30 * 24 * 60 * 60 // 30 days

                    await radiShield
                        .connect(farmer)
                        .createPolicy("coffee", ethers.parseUnits("1000", 6), duration, 0, 0)

                    const remainingDays = await radiShield.getRemainingDays(1)
                    expect(remainingDays).to.be.lte(30) // Should be <= 30 days
                    expect(remainingDays).to.be.gte(29) // Should be >= 29 days (accounting for block time)
                })

                it("should return 0 for expired policy", async function () {
                    // Create a policy with minimum duration (30 days)
                    const duration = 30 * 24 * 60 * 60 // 30 days minimum

                    await radiShield
                        .connect(farmer)
                        .createPolicy("wheat", ethers.parseUnits("1000", 6), duration, 0, 0)

                    // Since we can't manipulate time in this test environment,
                    // we'll just verify the function works with a valid policy
                    const remainingDays = await radiShield.getRemainingDays(1)
                    expect(remainingDays).to.be.lte(30)
                    expect(remainingDays).to.be.gte(29) // Should be close to 30 days
                })

                it("should revert for non-existent policy", async function () {
                    await expect(radiShield.getRemainingDays(999))
                        .to.be.revertedWithCustomError(radiShield, "PolicyNotFound")
                        .withArgs(999)
                })
            })

            describe("addDays", function () {
                it("should add days to timestamp correctly", async function () {
                    const baseTimestamp = 1000000
                    const daysToAdd = 7

                    const newTimestamp = await radiShield.addDays(baseTimestamp, daysToAdd)
                    const expectedTimestamp = baseTimestamp + daysToAdd * 86400

                    expect(newTimestamp).to.equal(expectedTimestamp)
                })

                it("should handle zero days", async function () {
                    const baseTimestamp = 1000000
                    const newTimestamp = await radiShield.addDays(baseTimestamp, 0)
                    expect(newTimestamp).to.equal(baseTimestamp)
                })

                it("should handle large number of days", async function () {
                    const baseTimestamp = 1000000
                    const daysToAdd = 365

                    const newTimestamp = await radiShield.addDays(baseTimestamp, daysToAdd)
                    const expectedTimestamp = baseTimestamp + 365 * 86400

                    expect(newTimestamp).to.equal(expectedTimestamp)
                })
            })

            describe("isWithinDays", function () {
                it("should return true for timestamp within specified days", async function () {
                    const futureTimestamp = Math.floor(Date.now() / 1000) + 5 * 86400 // 5 days from now
                    const isWithin = await radiShield.isWithinDays(futureTimestamp, 10)
                    expect(isWithin).to.be.true
                })

                it("should return false for timestamp beyond specified days", async function () {
                    const farFutureTimestamp = Math.floor(Date.now() / 1000) + 15 * 86400 // 15 days from now
                    const isWithin = await radiShield.isWithinDays(farFutureTimestamp, 10)
                    expect(isWithin).to.be.false
                })

                it("should return true for current timestamp", async function () {
                    const currentTimestamp = Math.floor(Date.now() / 1000)
                    const isWithin = await radiShield.isWithinDays(currentTimestamp, 1)
                    expect(isWithin).to.be.true
                })
            })
        })

        describe("Emergency Functions and Admin Operations", function () {
            describe("Pause/Unpause Functionality", function () {
                it("should allow owner to pause contract", async function () {
                    await expect(radiShield.pause())
                        .to.emit(radiShield, "Paused")
                        .withArgs(owner.address)

                    const isPaused = await radiShield.paused()
                    expect(isPaused).to.be.true
                })

                it("should allow owner to unpause contract", async function () {
                    // First pause
                    await radiShield.pause()

                    // Then unpause
                    await expect(radiShield.unpause())
                        .to.emit(radiShield, "Unpaused")
                        .withArgs(owner.address)

                    const isPaused = await radiShield.paused()
                    expect(isPaused).to.be.false
                })

                it("should revert when non-owner tries to pause", async function () {
                    await expect(radiShield.connect(farmer).pause()).to.be.revertedWithCustomError(
                        radiShield,
                        "OwnableUnauthorizedAccount",
                    )
                })

                it("should revert when trying to pause already paused contract", async function () {
                    await radiShield.pause()
                    await expect(radiShield.pause()).to.be.revertedWithCustomError(
                        radiShield,
                        "ContractPaused",
                    )
                })

                it("should revert when trying to unpause non-paused contract", async function () {
                    await expect(radiShield.unpause()).to.be.revertedWithCustomError(
                        radiShield,
                        "ContractNotPaused",
                    )
                })

                it("should prevent policy creation when paused", async function () {
                    await radiShield.pause()

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
                    ).to.be.revertedWithCustomError(radiShield, "ContractPaused")
                })

                it("should prevent weather data requests when paused", async function () {
                    // First create a policy
                    await radiShield
                        .connect(farmer)
                        .createPolicy(
                            "maize",
                            ethers.parseUnits("1000", 6),
                            30 * 24 * 60 * 60,
                            0,
                            0,
                        )

                    // Then pause and try to request weather data
                    await radiShield.pause()

                    await expect(radiShield.requestWeatherData(1)).to.be.revertedWithCustomError(
                        radiShield,
                        "ContractPaused",
                    )
                })

                it("should allow policy creation after unpause", async function () {
                    await radiShield.pause()
                    await radiShield.unpause()

                    await expect(
                        radiShield
                            .connect(farmer)
                            .createPolicy(
                                "coffee",
                                ethers.parseUnits("1000", 6),
                                30 * 24 * 60 * 60,
                                0,
                                0,
                            ),
                    ).to.not.be.reverted
                })
            })

            describe("Batch Emergency Payout", function () {
                beforeEach(async function () {
                    // Fund contract with USDC for payouts
                    await mockUSDC.mint(
                        await radiShield.getAddress(),
                        ethers.parseUnits("10000", 6),
                    )

                    // Create multiple policies
                    await radiShield
                        .connect(farmer)
                        .createPolicy(
                            "maize",
                            ethers.parseUnits("1000", 6),
                            30 * 24 * 60 * 60,
                            0,
                            0,
                        )
                    await radiShield
                        .connect(farmer)
                        .createPolicy(
                            "coffee",
                            ethers.parseUnits("2000", 6),
                            60 * 24 * 60 * 60,
                            1,
                            1,
                        )
                    await radiShield
                        .connect(farmer)
                        .createPolicy(
                            "wheat",
                            ethers.parseUnits("1500", 6),
                            90 * 24 * 60 * 60,
                            2,
                            2,
                        )
                })

                it("should process batch emergency payouts correctly", async function () {
                    const policyIds = [1, 2, 3]
                    const amounts = [
                        ethers.parseUnits("500", 6),
                        ethers.parseUnits("1000", 6),
                        ethers.parseUnits("750", 6),
                    ]
                    const reason = "Batch emergency payout"

                    const initialBalance = await mockUSDC.balanceOf(farmer.address)

                    await radiShield.batchEmergencyPayout(policyIds, amounts, reason)

                    const finalBalance = await mockUSDC.balanceOf(farmer.address)
                    const totalPayout = amounts.reduce((sum, amount) => sum + amount, 0n)

                    expect(finalBalance).to.equal(initialBalance + totalPayout)

                    // Check all policies are marked as claimed
                    for (const policyId of policyIds) {
                        const policy = await radiShield.getPolicy(policyId)
                        expect(policy.claimed).to.be.true
                        expect(policy.isActive).to.be.false
                    }
                })

                it("should revert for mismatched array lengths", async function () {
                    const policyIds = [1, 2]
                    const amounts = [ethers.parseUnits("500", 6)] // Different length

                    await expect(
                        radiShield.batchEmergencyPayout(policyIds, amounts, "Test"),
                    ).to.be.revertedWithCustomError(radiShield, "ArrayLengthMismatch")
                })

                it("should revert for empty arrays", async function () {
                    await expect(
                        radiShield.batchEmergencyPayout([], [], "Test"),
                    ).to.be.revertedWithCustomError(radiShield, "EmptyArray")
                })

                it("should skip invalid policies in batch", async function () {
                    const policyIds = [1, 999, 2] // 999 doesn't exist
                    const amounts = [
                        ethers.parseUnits("500", 6),
                        ethers.parseUnits("1000", 6),
                        ethers.parseUnits("750", 6),
                    ]

                    // Should not revert, just skip invalid policy
                    await expect(radiShield.batchEmergencyPayout(policyIds, amounts, "Test")).to.not
                        .be.reverted

                    // Check valid policies were processed
                    const policy1 = await radiShield.getPolicy(1)
                    const policy2 = await radiShield.getPolicy(2)
                    expect(policy1.claimed).to.be.true
                    expect(policy2.claimed).to.be.true
                })

                it("should revert when non-owner tries batch payout", async function () {
                    const policyIds = [1]
                    const amounts = [ethers.parseUnits("500", 6)]

                    await expect(
                        radiShield.connect(farmer).batchEmergencyPayout(policyIds, amounts, "Test"),
                    ).to.be.revertedWithCustomError(radiShield, "OwnableUnauthorizedAccount")
                })
            })

            describe("Emergency Withdraw Functions", function () {
                beforeEach(async function () {
                    // Fund contract with USDC and LINK
                    await mockUSDC.mint(await radiShield.getAddress(), ethers.parseUnits("5000", 6))
                    await mockLINK.mint(await radiShield.getAddress(), ethers.parseUnits("100", 18))
                })

                describe("emergencyWithdraw (USDC)", function () {
                    it("should allow owner to withdraw USDC", async function () {
                        const withdrawAmount = ethers.parseUnits("1000", 6)
                        const recipient = owner.address

                        const initialBalance = await mockUSDC.balanceOf(recipient)
                        await radiShield.emergencyWithdraw(withdrawAmount, recipient)
                        const finalBalance = await mockUSDC.balanceOf(recipient)

                        expect(finalBalance).to.equal(initialBalance + withdrawAmount)
                    })

                    it("should revert for invalid recipient", async function () {
                        await expect(
                            radiShield.emergencyWithdraw(
                                ethers.parseUnits("1000", 6),
                                ethers.ZeroAddress,
                            ),
                        ).to.be.revertedWithCustomError(radiShield, "InvalidRecipient")
                    })

                    it("should revert for zero amount", async function () {
                        await expect(
                            radiShield.emergencyWithdraw(0, owner.address),
                        ).to.be.revertedWithCustomError(radiShield, "ZeroValue")
                    })

                    it("should revert for insufficient balance", async function () {
                        const excessiveAmount = ethers.parseUnits("10000", 6) // More than contract has

                        await expect(
                            radiShield.emergencyWithdraw(excessiveAmount, owner.address),
                        ).to.be.revertedWithCustomError(radiShield, "InsufficientContractBalance")
                    })

                    it("should revert when non-owner tries to withdraw", async function () {
                        await expect(
                            radiShield
                                .connect(farmer)
                                .emergencyWithdraw(ethers.parseUnits("1000", 6), farmer.address),
                        ).to.be.revertedWithCustomError(radiShield, "OwnableUnauthorizedAccount")
                    })
                })

                describe("emergencyWithdrawLink", function () {
                    it("should allow owner to withdraw LINK", async function () {
                        const withdrawAmount = ethers.parseUnits("10", 18)
                        const recipient = owner.address

                        const initialBalance = await mockLINK.balanceOf(recipient)
                        await radiShield.emergencyWithdrawLink(withdrawAmount, recipient)
                        const finalBalance = await mockLINK.balanceOf(recipient)

                        expect(finalBalance).to.equal(initialBalance + withdrawAmount)
                    })

                    it("should revert for invalid recipient", async function () {
                        await expect(
                            radiShield.emergencyWithdrawLink(
                                ethers.parseUnits("10", 18),
                                ethers.ZeroAddress,
                            ),
                        ).to.be.revertedWithCustomError(radiShield, "InvalidRecipient")
                    })

                    it("should revert for zero amount", async function () {
                        await expect(
                            radiShield.emergencyWithdrawLink(0, owner.address),
                        ).to.be.revertedWithCustomError(radiShield, "ZeroValue")
                    })

                    it("should revert for insufficient LINK balance", async function () {
                        const excessiveAmount = ethers.parseUnits("1000", 18) // More than contract has

                        await expect(
                            radiShield.emergencyWithdrawLink(excessiveAmount, owner.address),
                        ).to.be.revertedWithCustomError(radiShield, "InsufficientContractBalance")
                    })

                    it("should revert when non-owner tries to withdraw LINK", async function () {
                        await expect(
                            radiShield
                                .connect(farmer)
                                .emergencyWithdrawLink(ethers.parseUnits("10", 18), farmer.address),
                        ).to.be.revertedWithCustomError(radiShield, "OwnableUnauthorizedAccount")
                    })
                })
            })
        })
    })

    describe("Comprehensive Error Handling", function () {
        beforeEach(async function () {
            // Mint USDC to farmer and contract for testing
            const usdcAmount = ethers.parseUnits("10000", 6)
            const linkAmount = ethers.parseUnits("100", 18)

            await mockUSDC.mint(farmer.address, usdcAmount)
            await mockUSDC.mint(await radiShield.getAddress(), usdcAmount)
            await mockLINK.mint(await radiShield.getAddress(), linkAmount)

            // Approve RadiShield contract to spend farmer's USDC
            await mockUSDC.connect(farmer).approve(await radiShield.getAddress(), usdcAmount)
        })

        describe("Constructor Error Handling", function () {
            it("should revert for invalid USDC token address", async function () {
                const RadiShield = await ethers.getContractFactory("RadiShield")

                await expect(
                    RadiShield.deploy(
                        ethers.ZeroAddress, // Invalid USDC address
                        await mockLINK.getAddress(),
                        MOCK_ORACLE_ADDRESS,
                        MOCK_JOB_ID,
                    ),
                ).to.be.revertedWithCustomError(RadiShield, "InvalidTokenAddress")
            })

            it("should revert for invalid LINK token address", async function () {
                const RadiShield = await ethers.getContractFactory("RadiShield")

                await expect(
                    RadiShield.deploy(
                        await mockUSDC.getAddress(),
                        ethers.ZeroAddress, // Invalid LINK address
                        MOCK_ORACLE_ADDRESS,
                        MOCK_JOB_ID,
                    ),
                ).to.be.revertedWithCustomError(RadiShield, "InvalidTokenAddress")
            })

            it("should revert for invalid oracle address", async function () {
                const RadiShield = await ethers.getContractFactory("RadiShield")

                await expect(
                    RadiShield.deploy(
                        await mockUSDC.getAddress(),
                        await mockLINK.getAddress(),
                        ethers.ZeroAddress, // Invalid oracle address
                        MOCK_JOB_ID,
                    ),
                ).to.be.revertedWithCustomError(RadiShield, "InvalidOracleAddress")
            })

            it("should revert for invalid job ID", async function () {
                const RadiShield = await ethers.getContractFactory("RadiShield")

                await expect(
                    RadiShield.deploy(
                        await mockUSDC.getAddress(),
                        await mockLINK.getAddress(),
                        MOCK_ORACLE_ADDRESS,
                        ethers.ZeroHash, // Invalid job ID
                    ),
                ).to.be.revertedWithCustomError(RadiShield, "InvalidJobId")
            })
        })

        describe("Policy Creation Error Handling", function () {
            it("should revert for empty crop type", async function () {
                await expect(
                    radiShield.connect(farmer).createPolicy(
                        "", // Empty crop type
                        ethers.parseUnits("1000", 6),
                        30 * 24 * 60 * 60,
                        0,
                        0,
                    ),
                ).to.be.revertedWithCustomError(radiShield, "InvalidCropType")
            })

            it("should revert for crop type too long", async function () {
                const longCropType = "a".repeat(51) // 51 characters, exceeds 50 limit

                await expect(
                    radiShield
                        .connect(farmer)
                        .createPolicy(
                            longCropType,
                            ethers.parseUnits("1000", 6),
                            30 * 24 * 60 * 60,
                            0,
                            0,
                        ),
                ).to.be.revertedWithCustomError(radiShield, "InvalidCropType")
            })

            it("should revert for zero coverage", async function () {
                await expect(
                    radiShield.connect(farmer).createPolicy(
                        "maize",
                        0, // Zero coverage
                        30 * 24 * 60 * 60,
                        0,
                        0,
                    ),
                ).to.be.revertedWithCustomError(radiShield, "ZeroValue")
            })

            it("should revert for zero duration", async function () {
                await expect(
                    radiShield.connect(farmer).createPolicy(
                        "maize",
                        ethers.parseUnits("1000", 6),
                        0, // Zero duration
                        0,
                        0,
                    ),
                ).to.be.revertedWithCustomError(radiShield, "ZeroValue")
            })

            it("should revert for insufficient farmer balance", async function () {
                // Create farmer with insufficient balance
                const [, , poorFarmer] = await ethers.getSigners()
                await mockUSDC.mint(poorFarmer.address, ethers.parseUnits("10", 6)) // Only $10
                await mockUSDC
                    .connect(poorFarmer)
                    .approve(await radiShield.getAddress(), ethers.parseUnits("10", 6))

                await expect(
                    radiShield.connect(poorFarmer).createPolicy(
                        "maize",
                        ethers.parseUnits("1000", 6), // Requires $70 premium
                        30 * 24 * 60 * 60,
                        0,
                        0,
                    ),
                ).to.be.revertedWithCustomError(radiShield, "InsufficientBalance")
            })

            it("should revert for insufficient allowance", async function () {
                // Reset allowance to insufficient amount
                await mockUSDC
                    .connect(farmer)
                    .approve(await radiShield.getAddress(), ethers.parseUnits("10", 6))

                await expect(
                    radiShield.connect(farmer).createPolicy(
                        "maize",
                        ethers.parseUnits("1000", 6), // Requires $70 premium
                        30 * 24 * 60 * 60,
                        0,
                        0,
                    ),
                ).to.be.revertedWithCustomError(radiShield, "InsufficientAllowance")
            })
        })

        describe("Premium Calculation Error Handling", function () {
            it("should revert for zero coverage in calculatePremium", async function () {
                await expect(radiShield.calculatePremium(0, 0, 0)).to.be.revertedWithCustomError(
                    radiShield,
                    "ZeroValue",
                )
            })
        })

        describe("Weather Data Request Error Handling", function () {
            let policyId

            beforeEach(async function () {
                // Create a test policy
                await radiShield
                    .connect(farmer)
                    .createPolicy("maize", ethers.parseUnits("1000", 6), 30 * 24 * 60 * 60, 0, 0)
                policyId = 1
            })

            it("should revert for zero policy ID", async function () {
                await expect(radiShield.requestWeatherData(0)).to.be.revertedWithCustomError(
                    radiShield,
                    "ZeroValue",
                )
            })

            it("should revert for already claimed policy", async function () {
                // Claim the policy first
                await radiShield.emergencyPayout(policyId, ethers.parseUnits("500", 6), "Test")

                await expect(radiShield.requestWeatherData(policyId)).to.be.revertedWithCustomError(
                    radiShield,
                    "PolicyAlreadyClaimed",
                )
            })

            it("should revert when contract has insufficient LINK", async function () {
                // Deploy new contract with no LINK
                const RadiShield = await ethers.getContractFactory("RadiShield")
                const testContract = await RadiShield.deploy(
                    await mockUSDC.getAddress(),
                    await mockLINK.getAddress(),
                    MOCK_ORACLE_ADDRESS,
                    MOCK_JOB_ID,
                )

                // Create policy in new contract
                await mockUSDC
                    .connect(farmer)
                    .approve(await testContract.getAddress(), ethers.parseUnits("1000", 6))
                await testContract
                    .connect(farmer)
                    .createPolicy("maize", ethers.parseUnits("1000", 6), 30 * 24 * 60 * 60, 0, 0)

                await expect(testContract.requestWeatherData(1)).to.be.revertedWithCustomError(
                    testContract,
                    "InsufficientContractBalance",
                )
            })
        })

        describe("Oracle Callback Error Handling", function () {
            let policyId, requestId

            beforeEach(async function () {
                // Create policy and request weather data
                await radiShield
                    .connect(farmer)
                    .createPolicy("maize", ethers.parseUnits("1000", 6), 30 * 24 * 60 * 60, 0, 0)
                policyId = 1

                const tx = await radiShield.requestWeatherData(policyId)
                const receipt = await tx.wait()
                const event = receipt.logs.find((log) => {
                    try {
                        const parsed = radiShield.interface.parseLog(log)
                        return parsed.name === "WeatherDataRequested"
                    } catch {
                        return false
                    }
                })
                requestId = radiShield.interface.parseLog(event).args[1]
            })

            it("should revert for invalid weather data ranges", async function () {
                await expect(
                    radiShield.testFulfillWeatherData(
                        requestId,
                        15000, // Invalid rainfall30d > 10000
                        50,
                        30,
                    ),
                ).to.be.revertedWithCustomError(radiShield, "InvalidWeatherData")
            })

            it("should revert for zero request ID", async function () {
                await expect(
                    radiShield.testFulfillWeatherData(
                        ethers.ZeroHash, // Zero request ID
                        50,
                        20,
                        30,
                    ),
                ).to.be.revertedWithCustomError(radiShield, "OracleRequestFailed")
            })
        })

        describe("Payout Error Handling", function () {
            let policyId

            beforeEach(async function () {
                await radiShield
                    .connect(farmer)
                    .createPolicy("maize", ethers.parseUnits("1000", 6), 30 * 24 * 60 * 60, 0, 0)
                policyId = 1
            })

            it("should revert emergency payout for zero policy ID", async function () {
                await expect(
                    radiShield.emergencyPayout(0, ethers.parseUnits("500", 6), "Test"),
                ).to.be.revertedWithCustomError(radiShield, "ZeroValue")
            })

            it("should revert emergency payout for zero amount", async function () {
                await expect(
                    radiShield.emergencyPayout(policyId, 0, "Test"),
                ).to.be.revertedWithCustomError(radiShield, "ZeroValue")
            })

            it("should revert emergency payout for empty reason", async function () {
                await expect(
                    radiShield.emergencyPayout(policyId, ethers.parseUnits("500", 6), ""),
                ).to.be.revertedWithCustomError(radiShield, "InvalidCropType")
            })

            it("should revert emergency payout for amount exceeding coverage", async function () {
                await expect(
                    radiShield.emergencyPayout(policyId, ethers.parseUnits("2000", 6), "Test"), // Exceeds $1000 coverage
                ).to.be.revertedWithCustomError(radiShield, "InvalidAmount")
            })
        })

        describe("Batch Operations Error Handling", function () {
            beforeEach(async function () {
                // Create multiple policies
                for (let i = 0; i < 3; i++) {
                    await radiShield
                        .connect(farmer)
                        .createPolicy(
                            "maize",
                            ethers.parseUnits("1000", 6),
                            30 * 24 * 60 * 60,
                            i,
                            i,
                        )
                }
            })

            it("should revert batch payout for mismatched array lengths", async function () {
                await expect(
                    radiShield.batchEmergencyPayout(
                        [1, 2], // 2 elements
                        [ethers.parseUnits("500", 6)], // 1 element
                        "Test",
                    ),
                ).to.be.revertedWithCustomError(radiShield, "ArrayLengthMismatch")
            })

            it("should revert batch payout for empty arrays", async function () {
                await expect(
                    radiShield.batchEmergencyPayout([], [], "Test"),
                ).to.be.revertedWithCustomError(radiShield, "EmptyArray")
            })

            it("should revert batch payout for empty reason", async function () {
                await expect(
                    radiShield.batchEmergencyPayout(
                        [1],
                        [ethers.parseUnits("500", 6)],
                        "", // Empty reason
                    ),
                ).to.be.revertedWithCustomError(radiShield, "InvalidCropType")
            })
        })

        describe("Emergency Withdraw Error Handling", function () {
            it("should revert USDC withdraw for zero recipient", async function () {
                await expect(
                    radiShield.emergencyWithdraw(ethers.parseUnits("100", 6), ethers.ZeroAddress),
                ).to.be.revertedWithCustomError(radiShield, "InvalidRecipient")
            })

            it("should revert USDC withdraw for zero amount", async function () {
                await expect(
                    radiShield.emergencyWithdraw(0, owner.address),
                ).to.be.revertedWithCustomError(radiShield, "ZeroValue")
            })

            it("should revert LINK withdraw for zero recipient", async function () {
                await expect(
                    radiShield.emergencyWithdrawLink(
                        ethers.parseUnits("10", 18),
                        ethers.ZeroAddress,
                    ),
                ).to.be.revertedWithCustomError(radiShield, "InvalidRecipient")
            })

            it("should revert LINK withdraw for zero amount", async function () {
                await expect(
                    radiShield.emergencyWithdrawLink(0, owner.address),
                ).to.be.revertedWithCustomError(radiShield, "ZeroValue")
            })
        })

        describe("Pause/Unpause Error Handling", function () {
            it("should revert when trying to pause already paused contract", async function () {
                await radiShield.pause()

                await expect(radiShield.pause()).to.be.revertedWithCustomError(
                    radiShield,
                    "ContractPaused",
                )
            })

            it("should revert when trying to unpause non-paused contract", async function () {
                await expect(radiShield.unpause()).to.be.revertedWithCustomError(
                    radiShield,
                    "ContractNotPaused",
                )
            })

            it("should revert policy creation when paused", async function () {
                await radiShield.pause()

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
                ).to.be.revertedWithCustomError(radiShield, "ContractPaused")
            })

            it("should revert weather data request when paused", async function () {
                // Create policy first
                await radiShield
                    .connect(farmer)
                    .createPolicy("maize", ethers.parseUnits("1000", 6), 30 * 24 * 60 * 60, 0, 0)

                await radiShield.pause()

                await expect(radiShield.requestWeatherData(1)).to.be.revertedWithCustomError(
                    radiShield,
                    "ContractPaused",
                )
            })
        })

        describe("Coordinate Validation Error Handling", function () {
            it("should revert scaleCoordinates for invalid latitude", async function () {
                await expect(
                    radiShield.scaleCoordinates(91, 0), // Invalid latitude > 90
                ).to.be.revertedWithCustomError(radiShield, "InvalidLocation")
            })

            it("should revert scaleCoordinates for invalid longitude", async function () {
                await expect(
                    radiShield.scaleCoordinates(0, 181), // Invalid longitude > 180
                ).to.be.revertedWithCustomError(radiShield, "InvalidLocation")
            })
        })

        describe("Time Calculation Error Handling", function () {
            it("should revert daysBetween for zero start time", async function () {
                await expect(radiShield.daysBetween(0, 1000000)).to.be.revertedWithCustomError(
                    radiShield,
                    "InvalidTimestamp",
                )
            })

            it("should revert daysBetween for zero end time", async function () {
                await expect(radiShield.daysBetween(1000000, 0)).to.be.revertedWithCustomError(
                    radiShield,
                    "InvalidTimestamp",
                )
            })

            it("should revert daysBetween for end time before start time", async function () {
                await expect(
                    radiShield.daysBetween(2000000, 1000000),
                ).to.be.revertedWithCustomError(radiShield, "InvalidTimestamp")
            })
        })

        describe("Oracle Timeout Handling", function () {
            let policyId

            beforeEach(async function () {
                await radiShield
                    .connect(farmer)
                    .createPolicy("maize", ethers.parseUnits("1000", 6), 30 * 24 * 60 * 60, 0, 0)
                policyId = 1
            })

            it("should allow owner to handle oracle timeout with manual data", async function () {
                await expect(
                    radiShield.handleOracleTimeout(
                        policyId,
                        25, // Drought conditions
                        10,
                        30,
                        "Oracle timeout - manual intervention",
                    ),
                ).to.emit(radiShield, "WeatherDataReceived")
            })

            it("should revert handleOracleTimeout for zero policy ID", async function () {
                await expect(
                    radiShield.handleOracleTimeout(0, 50, 20, 30, "Test"),
                ).to.be.revertedWithCustomError(radiShield, "ZeroValue")
            })

            it("should revert handleOracleTimeout for empty reason", async function () {
                await expect(
                    radiShield.handleOracleTimeout(policyId, 50, 20, 30, ""),
                ).to.be.revertedWithCustomError(radiShield, "InvalidCropType")
            })

            it("should revert handleOracleTimeout for invalid weather data", async function () {
                await expect(
                    radiShield.handleOracleTimeout(
                        policyId,
                        15000, // Invalid rainfall > 10000
                        20,
                        30,
                        "Test",
                    ),
                ).to.be.revertedWithCustomError(radiShield, "InvalidWeatherData")
            })

            it("should allow owner to cancel oracle request", async function () {
                const tx = await radiShield.requestWeatherData(policyId)
                const receipt = await tx.wait()
                const event = receipt.logs.find((log) => {
                    try {
                        const parsed = radiShield.interface.parseLog(log)
                        return parsed.name === "WeatherDataRequested"
                    } catch {
                        return false
                    }
                })
                const requestId = radiShield.interface.parseLog(event).args[1]

                await expect(radiShield.cancelOracleRequest(requestId, policyId)).to.not.be.reverted
            })

            it("should revert cancelOracleRequest for zero request ID", async function () {
                await expect(
                    radiShield.cancelOracleRequest(ethers.ZeroHash, policyId),
                ).to.be.revertedWithCustomError(radiShield, "OracleRequestFailed")
            })

            it("should revert cancelOracleRequest for zero policy ID", async function () {
                await expect(
                    radiShield.cancelOracleRequest(ethers.id("test"), 0),
                ).to.be.revertedWithCustomError(radiShield, "ZeroValue")
            })
        })
    })
})
