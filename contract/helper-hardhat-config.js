const networkConfig = {
    11155111: {
        name: "sepolia",
        usdcToken: "0xA0b86a33E6417c4c2f1C6C5b2b8b8b8b8b8b8b8b", 
    },
    80002: {
        name: "polygonAmoy",
        usdcToken: "0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582",
    },
    114: {
        name: "flareTestnet",
    },
    31337: {
        name: "hardhat",
    },
}

const developmentChains = ["hardhat", "localhost"]
const VERIFICATION_BLOCK_CONFIRMATIONS = 6

module.exports = {
    networkConfig,
    developmentChains,
    VERIFICATION_BLOCK_CONFIRMATIONS,
}
