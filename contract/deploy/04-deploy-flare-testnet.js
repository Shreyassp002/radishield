const { network } = require("hardhat")
const { networkConfig, developmentChains } = require("../helper-hardhat-config")
const { verify } = require("../utils/verify")

module.exports = async ({ getNamedAccounts, deployments }) => {
    const { deploy, log } = deployments
    const { deployer } = await getNamedAccounts()
    const chainId = network.config.chainId

    // Only run this script on Flare testnet
    if (chainId !== 114) {
        log("This script is only for Flare testnet (chainId: 114)")
        return
    }

    log("----------------------------------------------------")
    log("Deploying contracts to Flare Testnet (Coston2)...")
    log(`Deployer: ${deployer}`)
    log(`Chain ID: ${chainId}`)

    // Deploy WeatherOracle first
    log("Deploying WeatherOracle...")
    const weatherOracle = await deploy("WeatherOracle", {
        from: deployer,
        args: [],
        log: true,
        waitConfirmations: network.config.blockConfirmations || 3,
    })
    log(`WeatherOracle deployed at ${weatherOracle.address}`)

    // Deploy RadiShield with WeatherOracle address
    log("Deploying RadiShield...")
    const radiShield = await deploy("RadiShield", {
        from: deployer,
        args: [weatherOracle.address],
        log: true,
        waitConfirmations: network.config.blockConfirmations || 3,
    })
    log(`RadiShield deployed at ${radiShield.address}`)

    // Setup oracle authorization
    log("Setting up Oracle Authorization...")
    const weatherOracleContract = await ethers.getContractAt("WeatherOracle", weatherOracle.address)
    const tx = await weatherOracleContract.authorizeOracle(deployer)
    await tx.wait(3)
    log(`Oracle bot ${deployer} authorized successfully`)

    // Verify contracts on Flare explorer
    if (process.env.ETHERSCAN_API_KEY) {
        log("Verifying WeatherOracle...")
        try {
            await verify(weatherOracle.address, [])
        } catch (error) {
            log("WeatherOracle verification failed:", error.message)
        }

        log("Verifying RadiShield...")
        try {
            await verify(radiShield.address, [weatherOracle.address])
        } catch (error) {
            log("RadiShield verification failed:", error.message)
        }
    }

    log("----------------------------------------------------")
    log("Flare Testnet Deployment Complete!")
    log(`WeatherOracle: ${weatherOracle.address}`)
    log(`RadiShield: ${radiShield.address}`)
    log(`Explorer: https://coston2.testnet.flarescan.com/address/${radiShield.address}`)
    log("----------------------------------------------------")
}

module.exports.tags = ["flare", "flare-testnet"]
