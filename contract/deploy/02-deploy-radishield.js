const { network } = require("hardhat")
const { networkConfig, developmentChains } = require("../helper-hardhat-config")
const { verify } = require("../utils/verify")

module.exports = async ({ getNamedAccounts, deployments }) => {
    const { deploy, log, get } = deployments
    const { deployer } = await getNamedAccounts()
    const chainId = network.config.chainId

    log("----------------------------------------------------")
    log("Deploying RadiShield...")

    // Get the deployed WeatherOracle contract
    const weatherOracle = await get("WeatherOracle")

    // Get network configuration
    const config = networkConfig[chainId]

    // Use mock USDC for local development, real USDC for testnets/mainnet
    let usdcAddress
    if (developmentChains.includes(network.name)) {
        // Deploy mock USDC for local testing
        const mockUsdc = await deploy("MockUSDC", {
            from: deployer,
            args: [],
            log: true,
        })
        usdcAddress = mockUsdc.address
        log(`Mock USDC deployed at ${usdcAddress}`)
    } else {
        // Use real USDC address from network config
        usdcAddress = config.usdcToken
        if (!usdcAddress) {
            throw new Error(`USDC address not configured for network ${network.name}`)
        }
    }

    const args = [
        usdcAddress, // USDC token address
        weatherOracle.address, // Weather Oracle address
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
