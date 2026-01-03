# VOW Technology Stack and Development Setup

## Programming Languages and Versions

### TypeScript/JavaScript
- **TypeScript**: ^5.1.6 (backend), ^5 (frontend)
- **Node.js**: Compatible with AWS Lambda runtime
- **ECMAScript**: Modern ES2020+ features with async/await

### Database
- **MySQL**: 8.0+ (development via Docker Compose)
- **Prisma**: ^5.0.0 (ORM and migration tool)

## Frontend Technology Stack

### Core Framework
- **Next.js**: 16.1.1 (App Router with SSR support)
- **React**: 19.2.3 (latest stable with concurrent features)
- **React DOM**: 19.2.3

### UI and Styling
- **Tailwind CSS**: ^4 (utility-first CSS framework)
- **PostCSS**: ^4 (CSS processing)
- **Headless UI**: ^2.2.9 (accessible UI components)

### Data Management
- **SWR**: ^2.3.8 (data fetching and caching)
- **Supabase**: ^2.89.0 (database client)
- **Date-fns**: ^4.1.0 (date manipulation utilities)

### Specialized Libraries
- **React Day Picker**: ^9.13.0 (calendar components)
- **Flatpickr**: ^4.6.13 (date/time picker)
- **React Flatpickr**: ^4.0.11 (React wrapper)
- **React Markdown**: ^10.1.0 (markdown rendering)
- **Mermaid**: ^10.4.0 (diagram generation)
- **RRule**: ^2.8.1 (recurrence rule parsing)

### Development Tools
- **ESLint**: ^9 (code linting)
- **ESLint Config Next**: 16.1.1 (Next.js specific rules)

## Backend Technology Stack

### Core Framework
- **Express.js**: ^4.18.2 (web application framework)
- **Serverless Express**: ^4.12.0 (AWS Lambda adapter)

### Database and ORM
- **Prisma Client**: ^5.0.0 (type-safe database client)
- **Prisma CLI**: ^5.0.0 (migration and generation tools)

### Authentication and Security
- **JOSE**: ^6.1.3 (JWT handling)
- **JWKS-RSA**: ^3.2.0 (JWT key verification)
- **bcryptjs**: ^3.0.3 (password hashing)
- **CORS**: ^2.8.5 (cross-origin resource sharing)

### AWS Integration
- **AWS SDK Secrets Manager**: ^3.758.0 (secrets management)
- **AWS Lambda Types**: ^8.10.141 (TypeScript definitions)

### Validation and Utilities
- **Zod**: ^3.23.2 (schema validation)
- **Cookie**: ^1.1.1 (cookie parsing)

### Build and Development
- **ESBuild**: ^0.24.2 (fast JavaScript bundler)
- **ts-node-dev**: ^2.0.0 (development server with hot reload)

## Build Systems and Dependencies

### Frontend Build Process
```bash
# Development server
npm run dev          # Next.js development server on port 3000

# Production build
npm run build        # Optimized production build
npm run start        # Production server

# Code quality
npm run lint         # ESLint code analysis
```

### Backend Build Process
```bash
# Development
npm run dev          # ts-node-dev with hot reload on port 4000

# Production builds
npm run build        # TypeScript compilation to dist/
npm run build:bundle # ESBuild bundling for Lambda
npm run build:artifacts # Create deployment artifacts

# Database operations
npm run prisma:generate # Generate Prisma client
npm run prisma:migrate  # Run database migrations
```

### Root Level Scripts
```bash
# Shared dependencies for calendar and Firebase integration
# Installed at root level for cross-project compatibility
```

## Development Environment Setup

### Prerequisites
- Node.js 18+ with npm
- Docker and Docker Compose (for local MySQL)
- AWS CLI (for deployment)

### Local Development
```bash
# Database setup
cd backend
docker-compose up -d    # Start MySQL container
npm run prisma:migrate  # Initialize database schema

# Backend development
npm run dev            # Start API server on port 4000

# Frontend development (separate terminal)
cd ../frontend
npm run dev           # Start Next.js on port 3000
```

### Environment Configuration
- **Frontend**: `.env.local` with `NEXT_PUBLIC_API_URL`
- **Backend**: `.env` with `DATABASE_URL` and other secrets
- **AWS**: Environment-specific configurations in SAM template

### Database Management
- **Development**: Docker Compose MySQL 8.0
- **Migrations**: Prisma migrate dev (with shadow database)
- **Production**: Prisma migrate deploy (no shadow database required)

## Deployment and Infrastructure

### AWS Services
- **Lambda**: Serverless backend execution
- **RDS**: Managed MySQL database
- **Secrets Manager**: Secure configuration storage
- **CloudFormation/SAM**: Infrastructure as Code

### Build Artifacts
- **Frontend**: Static build optimized for CDN deployment
- **Backend**: Lambda-compatible bundles with minimal dependencies
- **Database**: Migration scripts for schema updates

### CI/CD Pipeline
- **GitHub Actions**: Automated testing and deployment
- **AWS SAM CLI**: Infrastructure deployment and management
- **Docker**: Consistent build environments