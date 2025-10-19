const { network } = require("hardhat")
const { networkConfig, developmentChains } = require("../helper-hardhat-config")
const { verify } = require("../utils/verify")

module.exports = async ({ getNamedAccounts, deployments }) => {
    const { deploy, log } = deployments
    const { deployer } = await getNamedAccounts()
    const chainId = network.config.chainId

    log("----------------------------------------------------")
    log("Deploying WeatherOracle...")

    const weatherOracle = await deploy("WeatherOracle", {
        from: deployer,
        args: [], // No constructor arguments needed
        log: true,
        waitConfirmations: network.config.blockConfirmations || 1,
    })

    log(`WeatherOracle deployed at ${weatherOracle.address}`)

    // Verify the deployment on Etherscan if not on development chain
    if (!developmentChains.includes(network.name) && process.env.ETHERSCAN_API_KEY) {
        log("Verifying...")
        await verify(weatherOracle.address, [])
    }

    log("----------------------------------------------------")
}

module.exports.tags = ["all", "weatheroracle"]
