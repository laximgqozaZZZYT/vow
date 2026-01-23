# Vow Backend (TypeScript)

TypeScript backend for the Vow habit tracking application, built with Hono framework.

## Tech Stack

- **Framework**: [Hono](https://hono.dev/) - Lightweight, ultrafast web framework
- **Validation**: [Zod](https://zod.dev/) - TypeScript-first schema validation
- **Database**: [Supabase](https://supabase.com/) - PostgreSQL with JavaScript client
- **JWT**: [jose](https://github.com/panva/jose) - JWT signing and verification
- **Testing**: [Vitest](https://vitest.dev/) + [fast-check](https://fast-check.dev/) for property-based testing

## Project Structure

```
backend/
├── src/
│   ├── index.ts              # Hono app entry point
│   ├── lambda.ts             # Lambda handler
│   ├── config.ts             # Configuration with Zod
│   ├── middleware/           # Auth, CORS middleware
│   ├── routers/              # HTTP route handlers
│   ├── services/             # Business logic
│   ├── repositories/         # Data access layer
│   ├── schemas/              # Zod validation schemas
│   ├── errors/               # Custom error classes
│   └── utils/                # Utility functions
├── tests/
│   ├── unit/                 # Unit tests
│   └── integration/          # Integration tests
├── package.json
├── tsconfig.json
└── vitest.config.ts
```

## Getting Started

### Prerequisites

- Node.js >= 20.0.0
- npm or yarn

### Installation

```bash
cd backend
npm install
```

### Development

```bash
# Start development server with hot reload
npm run dev

# Type checking
npm run typecheck

# Linting
npm run lint
```

### Testing

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

### Building

```bash
# Build for production
npm run build

# Start production server
npm start
```

## Environment Variables

Create a `.env` file with the following variables:

```env
# Supabase
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
SUPABASE_JWT_SECRET=your_jwt_secret

# Slack
SLACK_CLIENT_ID=your_slack_client_id
SLACK_CLIENT_SECRET=your_slack_client_secret
SLACK_SIGNING_SECRET=your_slack_signing_secret

# Encryption
ENCRYPTION_KEY=your_32_byte_encryption_key

# Server
PORT=3001
NODE_ENV=development
```

## API Endpoints

### Health
- `GET /health` - Health check endpoint

### Slack OAuth
- `GET /api/slack/oauth/authorize` - Start OAuth flow
- `GET /api/slack/oauth/callback` - OAuth callback

### Slack Commands
- `POST /api/slack/commands` - Handle slash commands

### Slack Interactions
- `POST /api/slack/interactions` - Handle interactive components

## Migration from Python

This TypeScript backend is a migration from the Python FastAPI backend. It maintains:
- Same API contracts (endpoints, request/response schemas)
- Same database (Supabase)
- Same environment variables
- Compatible log formats for CloudWatch

## License

MIT
