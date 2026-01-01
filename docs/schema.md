# Data schema（現状の実装）

このドキュメントは、現在このリポジトリに実装されている Prisma スキーマと API が前提にしているデータ構造をまとめます。

- Source of truth: `backend/prisma/schema.prisma`
- API 実装: `backend/src/index.ts`

## 全体像

- `User`
  - 現状は暫定認証（`X-User-Id`）のため `userId` は optional で運用。
  - 将来 JWT 認証へ移行する前提で relation を用意。

- `Goal`
  - ツリー構造（`parentId`）
  - 完了状態: `isCompleted`

- `Habit`
  - `goalId` で Goal に所属
  - スケジューリング/表示設定は JSON（`timings`, `outdates`, `reminders` 等）

- `Activity`
  - 操作履歴（`start|pause|complete|skip` など）
  - リロード後も履歴が残るよう、原則 API に永続化

- `Preference`
  - 任意 key/value（Json）
  - `@@unique([key, userId])`

## Prisma モデル概要（要点）

> 正確なフィールドは `backend/prisma/schema.prisma` を参照してください。

### User

- `id: String @id @default(cuid())`
- `email: String @unique`
- `name: String?`

### Goal

- `id: String @id @default(cuid())`
- `name: String`
- `details: String?`
- `dueDate: DateTime?`
- `isCompleted: Boolean @default(false)`
- `parentId: String?`
- `userId: String?`

### Habit

- `id: String @id @default(cuid())`
- `goalId: String`
- `name: String`
- `active: Boolean @default(true)`
- `type: String`（UI は `do|avoid` を利用）
- JSON: `timings`, `outdates`, `reminders` など
- `userId: String?`

### Activity

- `id: String @id @default(cuid())`
- `kind: String`（例: `start|pause|complete|skip`）
- `habitId: String`
- `habitName: String?`
- `timestamp: DateTime @default(now())`
- `amount/prevCount/newCount/durationSeconds: Int?`
- `userId: String?`

### Preference

- `id: String @id @default(cuid())`
- `key: String`
- `value: Json`
- `userId: String?`

## API とスキーマの対応

- Goals: `GET/POST/PATCH/DELETE /goals`
- Habits: `GET/POST/PATCH/DELETE /habits`
- Activities: `GET/POST/PATCH/DELETE /activities`
- Preferences/Layout: `GET/POST /prefs`, `GET/POST /layout`

## 今後の拡張メモ

- 認証導入後は `userId` を required にし、API 側で所有者チェックを強制する。
- Activity.kind は enum 化するとバリデーションが強くなる（現状は string）。
- Habit の JSON フィールドは必要に応じて正規化（別テーブル化）を検討。
# Data schema（現状の実装）

このドキュメントは、現在このリポジトリに実装されている Prisma スキーマと API が前提にしているデータ構造をまとめます。

- Source of truth: `backend/prisma/schema.prisma`
- API 実装: `backend/src/index.ts`

## 全体像

- `User`
  - 現状は暫定認証（`X-User-Id`）のため `userId` は optional で運用。
  - 将来 JWT 認証へ移行する前提で relation を用意。

- `Goal`
  - ツリー構造（`parentId`）
  - 完了状態: `isCompleted`

- `Habit`
  - `goalId` で Goal に所属
  - スケジューリングや UI 設定は JSON（`timings`, `outdates`, `reminders` 等）

- `Activity`
  - 操作履歴（`start|pause|complete|skip` など）
  - リロード後も履歴が残るよう、原則 API に永続化

- `Preference`
  - 任意 key/value（Json）
  - `@@unique([key, userId])`

## Prisma モデル概要（要点）

> 正確なフィールドは `backend/prisma/schema.prisma` を参照してください。

### User

- `id: String @id @default(cuid())`
- `email: String @unique`
- `name: String?`

### Goal

- `id: String @id @default(cuid())`
- `name: String`
- `details: String?`
- `dueDate: DateTime?`
- `isCompleted: Boolean @default(false)`
- `parentId: String?`
- `userId: String?`

### Habit

