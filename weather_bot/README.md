# Weather Oracle Bot

A robust weather data oracle service that fetches real-world weather information and updates the RadiShield WeatherOracle smart contract on the Flare network. The bot serves as the critical bridge between external weather APIs and the blockchain-based insurance system.

## Overview

The Weather Oracle Bot is a Node.js application deployed on Railway that:

- Fetches weather data from multiple reliable sources
- Validates and processes weather information
- Updates the WeatherOracle smart contract on Flare Coston2 testnet
- Provides HTTP endpoints for health monitoring and manual triggers
- Ensures data freshness and prevents unnecessary blockchain transactions

## Deployment Information

### Production Environment

- **Platform**: Railway App
- **URL**: https://radishield-production.up.railway.app
- **Network**: Flare Coston2 Testnet (Chain ID: 114)
- **Status**: Active and monitoring weather data requests

### Health Monitoring

- **Health Check**: `/health` - Service status and uptime
- **Status Endpoint**: `/status` - Detailed bot information
- **Weather Endpoint**: `/weather/:lat/:lon` - Manual weather data updates

## Architecture

### Core Components

#### WeatherOracleBot (index.js)

Main orchestrator that coordinates all components:

- Manages weather data fetching with fallback mechanisms
- Handles blockchain interactions
- Validates data integrity
- Provides comprehensive error handling

#### Web3Client (web3Client.js)

Blockchain interaction layer:

- Connects to Flare Coston2 testnet
- Manages wallet and transaction signing
- Updates WeatherOracle smart contract
- Handles gas estimation and transaction confirmation

#### Weather Data Sources

**OpenMeteoClient (openMeteoClient.js)**

- Primary weather data source (free, no API key required)
- Provides 30-day historical rainfall data
- Fetches current temperature readings
- High reliability and comprehensive coverage

**WeatherApiClient (weatherApiClient.js)**

- Fallback weather service (requires API key)
- Limited to 7-day history on free tier
- Provides current weather conditions
- Used when Open-Meteo is unavailable

#### WeatherValidator (weatherValidator.js)

Data validation and sanitization:

- Validates temperature ranges (-100°C to 100°C)
- Checks rainfall data (0-10,000mm for 30-day, 0-1,000mm for 24-hour)
- Ensures logical consistency (24h ≤ 30-day rainfall)
- Validates GPS coordinates and data freshness

### Server (server.js)

Express.js web server providing:

- Health monitoring endpoints for Railway
- Manual weather data update triggers
- Service status reporting
- Graceful shutdown handling

## Configuration

### Environment Variables

```bash
# Weather API Configuration (Optional - Fallback only)
WEATHER_API_KEY=your_weatherapi_key_here

# Blockchain Configuration (Required)
RPC_URL=https://coston2-api.flare.network/ext/C/rpc
PRIVATE_KEY=your_oracle_wallet_private_key
WEATHER_ORACLE_ADDRESS=0x223cb9DFE5d4427cF50d1f33C3a3BaAc3DbE72be

# Environment
NODE_ENV=production

```

### Required Setup

1. **Oracle Wallet**: Must be authorized in the WeatherOracle contract
2. **C2FLR Balance**: Sufficient for transaction fees
3. **Network Access**: Ability to connect to Flare Coston2 RPC
4. **Weather APIs**: Open-Meteo (primary, free) + WeatherAPI (fallback, optional)

## Features

### Intelligent Data Fetching

- **Primary Source**: Open-Meteo Historical API (free, reliable)
- **Fallback Source**: WeatherAPI.com (requires key, limited free tier)
- **Automatic Failover**: Seamlessly switches between sources
- **Data Validation**: Comprehensive validation before blockchain updates

### Blockchain Integration

- **Smart Contract**: WeatherOracle on Flare Coston2
- **Gas Optimization**: Estimates gas with 20% buffer
- **Transaction Monitoring**: Waits for confirmation and logs results
- **Error Handling**: Detailed error messages for common issues

### Data Processing

- **30-Day Rainfall**: Historical precipitation totals
- **24-Hour Rainfall**: Recent daily precipitation
- **Temperature**: Current temperature readings
- **Coordinate Scaling**: Converts GPS coordinates for Solidity compatibility

### Monitoring and Reliability

- **Health Checks**: Periodic blockchain and API connectivity tests
- **Data Freshness**: Prevents unnecessary updates if data is recent
- **Comprehensive Logging**: Detailed operation logs with emojis for clarity
- **Graceful Shutdown**: Proper cleanup on termination signals

## API Endpoints

### Health Monitoring

#### GET /health

Returns service health status for Railway monitoring:

```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "uptime": 3600,
  "initialized": true,
  "lastUpdate": "2024-01-01T00:00:00.000Z",
  "error": null
}
```

#### GET /status

Detailed bot status information:

```json
{
  "service": "Weather Oracle Bot",
  "version": "1.0.0",
  "status": "running",
  "initialized": true,
  "lastUpdate": "2024-01-01T00:00:00.000Z",
  "uptime": 3600
}
```

### Weather Data

#### GET /weather/:lat/:lon

Manually trigger weather data update for specific coordinates:

```bash
curl https://radishield-production.up.railway.app/weather/40.7128/-74.006
```

Response:

```json
{
  "success": true,
  "updated": true,
  "blockchain": {
    "txHash": "0x...",
    "blockNumber": 12345,
    "gasUsed": "150000"
  },
  "weatherData": {
    "rainfall30d": 45.2,
    "rainfall24h": 2.1,
    "temperature": 22.5,
    "source": "open-meteo"
  }
}
```

## Weather Data Specifications

### Data Sources and Coverage

- **Geographic Coverage**: Global (Open-Meteo), 1M+ locations (WeatherAPI)
- **Historical Data**: 30-day rainfall history, current temperature
- **Update Frequency**: On-demand via smart contract events
- **Data Freshness**: 1-hour minimum between updates

### Validation Rules

- **Temperature**: -100°C to 100°C (with warnings for extremes)
- **30-Day Rainfall**: 0mm to 10,000mm
- **24-Hour Rainfall**: 0mm to 1,000mm
- **Logical Consistency**: 24h rainfall ≤ 30-day rainfall
- **Coordinate Validation**: Standard GPS ranges

### Data Processing

- **Precision**: 2 decimal places for weather values
- **Scaling**: GPS coordinates scaled by 10,000 for Solidity
- **Temperature Scaling**: Multiplied by 100 for decimal precision
- **Timestamp**: Unix timestamp in seconds

## Development

### Local Setup

```bash
# Clone and install dependencies
cd weather_bot
npm install

# Configure environment
cp .env.example .env
# Edit .env with your configuration

# Test the bot
npm test

# Run development server
npm run dev
```

### Testing

```bash
# Run full integration test
npm test

# Test specific coordinates
node -e "
const Bot = require('./index');
const bot = new Bot();
bot.updateWeatherOnChain(40.7128, -74.006);
"
```

### Deployment to Railway

The bot is configured for automatic deployment on Railway:

1. **Build**: Uses Nixpacks builder
2. **Start Command**: `npm start`
3. **Health Checks**: `/health` endpoint
4. **Restart Policy**: On failure with 10 max retries
5. **Environment**: Production configuration

## Error Handling

### Common Issues and Solutions

#### Insufficient Funds

```
Error: Insufficient funds for transaction
Solution: Add C2FLR to oracle wallet
```

#### Unauthorized Oracle

```
Error: Oracle not authorized
Solution: Call authorizeOracle() in WeatherOracle contract
```

#### API Failures

```
Error: All weather APIs failed
Solution: Check API keys and network connectivity
```

#### Invalid Coordinates

```
Error: Invalid GPS coordinates
Solution: Ensure lat (-90 to 90) and lon (-180 to 180)
```

## Monitoring and Maintenance

### Health Monitoring

- **Railway Health Checks**: Automatic via `/health` endpoint
- **Blockchain Connectivity**: Tested every 5 minutes
- **API Availability**: Tested on each request with fallback
- **Transaction Status**: Full confirmation tracking

### Operational Metrics

- **Response Time**: Weather data fetch and blockchain update
- **Success Rate**: Percentage of successful updates
- **Gas Usage**: Average transaction costs
- **API Usage**: Request counts and error rates

### Maintenance Tasks

- **Wallet Balance**: Monitor C2FLR balance for transactions
- **API Quotas**: Track usage limits (WeatherAPI free tier)
- **Log Monitoring**: Review error patterns and performance
- **Contract Updates**: Handle WeatherOracle contract upgrades

## Integration with RadiShield

### Smart Contract Integration

- **Contract Address**: `0x223cb9DFE5d4427cF50d1f33C3a3BaAc3DbE72be`
- **Network**: Flare Coston2 Testnet
- **Function**: `updateWeatherData(lat, lon, weatherData)`
- **Events**: Listens for `WeatherDataRequested` events

### Insurance Workflow

1. **Policy Creation**: Farmer creates insurance policy with GPS coordinates
2. **Weather Request**: RadiShield contract requests weather data
3. **Bot Processing**: Weather bot fetches and validates data
4. **Blockchain Update**: Bot updates WeatherOracle contract
5. **Payout Evaluation**: RadiShield checks weather triggers

### Data Flow

```
Weather APIs → Weather Bot → WeatherOracle Contract → RadiShield Contract → Insurance Payouts
```

## Security Considerations

### Wallet Security

- **Private Key**: Stored securely in Railway environment variables
- **Permissions**: Oracle wallet only authorized for weather updates
- **Balance Monitoring**: Alerts for low C2FLR balance

### Data Integrity

- **Multi-Source Validation**: Primary and fallback weather sources
- **Range Validation**: Strict bounds checking on all weather data
- **Logical Validation**: Consistency checks between related values
- **Timestamp Validation**: Ensures data freshness

### Network Security

- **HTTPS Only**: All API communications encrypted
- **Rate Limiting**: Built-in request throttling
- **Error Handling**: No sensitive data in error messages
- **Graceful Degradation**: Continues operation with single API source

## Support and Troubleshooting

### Logs and Debugging

- **Railway Logs**: Comprehensive logging with emoji indicators
- **Transaction Tracking**: Full blockchain transaction details
- **API Response Logging**: Weather data fetch results
- **Error Classification**: Detailed error categorization

### Performance Optimization

- **Data Caching**: Prevents unnecessary API calls
- **Gas Optimization**: Efficient transaction parameters
- **Connection Pooling**: Reuses blockchain connections
- **Timeout Handling**: Prevents hanging requests

## License

This project is licensed under the MIT License.
