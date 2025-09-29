# ProofVault Frontend

A modern React/Next.js dashboard for the ProofVault legal evidence management system.

## Features

- **Modern Tech Stack**: Built with Next.js 14, React 18, TypeScript, and Tailwind CSS
- **Professional UI**: Clean, accessible interface designed for legal professionals
- **Real-time Search**: Debounced search with advanced filtering capabilities
- **Data Visualization**: Interactive charts and statistics dashboards
- **Responsive Design**: Mobile-friendly interface that works on all devices
- **Accessibility**: WCAG 2.1 AA compliant with keyboard navigation support
- **PDF Management**: Upload, view, download, and delete PDF evidence
- **Bulk Operations**: Select multiple items for batch download/delete
- **Dark/Light Theme**: Toggle between themes with system preference detection

## Prerequisites

- Node.js 18+ 
- npm or yarn
- ProofVault API running at `http://localhost:4000`

## Installation

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Environment Configuration:**
   The application is pre-configured to work with the ProofVault API. Update `.env.local` if needed:
   ```bash
   NEXT_PUBLIC_API_BASE_URL=http://localhost:4000/api
   NEXT_PUBLIC_APP_NAME=ProofVault
   NEXT_PUBLIC_APP_DESCRIPTION=Legal Evidence Management System
   # Choose one of the following depending on your auth strategy
   NEXT_PUBLIC_PROOFVAULT_API_TOKEN=eyJhbGciOi...
   # or provide an API key mapped to a role on the server
   NEXT_PUBLIC_PROOFVAULT_API_KEY=readonly-key
   ```

3. **Start development server:**
   ```bash
   npm run dev
   ```

4. **Open in browser:**
   Navigate to `http://localhost:4002`

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint
- `npm run type-check` - Check TypeScript types

## Project Structure

```
src/
├── app/                 # Next.js App Router pages
│   ├── evidence/       # Evidence library page
│   ├── upload/         # Upload evidence page
│   ├── layout.tsx      # Root layout
│   ├── page.tsx        # Dashboard home page
│   └── providers.tsx   # React Query provider
├── components/         # Reusable UI components
│   ├── dashboard/      # Dashboard-specific components
│   ├── data-table/     # Data table with sorting/filtering
│   ├── layout/         # Layout components (header, sidebar)
│   ├── pdf/            # PDF-related components
│   ├── search/         # Search and filter components
│   └── ui/             # Base UI components
├── hooks/              # Custom React hooks
├── lib/                # Utility functions and API client
├── services/           # API service layer
└── types/              # TypeScript type definitions
```

## Key Components

### Layout System
- **Header**: Navigation, search, theme toggle, user menu
- **Sidebar**: Main navigation with responsive mobile support
- **Layout**: Combines header and sidebar with proper accessibility

### Data Table
- **Sorting**: Click column headers to sort data
- **Filtering**: Advanced search with multiple criteria
- **Selection**: Checkbox selection for bulk operations
- **Pagination**: Configurable page sizes with navigation

### PDF Management
- **Upload**: Drag-and-drop file upload with validation
- **View**: Detailed modal with metadata and actions
- **Download**: Direct download with proper file naming
- **Delete**: Confirmation dialogs with bulk support

### Dashboard
- **Statistics**: Key metrics with visual indicators
- **Charts**: Interactive data visualizations
- **Recent Activity**: Latest PDF uploads and changes

## API Integration

The frontend communicates with the ProofVault API using:

- **React Query**: Data fetching, caching, and synchronization
- **Custom API Client**: HTTP client with retry logic and error handling
- **TypeScript**: Full type safety for API responses

### Available Endpoints

- `GET /api/pdf/list` - Get paginated PDF list with filtering
- `GET /api/pdf/stats` - Get system statistics
- `GET /api/pdf/:id` - Get PDF metadata
- `GET /api/pdf/:id?download=true` - Download PDF file
- `POST /api/pdf/upload` - Upload new PDF
- `DELETE /api/pdf/:id` - Delete PDF
- `GET /api/health` - API health check

## Accessibility Features

- **Keyboard Navigation**: Full keyboard support for all interactive elements
- **Screen Reader Support**: Proper ARIA labels and semantic HTML
- **High Contrast**: Sufficient color contrast ratios (4.5:1 minimum)
- **Focus Management**: Visible focus indicators and logical tab order
- **Alternative Text**: Descriptive labels for all visual elements

## Responsive Design

- **Mobile First**: Designed for mobile devices first, then enhanced for desktop
- **Breakpoints**: Tailored layouts for different screen sizes
- **Touch Friendly**: Appropriate touch targets and gestures
- **Performance**: Optimized for various network conditions

## Development Guidelines

### Code Style
- Use TypeScript for all components and utilities
- Follow React best practices and hooks patterns
- Implement proper error boundaries and loading states
- Use semantic HTML and proper ARIA attributes

### Performance
- Implement React Query for efficient data fetching
- Use debounced search to reduce API calls
- Lazy load components where appropriate
- Optimize images and assets

### Security
- Validate all user inputs client-side and server-side
- Implement proper error handling without exposing sensitive data
- Use HTTPS in production
- Sanitize file uploads and downloads
- Configure the dashboard with either `NEXT_PUBLIC_PROOFVAULT_API_TOKEN` (JWT) or `NEXT_PUBLIC_PROOFVAULT_API_KEY` so that every request includes the required authentication headers

## Browser Support

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## Contributing

1. Follow the existing code structure and patterns
2. Add proper TypeScript types for new features
3. Include accessibility considerations in UI components
4. Test on multiple browsers and screen sizes
5. Update documentation for significant changes

## Deployment

### Production Build
```bash
npm run build
npm run start
```

### Environment Variables
Set the following in production:
```bash
NEXT_PUBLIC_API_BASE_URL=https://your-api-domain.com/api
NEXT_PUBLIC_APP_NAME=ProofVault
NEXT_PUBLIC_APP_DESCRIPTION=Legal Evidence Management System
```

## License

MIT License - see LICENSE file for details.