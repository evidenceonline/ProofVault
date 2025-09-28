# ProofVault Chrome Extension

A Chrome extension that captures webpage screenshots and generates PDF evidence reports with company and user information.

## Features

- Input company name and user information
- Capture screenshot of current webpage
- Generate PDF with metadata (company, user, timestamp, URL, unique ID)
- Download generated PDF locally
- Remember previously entered company and user data

## Installation

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode" in the top-right corner
3. Click "Load unpacked" and select the `chrome-extension` directory
4. The ProofVault extension should now appear in your Chrome toolbar

## Usage

1. Navigate to the webpage you want to capture
2. Click the ProofVault extension icon in the toolbar
3. Enter the company name and user name
4. Click "Vault it!" to capture the screenshot and generate PDF
5. Click "Download PDF" to save the evidence report

## Files Structure

```
proofvault/
├── chrome-extension/
│   ├── manifest.json - Extension configuration
│   ├── popup.html - Extension popup interface
│   ├── popup.css - Styling for the popup
│   ├── popup.js - Main functionality and PDF generation
│   └── background.js - Background service worker
└── README.md - Project documentation
```

## Future Enhancements

- Integration with backend API
- Cloud storage of evidence reports
- Advanced search and retrieval features