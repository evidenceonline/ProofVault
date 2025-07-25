# ProofVault Chrome Extension

A Chrome extension that captures web pages as PDFs and generates cryptographic hashes for blockchain-backed evidence creation.

## Features

- **Web Page Capture**: Capture current tab as PDF with one click
- **Cryptographic Hashing**: Generate SHA-256 hashes using Web Crypto API
- **Blockchain Integration**: Submit evidence to ProofVault blockchain network
- **Digital Signatures**: Sign PDFs with private keys for authenticity
- **History Tracking**: Keep track of all captured evidence
- **Verification**: Verify PDF integrity against blockchain records

## Installation

### Development Installation

1. **Build the extension**:
   ```bash
   npm install
   npm run build
   ```

2. **Load in Chrome**:
   - Open Chrome and go to `chrome://extensions/`
   - Enable "Developer mode" in the top right
   - Click "Load unpacked" and select the `chrome-extension/dist` folder

### Production Installation

1. Download from Chrome Web Store (when published)
2. Click "Add to Chrome"

## Usage

### Quick Capture

1. Navigate to any web page
2. Click the ProofVault extension icon in the toolbar
3. Click "Capture Current Page"
4. The extension will:
   - Take a screenshot of the visible area
   - Generate a PDF with metadata
   - Calculate SHA-256 hash
   - Submit to blockchain (if configured)

### Settings Configuration

1. Right-click the extension icon and select "Options" or click the settings gear in the popup
2. Configure:
   - **API Endpoint**: URL of your ProofVault backend
   - **Private Key**: For signing transactions (can generate new one)
   - **Auto-save**: Automatically download PDFs
   - **Auto-submit**: Automatically submit to blockchain

### Verification

1. Click the "Verify" button on any captured evidence
2. Or upload a PDF file to check against blockchain records
3. The extension will confirm authenticity and timestamp

## Development

### Project Structure

```
chrome-extension/
├── src/
│   ├── background.js       # Service worker (main extension logic)
│   ├── popup.js/html       # Extension popup interface
│   ├── options.js/html     # Settings/options page
│   ├── content.js          # Content script for page interaction
│   ├── utils/              # Utility modules
│   │   ├── cryptoUtils.js  # Cryptographic functions
│   │   ├── pdfGenerator.js # PDF creation utilities
│   │   ├── api.js          # Backend API integration
│   │   ├── storage.js      # Chrome storage utilities
│   │   └── helpers.js      # General helper functions
│   ├── styles/             # CSS stylesheets
│   └── icons/              # Extension icons
├── manifest.json           # Extension manifest (V3)
├── webpack.config.js       # Build configuration
└── package.json           # Dependencies and scripts
```

### Available Scripts

- `npm run build` - Build for production
- `npm run dev` - Build for development with watch mode
- `npm test` - Run unit tests
- `npm run lint` - Run ESLint
- `npm run clean` - Clean build directory

### Key Technologies

- **Manifest V3**: Latest Chrome extension format
- **Web Crypto API**: Client-side cryptographic operations
- **jsPDF**: PDF generation from screenshots
- **Webpack**: Module bundling and build process
- **Jest**: Unit testing framework

## API Integration

The extension integrates with the ProofVault backend API:

### Endpoints Used

- `POST /api/pdf/register` - Submit PDF for blockchain registration
- `GET /api/pdf/verify/{hash}` - Verify PDF hash against blockchain
- `GET /api/pdf/history/{address}` - Get submission history
- `POST /api/pdf/validate` - Validate PDF integrity

### Data Flow

```
Web Page → Screenshot → PDF → Hash → Signature → Blockchain → Database
```

## Security Features

- **Client-side Hashing**: SHA-256 hashes generated locally
- **Private Key Storage**: Keys stored locally, never transmitted
- **Digital Signatures**: ECDSA signatures for non-repudiation
- **Content Security Policy**: Strict CSP prevents code injection
- **Minimal Permissions**: Only requests necessary browser permissions

## Permissions Required

- `activeTab` - Capture screenshots of current tab
- `storage` - Store settings and history locally
- `contextMenus` - Add right-click menu options
- `tabs` - Query tab information for metadata

## Browser Compatibility

- Chrome 88+ (Manifest V3 support)
- Chromium-based browsers (Edge, Brave, etc.)

## Privacy

- No user data is collected or transmitted without consent
- PDF content stays local unless explicitly submitted to blockchain
- Private keys are generated and stored locally only
- History can be cleared at any time

## Troubleshooting

### Common Issues

1. **Extension not loading**:
   - Ensure Developer mode is enabled
   - Check console for build errors
   - Verify manifest.json syntax

2. **PDF capture failing**:
   - Check if page allows screenshots (some sites block this)
   - Ensure adequate browser memory
   - Try refreshing the page

3. **Blockchain submission failing**:
   - Verify API endpoint configuration
   - Check network connectivity
   - Ensure private key is properly formatted

4. **Storage quota exceeded**:
   - Clear extension history in options
   - Export data before clearing if needed

### Debug Mode

Enable debug logging in extension options to see detailed operation logs in the browser console.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make changes and add tests
4. Run `npm test` and `npm run lint`
5. Submit a pull request

## License

MIT License - See LICENSE file for details

## Support

- GitHub Issues: [Report bugs or request features](https://github.com/evidenceonline/ProofVault/issues)
- Documentation: [Full API documentation](../README.md)
- Community: Join our Discord for support and discussions