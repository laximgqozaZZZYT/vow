# Design Document: VOW Project Architecture

## Overview

VOWは、Next.js フロントエンド + Lambda バックエンド + Supabase データベースで構成されるフルスタックWebアプリケーションです。本ドキュメントは、システムアーキテクチャ、コンポーネント構成、データモデルを包括的に説明します。

## Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                    Frontend (Next.js 16 + React 19)                  │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                    App Router Structure                      │   │
│  │  /                 - Landing Page                           │   │
│  │  /login            - Authentication                         │   │
│  │  /dashboard        - Main Application                       │   │
│  │  /demo             - Demo Mode                              │   │
│  │  /embed            - Embeddable Widgets                     │   │
│  │  /settings         - User Settings                          │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                              │ HTTP/REST                            │
└─────────────────────────────────────────────────────────────────────┘
                               │
┌─────────────────────────────────────────────────────────────────────┐
│              Backend API (Lambda + Express + TypeScript)             │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                      API Routes (Express)                    │   │
│  │  /api/health        - Health Check                          │   │
│  │  /api/ai/*          - AI Coach Endpoints                    │   │
│  │  /api/level/*       - THLI-24 Level System                  │   │
│  │  /api/coaching/*    - Workload Coaching                     │   │
│  │  /api/user-level/*  - User Level/XP System                  │   │
│  │  /api/jobs/*        - Scheduled Jobs                        │   │
│  │  /api/slack/*       - Slack Integration                     │   │
│  │  /api/widgets/*     - Embeddable Widgets                    │   │
│  │  /api/notices/*     - Notifications                         │   │
│  │  /api/subscription/*- Subscription Management               │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                              │                                      │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                     Service Layer                            │   │
│  │  aiCoachService      thliAssessmentService                  │   │
│  │  babyStepGenerator   levelManagerService                    │   │
│  │  usageQuotaService   userLevelService                       │   │
│  │  slackService        notificationService                    │   │
│  │  subscriptionService experienceCalculatorService            │   │
│  └─────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
                               │
┌─────────────────────────────────────────────────────────────────────┐
│                    External Services                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │
│  │ Supabase     │  │ OpenAI API   │  │ Slack API    │              │
│  │ PostgreSQL   │  │ (GPT-4)      │  │              │              │
│  │ Auth         │  │              │  │              │              │
│  └──────────────┘  └──────────────┘  └──────────────┘              │
└─────────────────────────────────────────────────────────────────────┘
```

### Deployment Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         AWS Cloud                                    │
│                                                                      │
│  ┌─────────────────┐    ┌─────────────────┐                        │
│  │ AWS Amplify     │    │ API Gateway     │                        │
│  │ (Frontend)      │    │ (REST API)      │                        │
│  │                 │    │                 │                        │
│  │ develop branch  │    │ /development    │                        │
│  │ main branch     │    │ /production     │                        │
│  └─────────────────┘    └────────┬────────┘                        │
│                                  │                                  │
│                         ┌────────▼────────┐                        │
│                         │ Lambda Function │                        │
│                         │ vow-*-api       │                        │
│                         └────────┬────────┘                        │
│                                  │                                  │
│  ┌─────────────────┐    ┌────────▼────────┐                        │
│  │ S3 Bucket       │    │ Secrets Manager │                        │
│  │ (Deployments)   │    │ (API Keys)      │                        │
│  └─────────────────┘    └─────────────────┘                        │
└─────────────────────────────────────────────────────────────────────┘
                               │
┌─────────────────────────────────────────────────────────────────────┐
│                      Supabase Cloud                                  │
│  ┌─────────────────┐    ┌─────────────────┐                        │
│  │ PostgreSQL      │    │ Supabase Auth   │                        │
│  │ (Database)      │    │ (OAuth)         │                        │
│  └─────────────────┘    └─────────────────┘                        │
└─────────────────────────────────────────────────────────────────────┘
```

## Directory Structure

```
vow/
├── frontend/                     # Next.js Application
│   ├── app/
│   │   ├── dashboard/           # Main Dashboard
│   │   │   ├── components/      # UI Components (100+ files)
│   │   │   │   ├── Modal.*.tsx      # Modal dialogs
│   │   │   │   ├── Section.*.tsx    # Page sections
│   │   │   │   ├── Widget.*.tsx     # Reusable widgets
│   │   │   │   ├── Form.*.tsx       # Form components
│   │   │   │   ├── Board.*.tsx      # Board view components
│   │   │   │   ├── Layout.*.tsx     # Layout components
│   │   │   │   └── Mindmap.*.tsx    # Mindmap components
│   │   │   ├── hooks/           # Dashboard-specific hooks
│   │   │   ├── types/           # TypeScript types
│   │   │   ├── utils/           # Utility functions
│   │   │   └── page.tsx         # Dashboard page (main entry)
│   │   ├── demo/                # Demo mode
│   │   ├── embed/               # Embeddable widgets
│   │   ├── login/               # Authentication
│   │   ├── settings/            # User settings
│   │   └── api/                 # Next.js API routes (proxy)
│   ├── lib/                     # Shared utilities
│   │   ├── api.ts               # Unified API client
│   │   ├── supabase.ts          # Supabase client
│   │   └── mindmap/             # Mindmap utilities
│   └── __tests__/               # Test files
│
├── backend/                      # Lambda Backend
│   ├── src/
│   │   ├── index.ts             # Express app entry
│   │   ├── lambda.ts            # Lambda handler
│   │   ├── config.ts            # Configuration
│   │   ├── routers/             # API route handlers
│   │   │   ├── ai.ts            # AI coach routes
│   │   │   ├── level.ts         # THLI-24 routes
│   │   │   ├── userLevel.ts     # User level routes
│   │   │   ├── slackCommands.ts # Slack routes
│   │   │   └── ...
│   │   ├── services/            # Business logic (40+ files)
│   │   │   ├── aiCoachService.ts
│   │   │   ├── thliAssessmentService.ts
│   │   │   ├── babyStepGeneratorService.ts
│   │   │   ├── levelManagerService.ts
│   │   │   ├── userLevelService.ts
│   │   │   ├── slackService.ts
│   │   │   └── ...
│   │   ├── repositories/        # Data access layer
│   │   ├── middleware/          # Express middleware
│   │   ├── schemas/             # Validation schemas
│   │   ├── types/               # TypeScript types
│   │   └── utils/               # Utility functions
│   ├── specs/                   # AI prompts & specs
│   │   └── ai-coach/            # THLI-24 prompts
│   └── scripts/                 # Build scripts
│
├── infra/                        # Infrastructure
│   ├── terraform/               # Terraform configs
│   │   └── modules/             # Terraform modules
│   ├── stacks/                  # CDK stacks
│   └── scripts/                 # Deployment scripts
│
├── supabase/                     # Database
│   └── migrations/              # SQL migrations (100+ files)
│
├── docs/                         # Documentation
│   ├── DEPLOYMENT_GUIDE.md
│   ├── THLI_*.md                # THLI-24 docs
│   └── ...
│
└── .kiro/                        # KIRO Specifications
    ├── specs/                   # Feature specs (53 folders)
    │   ├── {feature-name}/
    │   │   ├── requirements.md
    │   │   ├── design.md
    │   │   └── tasks.md
    │   └── ...
    └── steering/                # Project guidelines
        ├── design-system.md     # UI/UX standards
        └── deployment.md        # Deployment procedures
```

## Data Models

### Core Entities

```typescript
// Goal - 目標
interface Goal {
  id: string;
  name: string;
  details?: string;
  dueDate?: string;
  parentId?: string | null;     // Hierarchical structure
  isCompleted?: boolean;
  tags?: Tag[];
  domainCodes?: string[];       // XP distribution domains
  createdAt: string;
  updatedAt: string;
}

// Habit - 習慣
interface Habit {
  id: string;
  goalId: string;
  name: string;
  active: boolean;
  type: "do" | "avoid";
  count: number;
  must: number;
  completed: boolean;
  lastCompletedAt?: string;
  duration?: number;
  reminders?: Reminder[];
  dueDate?: string;
  time?: string;
  endTime?: string;
  repeat?: string;              // Recurring pattern
  allDay?: boolean;
  notes?: string;
  tags?: Tag[];
  workloadUnit?: string;        // e.g., "km", "pages"
  workloadTotal?: number;       // Total progress
  workloadPerCount?: number;    // Progress per completion
  timings?: Timing[];
  level?: number | null;        // THLI-24 level (0-199)
  levelTier?: LevelTier | null;
  levelAssessedAt?: string;
  domainCodes?: string[];
  createdAt: string;
  updatedAt: string;
}

// Activity - 活動記録
interface Activity {
  id: string;
  kind: 'start' | 'complete' | 'skip' | 'pause';
  habitId: string;
  habitName: string;
  timestamp: string;
  amount?: number;              // Workload increment
  durationSeconds?: number;
  memo?: string;
}

// Tag - タグ
interface Tag {
  id: string;
  name: string;
  color?: string;
  parentId?: string | null;
  createdAt: string;
  updatedAt: string;
}
```

### THLI-24 Level System

```typescript
// Level Assessment
interface LevelAssessment {
  level: number;                // 0-199
  levelTier: 'beginner' | 'intermediate' | 'advanced' | 'expert';
  assessmentData: {
    facts: HabitFacts;          // F01-F16
    variables: THLIVariables;   // 24 variables
    ici: number;                // Information Completeness Index
    oLevel: number;             // Optimistic estimate
    eLevelRange: [number, number]; // Expected range
    cLevel: number;             // Conservative estimate
    promptVersion: string;
  };
  crossFrameworkScores?: {
    tlxScore: number;
    srbaiScore: number;
    combScore: number;
    gateStatus: 'pass' | 'fail';
  };
  assessedAt: string;
}

// Baby Step Plan
interface BabyStepPlan {
  planType: 'lv50' | 'lv10';
  currentLevel: number;
  targetLevel: number;
  proposedChanges: {
    variable: string;
    current: string;
    proposed: string;
    pointsReduced: number;
  }[];
}
```

### User Level System

```typescript
// User Level
interface UserLevel {
  userId: string;
  totalXp: number;
  level: number;
  currentLevelXp: number;
  nextLevelXp: number;
  domainXp: Record<string, number>;  // XP by domain
}

// Experience Log
interface ExperienceLog {
  id: string;
  userId: string;
  habitId: string;
  xpEarned: number;
  multiplier: number;
  reason: string;
  domainCode?: string;
  createdAt: string;
}
```

## API Structure

### Backend API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | Health check |
| POST | `/api/ai/chat` | AI coach chat |
| POST | `/api/ai/suggest` | AI habit suggestions |
| GET | `/api/level/habits/:id` | Get habit level details |
| POST | `/api/level/habits/:id/assess` | Start THLI assessment |
| POST | `/api/level/habits/:id/accept-baby-step` | Accept baby step |
| GET | `/api/level/habits/:id/history` | Get level history |
| GET | `/api/user-level/:userId` | Get user level |
| POST | `/api/user-level/:userId/add-xp` | Add XP |
| GET | `/api/coaching/workload/:habitId` | Get workload coaching |
| POST | `/api/jobs/level-detection` | Run level detection job |
| POST | `/api/slack/commands` | Slack slash commands |
| POST | `/api/slack/interactions` | Slack interactions |
| GET | `/api/slack/oauth/callback` | Slack OAuth callback |
| GET | `/api/widgets/:type` | Get widget data |
| GET | `/api/notices` | Get notifications |
| GET | `/api/subscription/status` | Get subscription status |

### Frontend API Client

Frontend uses unified API client (`lib/api.ts`) that:
- Automatically switches between guest (LocalStorage) and authenticated (Supabase) modes
- Handles authentication headers
- Provides type-safe API calls

```typescript
// Usage example
import { api } from '@/lib/api';

// For authenticated users - calls Supabase
// For guests - uses LocalStorage
const habits = await api.habits.list();
const goal = await api.goals.create({ name: 'New Goal' });
```

## Key Services

### AI Coach Service
- Location: `backend/src/services/aiCoachService.ts`
- Handles chat interactions with OpenAI
- Supports function calling for habit operations
- Uses personalization engine for context

### THLI Assessment Service
- Location: `backend/src/services/thliAssessmentService.ts`
- Implements THLI-24 framework
- Two-pass assessment (Audit → Score)
- Missingness Firewall for data quality

### Baby Step Generator
- Location: `backend/src/services/babyStepGeneratorService.ts`
- Generates Lv.50 and Lv.10 simplified habits
- Applies variable reduction algorithms

### Level Manager Service
- Location: `backend/src/services/levelManagerService.ts`
- Detects level-up/level-down candidates
- Runs scheduled detection jobs

### User Level Service
- Location: `backend/src/services/userLevelService.ts`
- Manages XP and user levels
- Calculates level thresholds

### Slack Service
- Location: `backend/src/services/slackService.ts`
- Handles Slack API interactions
- Processes commands and interactions

## Design System

See `.kiro/steering/design-system.md` for complete guidelines.

### Key Rules
- Use semantic CSS variables (--color-primary, --color-background, etc.)
- 8px spacing scale
- Component naming: Modal.*, Section.*, Widget.*, Form.*, Layout.*
- Mobile-first responsive design
- Dark mode support via class strategy

### Color Tokens
```css
--color-background    /* Main background */
--color-foreground    /* Main text */
--color-card          /* Card background */
--color-primary       /* Primary action */
--color-destructive   /* Danger action */
--color-success       /* Success state */
--color-warning       /* Warning state */
```

## Deployment Flow

See `.kiro/steering/deployment.md` for complete procedures.

### Environments
| Environment | Frontend | Backend | Branch |
|------------|----------|---------|--------|
| Development | develop.do1k9oyyorn24.amplifyapp.com | vow-development-api | develop |
| Production | main.do1k9oyyorn24.amplifyapp.com | vow-production-api | main |

### Deployment Steps
1. Push to `develop` branch
2. Amplify auto-builds frontend
3. Deploy Lambda via `scripts/build-lambda.sh`
4. Verify on development environment
5. Merge to `main` for production
