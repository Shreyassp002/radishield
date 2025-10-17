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
})
