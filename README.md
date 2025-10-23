# RadiShield - Parametric Crop Insurance Platform

RadiShield is a blockchain-based parametric crop insurance platform that provides automated weather-triggered payouts for African farmers. Built on the Flare network, it combines smart contracts, real-time weather data, and a user-friendly interface to deliver transparent, efficient, and trustless insurance coverage.

## Mission

Protecting African farmers from climate risks through innovative blockchain technology and automated weather-based insurance payouts.

## System Architecture

### High-Level Architecture

```mermaid
graph TB
    subgraph "RadiShield Platform"
        subgraph "Frontend Layer"
            FE[Next.js Frontend<br/>React + TypeScript<br/>Scaffold-ETH 2]
            WC[Wallet Connection<br/>RainbowKit + Wagmi]
            UI[User Interface<br/>Tailwind CSS + DaisyUI]
        end

        subgraph "Blockchain Layer"
            FC[Flare Coston2 Network<br/>Chain ID: 114]
            RS[RadiShield Contract<br/>0x6e44...Dd22]
            WO[WeatherOracle Contract<br/>0x223c...72be]
        end

        subgraph "Oracle Layer"
            WB[Weather Bot<br/>Railway Deployment]
            ES[Express.js Server<br/>Health Monitoring]
            W3[Web3 Client<br/>Ethers.js Integration]
        end

        subgraph "Data Layer"
            OM[Open-Meteo API<br/>Primary Weather Source]
            WA[WeatherAPI.com<br/>Fallback Source]
            VL[Data Validator<br/>Range & Logic Checks]
        end
    end

    %% Connections
    FE --> WC
    WC --> FC
    FC --> RS
    FC --> WO

    WB --> ES
    WB --> W3
    W3 --> WO

    WB --> OM
    WB --> WA
    WB --> VL

    RS --> WO
```

### Component Interaction Flow

```mermaid
sequenceDiagram
    participant F as Frontend
    participant W as Wallet
    participant R as RadiShield Contract
    participant O as WeatherOracle
    participant B as Weather Bot
    participant A as Weather APIs

    Note over F,A: Policy Creation Flow
    F->>W: Connect Wallet
    F->>F: Validate Form Input
    F->>R: createPolicy(cropType, coverage, duration, lat, lon)
    W->>R: Sign Transaction + Premium Payment
    R->>R: Store Policy Data
    R->>F: Emit PolicyCreated Event

    Note over F,A: Weather Data Flow
    B->>A: Fetch Weather Data
    A->>B: Return Weather Response
    B->>B: Validate & Process Data
    B->>O: updateWeatherData(lat, lon, data)
    O->>O: Store On-Chain
    O->>R: Weather Data Available

    Note over F,A: Claim Processing Flow
    F->>R: requestWeatherData(policyId)
    R->>O: Check Fresh Data
    O->>R: Return Weather Data
    R->>R: Evaluate Triggers
    alt Weather Trigger Met
        R->>R: Calculate Payout
        R->>W: Transfer C2FLR
        R->>F: Emit ClaimPaid Event
    else No Trigger
        R->>F: No Payout Required
    end
```

### Data Flow Architecture

#### 1. Policy Creation Flow

```mermaid
flowchart LR
    subgraph "Frontend"
        A[Farmer Input<br/>• Crop Type<br/>• Coverage Amount<br/>• Duration<br/>• GPS Coordinates]
        B[Form Validation<br/>• Range Checks<br/>• Africa Bounds<br/>• Premium Calc]
    end

    subgraph "Wallet"
        C[MetaMask<br/>• Sign Transaction<br/>• Pay Premium<br/>• Gas Fees]
    end

    subgraph "Blockchain"
        D[RadiShield Contract<br/>• Validate Parameters<br/>• Store Policy<br/>• Emit Events]
        E[Flare Network<br/>• Transaction Mining<br/>• Event Logs<br/>• State Updates]
    end

    A --> B
    B --> C
    C --> D
    D --> E
```

#### 2. Weather Data Flow

```mermaid
flowchart TD
    subgraph "External APIs"
        A[Open-Meteo API]
        B[WeatherAPI.com]
    end

    subgraph "Weather Bot"
        C[Data Fetcher]
        D[Data Validator]
        E[Web3 Client]
    end

    subgraph "Smart Contracts"
        F[WeatherOracle]
        G[RadiShield]
    end

    A --> C
    B --> C
    C --> D
    D --> E
    E --> F
    F --> G
```

#### 3. Claim Processing Flow

