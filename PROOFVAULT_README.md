# ProofVault

> Blockchain-powered digital notary that transforms web screenshots into tamper-proof legal evidence

ProofVault is a comprehensive system that creates **cryptographic digital evidence** for web-captured PDFs using Constellation Network metagraphs. Transform any webpage into legally-defensible digital artifacts with blockchain-backed proof of integrity and immutable timestamps.

## 🚀 Key Features

- **Chrome Extension**: One-click PDF capture from any webpage
- **Cryptographic Hashing**: SHA-256 fingerprinting for tamper detection
- **Blockchain Registration**: Immutable timestamps on Constellation Network
- **Digital Signatures**: Non-repudiation through cryptographic proof
- **Verification Interface**: Public registry for document authentication
- **Legal-Grade Evidence**: Court-admissible digital notarization

## 🏗️ Architecture

```
Chrome Extension → PDF Generation → Cryptographic Hashing → Metagraph Registration → Database Storage → Frontend Registry
```

### Components

- **`chrome-extension/`** - Browser extension for PDF capture and submission
- **`backend-api/`** - Node.js API server bridging client and blockchain
- **`frontend/`** - React-based verification and registry interface  
- **`metagraph/`** - Constellation Network L0/L1 custom implementation
- **`database/`** - PostgreSQL schemas and migrations
- **`docs/`** - Technical documentation and guides

## 📋 System Requirements

- **Node.js** 18+ 
- **PostgreSQL** 13+
- **Docker** (for metagraph deployment)
- **Chrome Browser** (for extension testing)

## 🛠️ Development Setup

1. **Clone repository**
   ```bash
   git clone https://github.com/evidenceonline/ProofVault.git
   cd ProofVault
   ```

2. **Install dependencies**
   ```bash
   # Backend API
   cd backend-api && npm install
   
   # Frontend
   cd ../frontend && npm install
   
   # Chrome Extension  
   cd ../chrome-extension && npm install
   ```

3. **Database setup**
   ```bash
   # Start PostgreSQL
   createdb proofvault
   
   # Run migrations
   cd database && psql proofvault < schema.sql
   ```

4. **Metagraph deployment**
   ```bash
   cd metagraph
   # Follow Tessellation framework setup
   sbt run
   ```

## 🔒 Security Model

- **SHA-256 Hashing**: Prevents content tampering
- **Blockchain Immutability**: Permanent record storage  
- **Digital Signatures**: Cryptographic authenticity proof
- **Merkle Tree Structure**: Chain of custody verification
- **Decentralized Consensus**: No single point of failure

## 📚 Documentation

- [System Design](docs/DESIGN.md) - Technical architecture overview
- [API Reference](docs/API.md) - Backend endpoints documentation  
- [Extension Guide](docs/EXTENSION.md) - Chrome extension usage
- [Deployment Guide](docs/DEPLOYMENT.md) - Production setup instructions

## 🎯 Use Cases

- **Copyright Protection** - Prove creation dates for intellectual property
- **Legal Documentation** - Preserve web evidence for court proceedings  
- **Compliance & Audit** - Tamper-proof regulatory snapshots
- **Journalism** - Verify authenticity of digital sources
- **Research** - Create immutable data capture records

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'feat: add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Built on [Constellation Network](https://constellationnetwork.io/) infrastructure
- Powered by [Tessellation Framework](https://github.com/Constellation-Labs/tessellation)
- Inspired by the need for trustworthy digital evidence

---

**Status**: 🚧 In Development

For questions or support, please open an issue or contact the development team.