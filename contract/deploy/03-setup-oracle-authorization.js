const { network } = require("hardhat")
const { developmentChains } = require("../helper-hardhat-config")

module.exports = async ({ getNamedAccounts, deployments }) => {
    const { log, get } = deployments
    const { deployer } = await getNamedAccounts()

    log("----------------------------------------------------")
    log("Setting up Oracle Authorization...")

    // Get deployed contracts
    const weatherOracle = await get("WeatherOracle")
    const weatherOracleContract = await ethers.getContractAt("WeatherOracle", weatherOracle.address)

    // For development, authorize the deployer as an oracle bot
    // In production, this would be the actual oracle bot address
    const oracleBot = deployer // In production, use actual bot address

    log(`Authorizing oracle bot: ${oracleBot}`)

    const tx = await weatherOracleContract.authorizeOracle(oracleBot)
    await tx.wait(1)

    log(`Oracle bot ${oracleBot} authorized successfully`)
    log("----------------------------------------------------")
}

module.exports.tags = ["all", "setup"]
