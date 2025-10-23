# RadiShield Frontend

A modern, responsive web application built with Scaffold-ETH 2 for the RadiShield parametric crop insurance platform. The frontend provides an intuitive interface for African farmers to purchase weather-based insurance policies and manage their coverage on the Flare blockchain.

## Overview

The RadiShield frontend is a Next.js application that enables:

- **Insurance Purchase**: Create parametric crop insurance policies with GPS coordinates
- **Policy Management**: View, monitor, and process insurance claims
- **Weather Integration**: Real-time weather data requests and payout processing
- **Blockchain Interaction**: Seamless integration with Flare Coston2 testnet
- **Wallet Connection**: Support for multiple wallet providers via RainbowKit

## Technology Stack

### Core Framework

- **Next.js 15.2.3**: React framework with App Router
- **React 19.0.0**: Modern React with latest features
- **TypeScript 5.8.2**: Type-safe development
- **Scaffold-ETH 2**: Ethereum development toolkit

### Blockchain Integration

- **Wagmi 2.16.4**: React hooks for Ethereum
- **Viem 2.34.0**: TypeScript Ethereum library
- **RainbowKit 2.2.8**: Wallet connection interface
- **Ethers.js**: Smart contract interactions

### UI/UX

- **Tailwind CSS 4.1.3**: Utility-first CSS framework
- **DaisyUI 5.0.9**: Tailwind CSS components
- **Heroicons**: Beautiful SVG icons
- **Next Themes**: Dark/light theme support

### Development Tools

- **ESLint**: Code linting and formatting
- **Prettier**: Code formatting
- **Husky**: Git hooks for code quality
- **TypeScript**: Static type checking

## Project Structure

```
frontend/
├── packages/
│   ├── nextjs/                 # Main Next.js application
│   │   ├── app/                # App Router pages
│   │   │   ├── page.tsx        # Homepage with platform overview
│   │   │   ├── buy-insurance/  # Insurance purchase flow
│   │   │   ├── my-policies/    # Policy management dashboard
│   │   │   └── layout.tsx      # Root layout component
│   │   ├── components/         # Reusable UI components
│   │   │   ├── Header.tsx      # Navigation header
│   │   │   ├── Footer.tsx      # Site footer
│   │   │   └── scaffold-eth/   # Scaffold-ETH components
│   │   ├── contracts/          # Contract ABIs and addresses
│   │   ├── hooks/              # Custom React hooks
│   │   ├── utils/              # Utility functions
│   │   └── styles/             # Global styles
│   └── hardhat/                # Local development blockchain
└── package.json                # Workspace configuration
```

## Network Configuration

### Flare Coston2 Testnet

- **Chain ID**: 114
- **Native Currency**: C2FLR (Coston2 Flare)
- **RPC URL**: https://coston2-api.flare.network/ext/C/rpc
- **Block Explorer**: https://coston2.testnet.flarescan.com
- **Testnet**: True

### Smart Contracts

- **RadiShield**: `0x6e4410795200366439B9c1f567f1AE43D777Dd22`
- **WeatherOracle**: `0x223cb9DFE5d4427cF50d1f33C3a3BaAc3DbE72be`

## Features

### Homepage

- **Platform Overview**: Introduction to parametric crop insurance
- **Live Statistics**: Real-time contract stats (total policies, active coverage, claims paid)
- **Service Cards**: Insurance purchase and policy management options
- **How It Works**: Step-by-step process explanation
- **Weather Coverage**: Detailed trigger conditions and payout rates

### Insurance Purchase Flow

- **Crop Selection**: Support for major African crops (maize, coffee, tea, rice, etc.)
- **Coverage Configuration**: 1-10 C2FLR coverage with 30-365 day duration
- **GPS Integration**: Location-based insurance with Africa-only restriction
- **Premium Calculator**: Real-time 7% premium calculation
- **Policy Creation**: Blockchain transaction with comprehensive validation

### Policy Management

- **Policy Dashboard**: View all user policies with status indicators
- **Weather Requests**: Manual weather data updates for claims processing
- **Claim Processing**: Automated payout evaluation based on weather triggers
- **Policy Details**: Complete coverage information and remaining duration

### Weather Integration

- **Trigger Conditions**:
  - Severe Drought: <5mm rainfall in 30 days (100% payout)
  - Severe Flood: >200mm rainfall in 24 hours (100% payout)
  - Extreme Heatwave: >55°C temperature (75% payout)
- **Real-time Data**: Integration with weather oracle for automatic processing
- **Manual Triggers**: User-initiated weather checks and claim processing

## Development Setup

### Prerequisites

- **Node.js**: >=20.18.3
- **Yarn**: v3.2.3 (package manager)
- **Git**: Version control

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd RadiShield/frontend

# Install dependencies
yarn install