- `id: String @id @default(cuid())`
- `goalId: String`
- `name: String`
- `active: Boolean @default(true)`
- `type: String`（UI は `do|avoid` を利用）
- JSON: `timings`, `outdates`, `reminders` など
- `userId: String?`

### Activity

- `id: String @id @default(cuid())`
- `kind: String`（例: `start|pause|complete|skip`）
- `habitId: String`
- `habitName: String?`
- `timestamp: DateTime @default(now())`
- `amount/prevCount/newCount/durationSeconds: Int?`
- `userId: String?`

### Preference

- `id: String @id @default(cuid())`
- `key: String`
- `value: Json`
- `userId: String?`

## API とスキーマの対応

- Goals: `GET/POST/PATCH/DELETE /goals`
- Habits: `GET/POST/PATCH/DELETE /habits`
- Activities: `GET/POST/PATCH/DELETE /activities`
- Preferences/Layout: `GET/POST /prefs`, `GET/POST /layout`

## 今後の拡張メモ

- 認証導入後は `userId` を required にし、API 側で所有者チェックを強制する。
- Activity.kind は enum 化するとバリデーションが強くなる（現状は string）。
- Habit の JSON フィールドは必要に応じて正規化（別テーブル化）を検討。
﻿# Data schema（現状の実装）

このドキュメントは、現在このリポジトリに実装されている Prisma スキーマと API が前提にしているデータ構造をまとめます。

- Source of truth: `backend/prisma/schema.prisma`
- API 実装: `backend/src/index.ts`

## 全体像

- `User`
  - いまは暫定認証（`X-User-Id`）のため `userId` は optional。
  - 将来 JWT 認証を入れる前提で relation は用意している。

- `Goal`
  - ツリー構造（`parentId`）
  - `isCompleted` により完了状態を保持

- `Habit`
  - `goalId` で Goal に所属
  - スケジューリング関連（`timings/outdates/reminders`）は JSON

- `Activity`
  - 望ましい操作履歴（start/pause/complete/skip など）
  - ページリロード後も履歴が残るように API に永続化

- `Preference`
  - 任意の key/value（Json）
  - `@@unique([key, userId])`

## Prisma モデル概略

### User

- `id: String @id @default(cuid())`
- `email: String @unique`
- `name: String?`
- relations: goals/habits/activities/prefs

### Goal

- `id: String @id @default(cuid())`
- `name: String`
- `details: String?`
- `dueDate: DateTime?`
- `isCompleted: Boolean @default(false)`
- `parentId: String?`（tree）
- `userId: String?`

### Habit

- `id: String @id @default(cuid())`
- `goalId: String`
- `name: String`
- `active: Boolean @default(true)`
- `type: String`（UI は `do|avoid` を利用）
- カウント/負荷系: `count`, `must`, `workloadTotal`, `workloadPerCount`, `workloadUnit` など
- スケジュール系: `dueDate`, `time`, `endTime`, `repeat`, `timings(Json?)`, `outdates(Json?)`, `reminders(Json?)`
- 状態系: `completed`, `lastCompletedAt`
- `userId: String?`

### Activity

- `id: String @id @default(cuid())`
- `kind: String`（例: `start|pause|complete|skip`）
- `habitId: String`
- `habitName: String?`
- `timestamp: DateTime @default(now())`
- `amount: Int?`
- `prevCount: Int?`
- `newCount: Int?`
- `durationSeconds: Int?`
- `userId: String?`

### Preference

- `id: String @id @default(cuid())`
- `key: String`
- `value: Json`
- `userId: String?`
- `@@unique([key, userId])`

## API とスキーマの対応

バックエンド API は `backend/src/index.ts` に実装されています。

- Goals
  - `GET /goals`
  - `POST /goals`
  - `PATCH /goals/:id`（`cascade` をサポート）
  - `DELETE /goals/:id`

- Habits
  - `GET /habits`
  - `POST /habits`（goalId 未指定時は `Inbox` を自動作成/紐付け）
  - `PATCH /habits/:id`
  - `DELETE /habits/:id`

