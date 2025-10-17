const networkConfig = {
    11155111: {
        name: "sepolia",
    },
    80002: {
        name: "polygonAmoy",
        usdcAddress: "0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582",
        linkToken: "0x326C977E6efc84E512bB9C30f76E30c160eD06FB",
        oracle: "0x40193c8518BB267228Fc409a613bDbD8eC5a97b3",
        jobId: "0x7d80a6386f543a107329d716c8c4e5c8",
        fee: "100000000000000000", // 0.1 LINK
    },
    31337: {
        name: "hardhat",
        usdcAddress: "0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582", // Mock for testing
        linkToken: "0x326C977E6efc84E512bB9C30f76E30c160eD06FB", // Mock for testing
        oracle: "0x40193c8518BB267228Fc409a613bDbD8eC5a97b3", // Mock for testing
        jobId: "0x7d80a6386f543a107329d716c8c4e5c8",
        fee: "100000000000000000", // 0.1 LINK
    },
}

const developmentChains = ["hardhat", "localhost"]
const VERIFICATION_BLOCK_CONFIRMATIONS = 6

module.exports = {
    networkConfig,
    developmentChains,
    VERIFICATION_BLOCK_CONFIRMATIONS,
}
