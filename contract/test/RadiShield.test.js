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
            const latitude = -1.2921 // Nairobi latitude
            const longitude = 36.8219 // Nairobi longitude

            // Convert to integers for Solidity (multiply by 10000 to preserve 4 decimal places)
            const latitudeInt = Math.floor(latitude * 10000)
            const longitudeInt = Math.floor(longitude * 10000)

            await radiShield
                .connect(farmer)
                .createPolicy(cropType, coverage, duration, latitudeInt, longitudeInt)

            const policy = await radiShield.getPolicy(1)
            // Should be scaled by another 10000 in the contract
            expect(policy.latitude).to.equal(latitudeInt * 10000)
            expect(policy.longitude).to.equal(longitudeInt * 10000)
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
            ).to.be.revertedWithCustomError(radiShield, "TransferFailed")
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
})
