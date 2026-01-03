# VOW Project Structure and Architecture

## Directory Organization

### Root Level Structure
```
/home/ubuntu/Downloads/vow/
├── frontend/          # Next.js React application
├── backend/           # Express.js API server with Prisma ORM
├── docs/              # Project documentation
├── infra/             # Infrastructure configuration (AWS SAM)
├── scripts/           # Deployment and utility scripts
└── .amazonq/          # Amazon Q configuration and rules
```

### Frontend Architecture (`frontend/`)
```
frontend/
├── app/                    # Next.js App Router pages
│   ├── dashboard/         # Main dashboard with components
│   │   ├── components/    # Dashboard-specific components
│   │   └── page.tsx      # Dashboard main page
│   ├── login/            # Authentication pages
│   ├── layout.tsx        # Root layout component
│   └── globals.css       # Global styles
├── lib/                  # Shared utilities and API client
│   ├── api.ts           # API client with error handling
│   ├── format.ts        # Data formatting utilities
│   └── supabaseClient.ts # Database client configuration
└── public/              # Static assets
```

### Backend Architecture (`backend/`)
```
backend/
├── src/
│   ├── runtime/         # Runtime-specific configurations
│   ├── index.ts         # Main Express server and API routes
│   ├── lambda.ts        # AWS Lambda entry point
│   └── migrate.ts       # Database migration runner
├── prisma/
│   ├── migrations/      # Database migration files
│   └── schema.prisma    # Database schema definition
├── scripts/             # Build and deployment scripts
└── dist-bundle/         # Compiled Lambda artifacts
```

## Core Components and Relationships

### Data Layer
- **Prisma ORM**: Database abstraction with type-safe queries
- **MySQL Database**: Primary data storage with user-scoped data isolation
- **Migration System**: Prisma-based schema versioning and deployment

### API Layer
- **Express.js Server**: RESTful API with CORS and authentication middleware
- **Route Handlers**: CRUD operations for Goals, Habits, Activities, and Preferences
- **Authentication**: Temporary X-User-Id header system (planned JWT migration)

### Frontend Layer
- **Next.js App Router**: Server-side rendering with React 19
- **Component Architecture**: Modular dashboard sections and reusable UI components
- **State Management**: SWR for data fetching with optimistic updates
- **API Integration**: Centralized API client with error handling

### Infrastructure Layer
- **AWS SAM**: Infrastructure as Code for Lambda deployment
- **Docker Support**: Containerized development environment
- **Build Pipeline**: TypeScript compilation and Lambda bundling

## Architectural Patterns

### Domain-Driven Design
- **Goal Domain**: Hierarchical goal management with cascade operations
- **Habit Domain**: Activity tracking with flexible scheduling
- **Activity Domain**: Event sourcing for user actions
- **Preference Domain**: Key-value configuration storage

### API Design Patterns
- **RESTful Endpoints**: Standard HTTP methods with resource-based URLs
- **User Scoping**: All operations filtered by authenticated user context
- **Error Handling**: Consistent error responses with detailed debugging information
- **Data Validation**: Input validation with structured error messages

### Frontend Patterns
- **Component Composition**: Reusable UI components with prop-based configuration
- **Data Fetching**: SWR hooks for caching and synchronization
- **Layout Management**: Flexible dashboard sections with user customization
- **Type Safety**: Full TypeScript integration with API type definitions

### Database Patterns
- **Single Tenant per User**: Data isolation through user_id foreign keys
- **JSON Configuration**: Flexible settings storage for habits and preferences
- **Cascade Operations**: Automatic updates across related entities
- **Audit Trail**: Activity logging for user action history

## Integration Points

### Frontend ↔ Backend
- **API Client**: Centralized HTTP client with authentication headers
- **Type Sharing**: Common TypeScript interfaces for data models
- **Error Propagation**: Structured error handling from API to UI

### Backend ↔ Database
- **Prisma Client**: Type-safe database operations with migration support
- **Connection Pooling**: Efficient database connection management
- **Transaction Support**: ACID compliance for complex operations

### Development ↔ Production
- **Environment Configuration**: Separate configs for local, staging, and production
- **Build Artifacts**: Optimized bundles for Lambda deployment
- **Migration Pipeline**: Automated database schema updates