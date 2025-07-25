# ProofVault Frontend

A React-based frontend for the ProofVault blockchain-powered digital notary system.

## Features

- **PDF Verification**: Upload PDF documents or search by hash to verify their authenticity on the blockchain
- **Document Browser**: Browse, search, and filter verified documents with advanced pagination and sorting
- **Analytics Dashboard**: View verification statistics, activity patterns, and blockchain metrics
- **Real-time Updates**: Live status updates for document verification and blockchain confirmations
- **Responsive Design**: Fully responsive UI that works on desktop, tablet, and mobile devices
- **Accessibility**: WCAG 2.1 AA compliant with full keyboard navigation and screen reader support
- **Export Functionality**: Export verification reports in PDF, CSV, and JSON formats

## Technology Stack

- **React 18** with TypeScript for type-safe component development
- **Vite** for fast development and optimized production builds
- **Tailwind CSS** for utility-first styling and responsive design
- **React Query** for efficient data fetching, caching, and synchronization
- **Zustand** for lightweight global state management
- **React Router** for client-side routing
- **Framer Motion** for smooth animations and transitions
- **React Hook Form** with Zod validation for forms
- **Recharts** for data visualization and analytics
- **React Dropzone** for file upload functionality

## Project Structure

```
src/
├── components/          # Reusable UI components
│   ├── FileUpload.tsx   # Drag-and-drop file upload
│   ├── DocumentBrowser.tsx # Document registry browser
│   └── Layout.tsx       # Main application layout
├── pages/              # Page components
│   ├── VerificationPage.tsx  # PDF verification interface
│   ├── DocumentBrowserPage.tsx # Document browsing page
│   └── DashboardPage.tsx     # Analytics dashboard
├── hooks/              # Custom React hooks
│   ├── useVerification.ts    # Verification-related hooks
│   └── useDocuments.ts       # Document management hooks
├── services/           # External service integrations
│   └── apiClient.ts    # Backend API client
├── stores/             # Global state management
│   └── appStore.ts     # Zustand store for app state
├── types/              # TypeScript type definitions
│   └── index.ts        # Core application types
├── utils/              # Utility functions
│   └── index.ts        # Common utility functions
├── test/               # Test configuration
│   └── setup.ts        # Test environment setup
└── assets/             # Static assets (images, icons, etc.)
```

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm 8+

### Installation

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Run tests
npm run test

# Run linting
npm run lint
```

### Environment Configuration

The frontend connects to the backend API through a proxy configuration in `vite.config.ts`. For production, update the API endpoint configuration.

## Key Components

### VerificationPage
The main verification interface allowing users to:
- Upload PDF files for verification
- Search documents by hash
- View detailed verification results
- Access blockchain transaction information

### DocumentBrowser
A comprehensive document registry browser featuring:
- Advanced filtering and search capabilities
- Sortable columns and pagination
- Bulk selection and export functionality
- Real-time status updates

### FileUpload
A drag-and-drop file upload component with:
- PDF validation and size checking
- Progress indicators and error handling
- Accessibility features for keyboard navigation

### Layout
The main application layout providing:
- Responsive navigation sidebar
- Network status indicators
- User authentication state management
- Breadcrumb navigation

## State Management

The application uses Zustand for global state management with the following stores:

- **User State**: Authentication, user profile, and preferences
- **Network State**: Blockchain network information and connection status
- **UI State**: Theme, sidebar visibility, and other UI preferences
- **Recent Activity**: Recently accessed hashes and uploaded documents

## API Integration

The frontend communicates with the backend through a typed API client (`apiClient.ts`) that provides:

- PDF registration and verification endpoints
- Document browsing and search functionality
- User statistics and analytics data
- Real-time status updates via polling
- Proper error handling and retry logic

## Accessibility Features

The application includes comprehensive accessibility features:

- ARIA labels and descriptions for all interactive elements
- Keyboard navigation support for all functionality
- Screen reader compatibility
- High contrast mode support
- Focus management and visual indicators
- Semantic HTML structure

## Performance Optimizations

- Code splitting with dynamic imports
- React Query for efficient data caching
- Optimized bundle sizes with tree shaking
- Lazy loading of non-critical components
- Image optimization and compression
- Service worker for offline capabilities (planned)

## Testing

The project includes a comprehensive testing setup:

- Jest and React Testing Library for unit and integration tests
- Vitest for fast test execution
- Coverage reporting with c8
- Mock implementations for external dependencies

Run tests with:

```bash
npm run test          # Run tests
npm run test:ui       # Run tests with UI
npm run test:coverage # Run with coverage report
```

## Browser Support

- Chrome/Chromium 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## Contributing

1. Follow the established code style and linting rules
2. Write tests for new functionality
3. Ensure accessibility compliance
4. Update documentation for API changes
5. Test responsive design across different screen sizes

## Security Considerations

- All file uploads are validated client-side and server-side
- Sensitive data is never stored in localStorage
- API keys are handled securely through environment variables
- HTTPS is enforced for all network communications
- Content Security Policy headers are implemented