```mermaid
flowchart LR
    subgraph "Weather Triggers"
        A[Severe Drought<br/>&lt; 5mm in 30 days<br/>100% Payout]
        B[Severe Flood<br/>&gt; 200mm in 24h<br/>100% Payout]
        C[Extreme Heat<br/>&gt; 55°C temp<br/>75% Payout]
    end

    subgraph "Contract Logic"
        D[Trigger Evaluation<br/>• Compare Thresholds<br/>• Validate Policy<br/>• Check Active Status]
        E[Payout Calculation<br/>• Coverage Amount<br/>• Trigger Percentage<br/>• Balance Check]
    end

    subgraph "Fund Transfer"
        F[C2FLR Transfer<br/>• Smart Contract<br/>• Automatic Execution<br/>• Event Emission]
        G[Farmer Wallet<br/>• Receive Funds<br/>• Updated Balance<br/>• Transaction History]
    end

    A --> D
    B --> D
    C --> D
    D --> E
    E --> F
    F --> G
```

## Key Features

### For Farmers

- Easy policy creation with GPS-based coverage
- Support for major African crops (maize, coffee, tea, rice, wheat)
- Flexible coverage: 1-10 C2FLR with 30-365 day duration
- Automatic payouts without paperwork

### Weather Protection

- **Severe Drought**: <5mm rainfall in 30 days → 100% payout
- **Severe Flood**: >200mm rainfall in 24 hours → 100% payout
- **Extreme Heatwave**: >55°C temperature → 75% payout

### Technical Features

- Parametric insurance with objective weather triggers
- Blockchain transparency on Flare network
- Real-time weather data integration
- Multi-source data validation

## Network Information

### Flare Coston2 Testnet

- **Chain ID**: 114
- **Native Token**: C2FLR (Coston2 Flare)
- **RPC URL**: https://coston2-api.flare.network/ext/C/rpc
- **Explorer**: https://coston2.testnet.flarescan.com

### Deployed Contracts

- **RadiShield**: `0x6e4410795200366439B9c1f567f1AE43D777Dd22`
- **WeatherOracle**: `0x223cb9DFE5d4427cF50d1f33C3a3BaAc3DbE72be`

### Weather Bot Service

- **URL**: https://radishield-production.up.railway.app
- **Health Check**: `/health`
- **Status**: `/status`

## Quick Start

### Prerequisites

- Node.js >=20.18.3
- Yarn v3.2.3
- MetaMask or compatible Web3 wallet
- C2FLR testnet tokens

### Installation

```bash
# Clone the repository
git clone https://github.com/Shreyassp002/radishield
cd RadiShield
```

For detailed setup instructions, check the component-specific documentation:

- [Smart Contracts Setup](./contract/README.md)
- [Frontend Setup](./frontend/README.md)
- [Weather Bot Setup](./weather_bot/README.md)

### Getting Testnet Tokens

1. Add Flare Coston2 testnet to your wallet
2. Get C2FLR from the Flare testnet faucet
3. Connect your wallet to the application
4. Start creating insurance policies

## Project Structure

```
RadiShield/
├── contract/                   # Smart contracts and deployment
├── frontend/                   # Next.js web application
├── weather_bot/               # Weather oracle service
└── README.md                  # This file
```

## Component Documentation

For detailed information about each component, see the respective documentation:

### Smart Contracts

**Location**: `./contract/`
**Documentation**: [Contract README](./contract/README.md)

- Solidity 0.8.20 smart contracts
- RadiShield and WeatherOracle contracts
- Deployment scripts and configuration
- Comprehensive testing suite
- Gas optimization and security features

### Frontend Application

**Location**: `./frontend/`
**Documentation**: [Frontend README](./frontend/README.md)

- Next.js 15 with React 19 and TypeScript
- Scaffold-ETH 2 framework
- Wallet integration with RainbowKit
- Responsive design with Tailwind CSS
- Real-time contract interactions

### Weather Oracle Bot

**Location**: `./weather_bot/`
**Documentation**: [Weather Bot README](./weather_bot/README.md)

- Node.js service deployed on Railway
- Multi-source weather data integration
- Blockchain interaction with Ethers.js
- Data validation and error handling
- Health monitoring and API endpoints

## Geographic Coverage

**Supported Regions**: Africa only

- **Latitude**: -35° to 37°
- **Longitude**: -18° to 52°
- **Coordinate System**: Decimal degrees with 6 decimal precision
- **Validation**: Real-time coordinate validation

## Support

### Documentation

- [Smart Contracts Documentation](./contract/README.md)
- [Frontend Documentation](./frontend/README.md)
- [Weather Bot Documentation](./weather_bot/README.md)

---

**RadiShield** - Protecting African farmers through blockchain innovation and automated weather insurance.
