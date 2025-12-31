# Data schema — Habit & Availability

This document defines the backend schema and API/UX contract for Habits and for calendar availability (free/blocked time slots) used by the dashboard UI.

Motivation (per requirements):
- Users should have reusable "availability" slots (default free windows) on their calendar.
- When creating a Habit of type `do` with `Schedule` policy, the UI should allow the user to embed scheduled occurrences into existing free availability slots.
- `Count`-policy habits should be scheduled by repeating into available slots the requested number of times.
- Availability should also support blocked time (meetings, appointments) and be creatable from Habit popups.

The frontend lives under `frontend/app/dashboard/*` and will render availability as translucent/uncolored boxes for free slots and as colored/opaque boxes for blocked slots.

Goals:
- Define concise models for Habit and AvailabilitySlot that support the new embedding/placement workflow.
- Provide example DDL/Prisma models and JSON payloads for common operations.
- Document API endpoints and UI behavior necessary for the frontend changes.

## Contract (brief)
- Input: JSON payloads for Habit and AvailabilitySlot creation/upsert.
- Output: Habit and AvailabilitySlot records with stable `id` and timestamps. For habit creation that requests placement into availability, the API may return one or more concrete calendar instances (materialized occurrences) or references to them.
- Error modes: validation errors (missing/invalid fields), unavailable availability (requested slot doesn't exist), and scheduling conflicts when attempting to place Habit occurrences into blocked time.

## New conceptual types

AvailabilitySlot (represents both free and blocked time ranges)
- id: UUID
- user_id / owner_id: UUID
- name: string (optional) — e.g. "Morning free", "Client meeting"
- kind: enum('free','blocked') — free = available for placing Habits, blocked = reserved time like meetings
- date: date (optional) — the date for single-day slots. For recurring availability use `recurrence`.
- start_time: time (HH:MM)
- end_time: time (HH:MM)
- recurrence: jsonb|null — rrule-like object for repeating availability (freq, interval, byweekday, until, count)
- all_day: boolean
- color: string|null — optional color for blocked slots (UI may ignore color for free)
- opacity / displayHint: optional rendering hints (ui-only)
- created_at, updated_at

Notes:
- Default free availability slots are created when a user initializes their calendar (or can be managed via settings). The app should include sensible defaults: 07:00-08:00, 12:00-13:00, 19:00-22:00 (see examples below).

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

- POST /api/availability
  - Body: AvailabilitySlot payload
  - Returns: 201 created availability slot

- GET /api/availability?ownerId=...
  - Returns: list of availability slots for calendar rendering (both free and blocked)

- POST /api/habits
  - Body: habit payload (may include embedPreference and createAvailability)
  - Behavior: if embedPreference requests placement, the server attempts placement and returns created event/instance references in the response.

- POST /api/habits/:id/place
  - Body: { availabilityId: UUID, date?: date, start_time?: 'HH:MM' }
  - Places a specific occurrence of the habit into the provided availability slot (creates an Event/instance)

Notes on server-side scheduling and conflicts:
- Validate that placements do not overlap blocked slots or existing events unless the user explicitly overrides.
- When a placement cannot be made, return a helpful validation error and a suggested alternative (e.g., next available slot times).

## Validation & edge-cases (expanded)

- Names: empty/blank names should be rejected for Habits and Availability unless a default name is acceptable (e.g., "Untitled slot").
- Time format: 'HH:MM' in 24-hour format.
- Duration: durationMinutes must be positive and less than the slot length when embedding.
- Recurrence shapes: use rrule-like JSON objects and validate fields server-side.
- Placement failures: if embed fails for some occurrences (e.g., not enough free slots for Count target), return partial success with details of which occurrences were placed and which were not.

## Implementation notes / suggestions

- Materialize event instances (a separate `events` or `habit_instances` table) when placing habits into availability; this enables fast calendar reads and easier conflict detection.
- Provide a small server-side utility to expand `recurrence` and match occurrences to `availability_slots` (first-fit/spread strategies).
- For front-end performance, return availability and events in the same calendar query so the UI can layer rendering (availability behind events).

## Next steps / follow-ups

- Create migrations for the new `availability_slots` table and `habit_instances`/events materialization.
- Update frontend components: calendar rendering layer to show translucent free slots and colored blocked slots; update Habit popup to include availability creation and placement UX.
- Add unit tests for placement logic (first-fit, spread) and API contract validation.

Requirements coverage:
- Default availability slots: described and example provided (Done).
- Free slots visual: rendering guidance included (Done).
- Habit type 'Do' embedding into availability for Schedule: schema and payloads described (Done).
- Count policy repetition into availability: described with examples and strategies (Done).
- Inline availability creation from Habit popups: API and payload example provided (Done).