# Set up environment variables
cp packages/nextjs/.env.example packages/nextjs/.env.local
```

### Environment Configuration

Create `packages/nextjs/.env.local`:

```bash
# Alchemy API Key (optional - for enhanced RPC)
NEXT_PUBLIC_ALCHEMY_API_KEY=your_alchemy_api_key

# WalletConnect Project ID (optional - for wallet connections)
NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID=your_walletconnect_project_id
```

### Available Scripts

```bash
# Development server
yarn start                    # Start Next.js dev server on http://localhost:3000

# Building and deployment
yarn next:build              # Build production application
yarn next:serve              # Serve production build

# Code quality
yarn lint                    # Run ESLint on all packages
yarn format                  # Format code with Prettier
yarn next:check-types        # TypeScript type checking

# Blockchain development
yarn chain                   # Start local Hardhat network
yarn deploy                  # Deploy contracts to local network
yarn compile                 # Compile smart contracts

# Testing
yarn test                    # Run contract tests
yarn hardhat:test           # Run Hardhat tests specifically
```

## Smart Contract Integration

### Contract Hooks

The frontend uses Scaffold-ETH hooks for blockchain interactions:

```typescript
// Read contract data
const { data: contractStats } = useScaffoldReadContract({
  contractName: "RadiShield",
  functionName: "getContractStats",
});

// Write contract transactions
const { writeContractAsync: createPolicy } =
  useScaffoldWriteContract("RadiShield");

// Execute transactions
await createPolicy({
  functionName: "createPolicy",
  args: [cropType, coverage, duration, latitude, longitude],
  value: premium,
});
```

### Contract Configuration

Contracts are automatically configured in `contracts/deployedContracts.ts`:

```typescript
const deployedContracts = {
  114: {  // Flare Coston2 Chain ID
    RadiShield: {
      address: "0x6e4410795200366439B9c1f567f1AE43D777Dd22",
      abi: [...] // Complete contract ABI
    }
  }
};
```

## UI Components

### Design System

- **Color Palette**: Primary (blue), Secondary (purple), Success (green)
- **Typography**: Inter font family with responsive sizing
- **Spacing**: Consistent 8px grid system
- **Animations**: Smooth transitions and hover effects

### Key Components

- **Header**: Responsive navigation with wallet connection
- **Footer**: Network information and development tools
- **Policy Cards**: Interactive policy management interface
- **Form Components**: Insurance purchase workflow
- **Status Indicators**: Policy status and weather triggers

### Responsive Design

- **Mobile-First**: Optimized for mobile devices
- **Breakpoints**: sm (640px), md (768px), lg (1024px), xl (1280px)
- **Touch-Friendly**: Large tap targets and intuitive gestures
- **Progressive Enhancement**: Works without JavaScript

## Wallet Integration

### Supported Wallets

- **MetaMask**: Browser extension and mobile app
- **WalletConnect**: Mobile wallet connections
- **Coinbase Wallet**: Browser and mobile support
- **Rainbow Wallet**: Mobile-first wallet
- **Burner Wallet**: Development testing (local only)

### Network Management

- **Automatic Detection**: Prompts to switch to Flare Coston2
- **Network Addition**: Automatically adds Flare testnet to wallet
- **Balance Display**: Real-time C2FLR balance updates
- **Transaction Tracking**: Complete transaction history

## Performance Optimization

### Build Optimization

- **Code Splitting**: Automatic route-based splitting
- **Tree Shaking**: Unused code elimination
- **Image Optimization**: Next.js automatic image optimization
- **Bundle Analysis**: Webpack bundle analyzer integration

### Runtime Performance

- **React 19**: Latest React features and optimizations
- **Streaming SSR**: Improved server-side rendering
- **Client-Side Caching**: Efficient data fetching and caching
-
- **Progressive Loading**: Skeleton screens and loading states

### SEO and Accessibility

- **Meta Tags**: Comprehensive SEO optimization
- **Open Graph**: Social media sharing optimization
- **Accessibility**: WCAG 2.1 AA compliance
- **Semantic HTML**: Proper HTML structure and landmarks

## Deployment

### Vercel Deployment (Recommended)

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy to Vercel
yarn vercel

# Production deployment
yarn vercel:yolo  # Skip build errors (use carefully)
```

### Environment Variables for Production

Set these in your deployment platform:

```bash
NEXT_PUBLIC_ALCHEMY_API_KEY=your_production_alchemy_key
NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID=your_walletconnect_project_id
NEXT_PUBLIC_IPFS_BUILD=false  # Set to true for IPFS deployment
```

### IPFS Deployment

```bash
# Build and deploy to IPFS
yarn ipfs

# The build will be uploaded to IPFS and provide a CID for access
```

## Testing

### Component Testing

- **React Testing Library**: Component unit tests
- **Jest**: Test runner and assertion library
- **MSW**: API mocking for integration tests