- Activities
  - `GET /activities`（timestamp desc）
  - `POST /activities`
  - `PATCH /activities/:id`
  - `DELETE /activities/:id`

- Preferences / Layout
  - `GET /prefs`, `POST /prefs`
  - `GET /layout`, `POST /layout`

## 今後のスキーマ拡張メモ

- 認証導入後は `userId` を required とし、API 側で所有者チェックを強制する。
- Activity の `kind` は enum 化するとバリデーションが強くなる（現状は string）。
- Habit の JSON フィールドは、必要になったタイミングで正規化（別テーブル化）を検討する。

Frame (UI-level concept)
- A `Frame` is a lightweight UI concept that references an `AvailabilitySlot` or similar calendar container. Frames are presented on the calendar as the visual areas where Habits can be placed. Conceptually, Frames map 1:1 to AvailabilitySlot records, but the term `Frame` is useful in the frontend and in popup UX text.
- Frame.type: enum('Blank','Full')
  - Blank: represents empty/free time (maps to AvailabilitySlot.kind = 'free')
  - Full: represents an occupied or blocked time (maps to AvailabilitySlot.kind = 'blocked' or a calendar event)
- Frames are rendered as translucent containers (Blank) or solid/opaque containers (Full) depending on kind. Habits (events) can be overlaid on top of Frames.

Habit (revised to support embedding into Availability)
- id: UUID
- category_id: UUID
- name: string
- active: boolean
- type: enum('do','avoid')
- policy: enum('Schedule','Count')
- count: integer — accumulated count (for Count policy)
- target_count: integer|null — target for Count policy
- completed: boolean
- last_completed_at: timestamp|null
- duration_minutes: integer|null — duration of a single occurrence
- reminders: jsonb|null
- due_date: date|null — anchor date or DTSTART
- time: time|null — preferred start time (may be left null when embedding into availability)
- end_time: time|null
- repeat_label: string|null
- recurrence: jsonb|null — normalized rrule-like object
- timings: jsonb|null — array of Timing entries (see below). Each Timing maps UI Date/Daily/Weekly/Monthly to either a simple record or a cron expression used by scheduler.
- embedPreference: object|null — UI hints about how to embed into availability (see examples)
  - { "embed": true, "preferEarlier": true }
- created_at, updated_at

Behavioral contract (important):
- If Habit.type === 'do' and policy === 'Schedule', the creation UI may request that the server place one or more occurrences into existing AvailabilitySlot(s). The habit payload can include placementHints (see JSON examples) telling the server whether to auto-place into the nearest matching free slot, or to open a placement UI.
- If policy === 'Count', the habit will be scheduled as repeated occurrences: the user indicates a targetCount and the system will create up to targetCount occurrences, distributing them into available `free` slots according to user preferences (one per slot, or multiple per slot). The UI should offer a preview of the resulting placements.
- For both Schedule and Count, placement must respect blocked slots (cannot place into kind='blocked' unless explicitly allowed) and existing events (conflict resolution policy applies).

## Habit popup — Type options (UI change)

- The Habit/New Habit popup should present Type choices using friendly labels:
  - Good: registers the habit as a beneficial habit. Internally this maps to `type: 'do'`.
  - Bad: registers the habit as an undesirable habit. Internally this maps to `type: 'avoid'`.

Behavioral notes for Bad habits:
- Bad (avoid) habits should generally NOT be shown as scheduled events on the calendar. They are tracked for counts and reminders but excluded from calendar placement and the main calendar event stream unless the user explicitly opts into calendar visualization for that habit.

UX notes:
- In the popup, place the Type (Good / Bad) selector near the top, with a short explanation: "Good = add as positive habit (shown on calendar). Bad = track as negative habit (hidden from calendar)."
- If the user chooses Good and the policy is Schedule, allow the same inline flows to create or select Frames (availability) for placement.

Timing / scheduling (new)
- To support more flexible reminders and scheduler integration we introduce a `timings` array on Habit records. Each Timing has the shape:

```json
{
  "type": "Date|Daily|Weekly|Monthly",
  "date": "YYYY-MM-DD", // only for Date type
  "start": "HH:MM",
  "end": "HH:MM",
  "cron": "(optional) cron expression"
}
```

