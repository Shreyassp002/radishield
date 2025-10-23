# RadiShield Smart Contracts

RadiShield is a parametric crop insurance platform that provides automated weather-based insurance payouts for farmers in Africa. The system uses smart contracts deployed on the Flare network to deliver transparent, efficient, and trustless insurance coverage.

## Overview

The RadiShield platform consists of two main smart contracts:

- **RadiShield**: The core insurance contract that manages policies, premiums, and payouts
- **WeatherOracle**: A custom oracle contract that provides weather data for insurance trigger evaluation

## Contract Architecture

### RadiShield Contract

The main insurance contract that handles:

- Policy creation and management
- Premium calculation (7% base rate)
- Weather-based payout triggers
- Geographic restrictions to Africa
- Emergency functions for contract administration

### WeatherOracle Contract

A custom oracle solution that:

- Stores weather data on-chain
- Provides fresh weather information for policy evaluation
- Supports batch updates for multiple locations
- Manages authorized oracle operators

## Deployment Information

### Flare Testnet (Coston2)

- **Network**: Flare Testnet (Chain ID: 114)
- **RadiShield**: `0x6e4410795200366439B9c1f567f1AE43D777Dd22`
- **WeatherOracle**: `0x223cb9DFE5d4427cF50d1f33C3a3BaAc3DbE72be`
- **Explorer**: https://coston2.testnet.flarescan.com

## Key Features

### Insurance Parameters

- **Coverage Range**: 1-10 C2FLR per policy
- **Premium Rate**: 7% of coverage amount
- **Duration**: 30 days to 1 year
- **Geographic Scope**: Africa only (latitude: -35° to 37°, longitude: -18° to 52°)

### Weather Triggers

- **Severe Drought**: < 5mm rainfall in 30 days (100% payout)
- **Severe Flood**: > 200mm rainfall in 24 hours (100% payout)
- **Extreme Heatwave**: > 55°C temperature (75% payout)

### Supported Crop Types

- Maize
- Coffee
- Rice
- Wheat
- Sorghum
- And other African crops

## Technical Specifications

### Smart Contract Details

- **Solidity Version**: 0.8.20
- **Framework**: Hardhat
- **Dependencies**: OpenZeppelin Contracts v5.4.0
- **Gas Optimization**: Enabled with 200 runs
- **Security**: ReentrancyGuard, Ownable access control

### Network Configuration

```javascript
flareTestnet: {
    chainId: 114,
    rpcUrl: "https://coston2-api.flare.network/ext/C/rpc",
    blockConfirmations: 3
}
```

## Development Setup

### Prerequisites

- Node.js v16+
- npm or yarn
- Hardhat development environment

### Installation

```bash
cd contract
npm install
```

### Environment Variables

Create a `.env` file with:

```
PRIVATE_KEY=your_private_key
FLARE_TESTNET_RPC_URL=https://coston2-api.flare.network/ext/C/rpc
ETHERSCAN_API_KEY=your_etherscan_api_key
```

### Available Scripts

```bash
# Compile contracts
npm run compile

# Run tests
npm run test
npm run test:flare

# Deploy to Flare testnet
npm run deploy:flare

# Contract size analysis
npm run size

# Code formatting
npm run format
```

## Testing

### Test Coverage

- Unit tests for all contract functions
- Integration tests for weather oracle interaction
- Flare network specific tests
- Gas optimization tests

### Running Tests

```bash
# Local tests
npm run test

# Flare testnet tests
npm run test:flare

# Coverage report
npm run coverage
```

## Deployment

### Flare Testnet Deployment

```bash
npm run deploy:flare
```

The deployment process:

1. Deploys WeatherOracle contract
2. Deploys RadiShield contract with oracle address
3. Authorizes deployer as oracle operator
4. Verifies contracts on Flare explorer

### Contract Verification

Contracts are automatically verified on deployment using:

- Flare Explorer API
- Sourcify for additional verification

## Security Considerations

### Access Control

- Owner-only functions for emergency operations
- Oracle authorization system for weather data updates
- Reentrancy protection on all state-changing functions

### Input Validation

- Comprehensive parameter validation
- Geographic boundary enforcement
- Weather data sanity checks
- Premium calculation safeguards

### Emergency Functions

- Contract pause/unpause capability
- Emergency payout functions
- Batch operations for crisis management
- Fund withdrawal for contract maintenance

## Integration

### Frontend Integration

The contracts provide comprehensive interfaces for:

- Policy creation and management
- Premium calculation
- Weather data requests
- Payout processing

### Oracle Integration

Weather data is provided through:

- Custom WeatherOracle contract
- Authorized oracle operators
- Batch update capabilities
- Data freshness validation

## Gas Optimization

### Efficient Operations

- Optimized storage patterns
- Batch operations support
- Minimal external calls
- Gas-efficient algorithms

### Cost Analysis

- Policy creation: ~200,000 gas
- Weather data update: ~100,000 gas
- Payout processing: ~80,000 gas

## Monitoring and Analytics

### Contract Events

All operations emit comprehensive events for:

- Policy lifecycle tracking
- Weather data updates
- Payout processing
- Administrative actions

### Statistics Functions

Built-in functions provide:

- Total policies and coverage
- Active policy counts
- Claim statistics
- Contract balance monitoring

## Support and Documentation

### Resources

- Contract source code with comprehensive comments
- Deployment scripts and configuration
- Test suite with examples
- Gas usage reports

### Network Information

- Flare Testnet: https://docs.flare.network
- Contract verification: Automated on deployment

## License

This project is licensed under the MIT License.