### E2E Testing

- **Playwright**: End-to-end testing framework
- **Wallet Testing**: Automated wallet connection testing
- **Contract Interaction**: Full user flow testing

### Contract Testing

- **Hardhat**: Local blockchain testing
- **Chai**: Assertion library for contract tests
- **Coverage**: Test coverage reporting

## Security Considerations

### Frontend Security

- **Input Validation**: Client-side validation for all user inputs
- **XSS Protection**: Sanitized user content and secure rendering
- **CSRF Protection**: Next.js built-in CSRF protection
- **Content Security Policy**: Strict CSP headers

### Blockchain Security

- **Transaction Validation**: Pre-transaction validation and simulation
- **Error Handling**: Comprehensive error handling for failed transactions
- **Gas Estimation**: Accurate gas estimation with safety margins
- **Network Verification**: Automatic network validation

### Data Privacy

- **No Personal Data**: No personal information stored or transmitted
- **Wallet Privacy**: Only public addresses used
- **Local Storage**: Minimal use of browser storage
- **HTTPS Only**: All communications encrypted

## Monitoring and Analytics

### Performance Monitoring

- **Web Vitals**: Core Web Vitals tracking
- **Error Tracking**: Runtime error monitoring
- **Performance Metrics**: Page load and interaction timing
- **Bundle Analysis**: Regular bundle size monitoring

### User Analytics

- **Usage Patterns**: Anonymous usage analytics
- **Conversion Tracking**: Insurance purchase funnel analysis
- **Error Rates**: Frontend error rate monitoring
- **Network Performance**: Blockchain interaction performance

## Troubleshooting

### Common Issues

#### Wallet Connection Problems

```bash
# Clear browser cache and cookies
# Disable browser extensions temporarily
# Try different wallet or browser
# Check network connection
```

#### Transaction Failures

```bash
# Insufficient C2FLR balance for gas fees
# Network congestion - retry later
# Invalid parameters - check form validation
# Contract interaction errors - check console logs
```

#### Development Issues

```bash
# Clear Next.js cache
rm -rf .next

# Reinstall dependencies
rm -rf node_modules yarn.lock
yarn install

# Reset local blockchain
yarn chain --reset
```

### Debug Mode

Enable debug mode for detailed logging:

```bash
# Set debug environment variable
NEXT_PUBLIC_DEBUG=true yarn start

# Check browser console for detailed logs
# Monitor network tab for API calls
# Use React Developer Tools for component inspection
```

## Contributing

### Development Workflow

1. **Fork Repository**: Create personal fork
2. **Feature Branch**: Create feature-specific branch
3. **Development**: Follow coding standards and conventions
4. **Testing**: Add tests for new features
5. **Pull Request**: Submit PR with detailed description

### Code Standards

- **TypeScript**: Strict type checking enabled
- **ESLint**: Follow configured linting rules
- **Prettier**: Consistent code formatting
- **Conventional Commits**: Structured commit messages

### Component Guidelines

- **Functional Components**: Use React functional components
- **Custom Hooks**: Extract reusable logic into hooks
- **Props Interface**: Define TypeScript interfaces for props
- **Error Boundaries**: Implement error handling

## Browser Support

### Supported Browsers

- **Chrome**: 90+ (recommended)
- **Firefox**: 88+
- **Safari**: 14+
- **Edge**: 90+
- **Mobile Safari**: iOS 14+
- **Chrome Mobile**: Android 90+

### Web3 Requirements

- **MetaMask**: Latest version recommended
- **WalletConnect**: v2 compatible wallets
- **Modern Browser**: ES2020+ support required
- **JavaScript**: Must be enabled

## API Integration

### Weather Oracle Integration

- **Real-time Data**: Live weather data from oracle
- **Automatic Updates**: Scheduled weather checks
- **Manual Triggers**: User-initiated weather requests
- **Error Handling**: Graceful fallback for API failures

### Blockchain RPC

- **Primary RPC**: Flare Coston2 official RPC
- **Fallback RPC**: Alchemy enhanced RPC (optional)
- **Connection Pooling**: Efficient connection management
- **Rate Limiting**: Respectful API usage

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

### Documentation

- **Scaffold-ETH Docs**: https://docs.scaffoldeth.io
- **Next.js Docs**: https://nextjs.org/docs
- **Flare Network Docs**: https://docs.flare.network
- **Wagmi Docs**: https://wagmi.sh

### Community

- **GitHub Issues**: Bug reports and feature requests
- **Discord**: Community support and discussions
- **Twitter**: Updates and announcements

### Development Support

- **Code Reviews**: Peer review process
- **Pair Programming**: Collaborative development sessions
- **Technical Mentoring**: Guidance for new contributors
- **Best Practices**: Shared knowledge and conventions