- Server-side, these Timing entries are converted to cron expressions for scheduler/backfill:
  - Date: converted to a one-off cron (with exact date) or handled as a dated event
  - Daily: cron expression on the time of `start` repeating every day
  - Weekly: cron expression with weekday(s) derived from the user input (weekdays selection)
  - Monthly: cron expression recurring monthly on the day-of-month (or by custom rule)

- The frontend UI will continue to present the existing Date/Start/End controls; when the user clicks "Add timing" the UI will append a Timing object derived from the current Date/Start/End/Repeat settings. Multiple Timing entries are supported.

Note: `cron` is optional in the Timing object; server can compute or validate cron from the timing type and times.


## Prisma schema example (habits + availability)

```prisma
model AvailabilitySlot {
  id           String   @id @default(uuid())
  ownerId      String
  name         String?
  kind         SlotKind @default(free)
  date         DateTime?   // single-day slot
  startTime    String     // 'HH:MM'
  endTime      String     // 'HH:MM'
  recurrence   Json?
  allDay       Boolean @default(false)
  color        String?
  displayHint  Json?
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  @@index([ownerId])
}

enum SlotKind {
  free
  blocked
}

model Habit {
  id               String   @id @default(uuid())
  categoryId       String
  name             String
  active           Boolean  @default(true)
  type             HabitType @default(do)
  policy           HabitPolicy @default(Schedule)
  count            Int      @default(0)
  targetCount      Int?
  completed        Boolean  @default(false)
  lastCompletedAt  DateTime?
  durationMinutes  Int?
  reminders        Json?
  dueDate          Date?
  time             String?  // 'HH:MM' preferred
  endTime          String?
  repeatLabel      String?
  recurrence       Json?
  embedPreference  Json?
  notes            String?
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt

  @@index([categoryId])
}

enum HabitType {
  do
  avoid
}

enum HabitPolicy {
  Schedule
  Count
}
```

## SQL (Postgres) DDL (illustrative)

```sql
CREATE TABLE availability_slots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL,
  name TEXT,
  kind TEXT NOT NULL CHECK (kind IN ('free','blocked')),
  date DATE,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  recurrence JSONB,
  all_day BOOLEAN NOT NULL DEFAULT false,
  color TEXT,
  display_hint JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE habits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  type TEXT NOT NULL CHECK (type IN ('do','avoid')),
  policy TEXT NOT NULL CHECK (policy IN ('Schedule','Count')),
  count INTEGER NOT NULL DEFAULT 0,
  target_count INTEGER,
  completed BOOLEAN NOT NULL DEFAULT false,
  last_completed_at TIMESTAMP WITH TIME ZONE,
  duration_minutes INTEGER,
  reminders JSONB,
  due_date DATE,
  time TIME,
  end_time TIME,
  repeat_label TEXT,
  recurrence JSONB,
  embed_preference JSONB,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_availability_owner ON availability_slots(owner_id);
CREATE INDEX idx_habits_category ON habits(category_id);
```

## Default availability (recommended)

When a user first uses the calendar, the system should seed a small set of default free availability slots. These can be edited or removed by the user.

Example default free slots (local times):

```json
[
  { "name": "Morning free", "kind": "free", "start_time": "07:00", "end_time": "08:00" },
  { "name": "Lunch", "kind": "free", "start_time": "12:00", "end_time": "13:00" },
  { "name": "Evening free", "kind": "free", "start_time": "19:00", "end_time": "22:00" }
]
```

## Sample JSON (Habit create with embedding into availability)

Create a Schedule-type Habit and ask the server to place the first occurrence into a matching free availability slot:

```json
{
  "name": "読書",
  "categoryId": "c3",
  "type": "do",
  "policy": "Schedule",
  "durationMinutes": 30,
  "embedPreference": { "embed": true, "strategy": "first-fit", "allowSplit": false },
  "recurrence": { "freq": "DAILY", "interval": 1 },
  "reminders": [{ "kind": "absolute", "time": "20:50", "weekdays": [1,2,3,4,5,6,0] }]
}
```

