const { network } = require("hardhat")
const { networkConfig, developmentChains } = require("../helper-hardhat-config")
const { verify } = require("../utils/verify")

module.exports = async ({ getNamedAccounts, deployments }) => {
    const { deploy, log, get } = deployments
    const { deployer } = await getNamedAccounts()
    const chainId = network.config.chainId

    log("----------------------------------------------------")
    log("Deploying RadiShield with native token support...")

    // Get the deployed WeatherOracle contract
    const weatherOracle = await get("WeatherOracle")

    const args = [
        weatherOracle.address, // Weather Oracle address (no USDC needed)
    ]

    const radiShield = await deploy("RadiShield", {
        from: deployer,
        args: args,
        log: true,
        waitConfirmations: network.config.blockConfirmations || 1,
    })

    log(`RadiShield deployed at ${radiShield.address}`)

    // Verify the deployment on Etherscan if not on development chain
    if (!developmentChains.includes(network.name) && process.env.ETHERSCAN_API_KEY) {
        log("Verifying...")
        await verify(radiShield.address, args)
    }

    log("----------------------------------------------------")
}

module.exports.tags = ["all", "radishield"]