Server semantics: when `embedPreference.embed` is true the server will attempt to find a `free` AvailabilitySlot on each occurrence date that can contain `durationMinutes` and will create a calendar instance (an Event) anchored to that slot. The response may include the created event IDs or a preview of placements.

Sample JSON (Count policy — schedule N occurrences into available slots):

```json
{
  "name": "運動",
  "categoryId": "c4",
  "type": "do",
  "policy": "Count",
  "targetCount": 10,
  "durationMinutes": 45,
  "embedPreference": { "embed": true, "strategy": "spread", "maxPerSlot": 1 }
}
```

Server semantics: for Count policy with embed set, the server will create up to `targetCount` occurrences distributed across upcoming free availability slots according to `strategy`: e.g., `spread`, `first-fit`, `compact`.

## Availability create from Habit popup

UX requirement: Habit popup and New Habit popup must allow creating a new AvailabilitySlot inline. Payload example for creating availability from the popup:

```json
{
  "createAvailability": {
    "name": "Quick free slot",
    "kind": "free",
    "date": "2026-01-04",
    "start_time": "10:00",
    "end_time": "10:30"
  },
  "habit": { /* habit payload as above */ }
}
```

Behavior: server creates the AvailabilitySlot and then, if `habit.embedPreference.embed` is true, immediately places the habit occurrence into that new slot.

## Calendar rendering guidance (frontend)

- Free availability: render as a translucent/outlined box with low visual weight (no strong color). It should visually indicate "available for placement" but not compete with scheduled events.
- Blocked availability: render as a solid/colored block (similar to events) to indicate the slot is reserved. Use `color` when provided.
- When a new Habit is embedded into a free slot, the created Event/instance should render on top of the free slot with normal event styling; the free slot remains visible beneath as context (optionally reduced opacity when occupied).
- Popups: the Habit create/edit popup must include an option to select one or more existing free slots for placement and an inline flow to create a new AvailabilitySlot.

## API notes (new endpoints)

\# Data schema (current)

This document describes the schema that is currently implemented in `backend/prisma/schema.prisma`.

The system is centered around:

- `Goal` (tree structure + completion)
- `Habit` (belongs to a goal, scheduling metadata stored in JSON)
- `Activity` (audit trail: start/pause/complete/skip etc.)
- `Preference` (key/value JSON settings per user)
- `User` (owner; auth is currently a placeholder using `X-User-Id`)

## Prisma schema (source of truth)

The canonical schema lives in `backend/prisma/schema.prisma`.

### Goal

- `id`: cuid
- `name`: string
- `details`: optional text
- `dueDate`: optional datetime
- `isCompleted`: boolean (default false)
- `parentId`: optional (tree)
- `userId`: optional (until real auth is enforced)

### Habit

- `id`: cuid
- `goalId`: required
- `name`: string
- `active`: boolean (default true)
- `type`: string (`do`/`avoid` used by the UI)
- count/workload fields: `count`, `must`, `workloadTotal`, `workloadPerCount`, etc.
- scheduling metadata: `timings`, `outdates`, `reminders` (JSON)
- status: `completed`, `lastCompletedAt`
- `userId`: optional

### Activity

- `id`: cuid
- `kind`: string (e.g. `start|pause|complete|skip`)
- `habitId`: string
- `habitName`: optional
- `timestamp`: datetime (default now)
- `amount`, `prevCount`, `newCount`, `durationSeconds`: optional ints
- `userId`: optional

### Preference

- `key`: string
- `value`: Json
- `@@unique([key, userId])`

## API representation

The REST API is implemented in `backend/src/index.ts`.

- `GET /goals`, `POST /goals`, `PATCH /goals/:id`, `DELETE /goals/:id`
- `GET /habits`, `POST /habits`, `PATCH /habits/:id`, `DELETE /habits/:id`
- `GET /activities`, `POST /activities`, `PATCH /activities/:id`, `DELETE /activities/:id`
- `GET /prefs`, `POST /prefs`
- `GET /layout`, `POST /layout`

