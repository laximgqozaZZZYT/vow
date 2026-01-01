import express from 'express';
import cors from 'cors';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';

const prisma = new PrismaClient();
const app = express();
app.use(cors({ origin: ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:5173', 'http://localhost'] }));
app.use(express.json());

function getUserId(req: express.Request): string | null {
  // Placeholder until real auth: allow scoping by user when provided.
  return req.header('X-User-Id') ?? null;
}

async function getOrCreateDefaultGoal(userId: string | null) {
  // A simple, forward-compatible convention: every user (and anonymous) has an "Inbox" root goal.
  const where = userId ? { userId } : { userId: null };
  const existing = await prisma.goal.findFirst({ where: { ...where, name: 'Inbox', parentId: null }, orderBy: { createdAt: 'asc' } });
  if (existing) return existing;
  return await prisma.goal.create({ data: { name: 'Inbox', details: 'Default goal (auto-created)', parentId: null, userId: userId ?? undefined } as any });
}

app.get('/health', (req, res) => res.json({ ok: true }));

// Simple logger
app.use((req, _res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
  next();
});

// Goals
app.get('/goals', async (req, res) => {
  const userId = getUserId(req);
  const goals = await prisma.goal.findMany({ where: userId ? { userId } : undefined, orderBy: { createdAt: 'asc' } });
  res.json(goals);
});
app.get('/goals/:id', async (req, res) => {
  const id = req.params.id;
  const goal = await prisma.goal.findUnique({ where: { id } });
  if (!goal) return res.status(404).json({ error: 'not found' });
  res.json(goal);
});
app.post('/goals', async (req, res) => {
  const userId = getUserId(req) ?? undefined;
  const { name, details, dueDate, parentId } = req.body;
  const data: any = { name, details, dueDate, parentId };
  if (userId) data.userId = userId;
  const g = await prisma.goal.create({ data });
  res.status(201).json(g);
});
app.patch('/goals/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const data = { ...(req.body || {}) } as any;
    const cascade = !!data.cascade;
    delete data.cascade;

    // Cascade completion: mark this goal + all descendant goals completed,
    // and mark all habits under those goals as "not to be done".
    if (cascade && data.isCompleted === true) {
      const userId = getUserId(req);
      // fetch all goals in scope to compute descendants (simple in-memory BFS)
      const allGoals = await prisma.goal.findMany({ where: userId ? { userId } : undefined, select: { id: true, parentId: true } });
      const childrenByParent = new Map<string, string[]>();
      for (const g of allGoals) {
        const p = g.parentId ?? ''
        const arr = childrenByParent.get(p) ?? []
        arr.push(g.id)
        childrenByParent.set(p, arr)
      }

      const stack: string[] = [id];
      const ids: string[] = [];
      const seen = new Set<string>();
      while (stack.length) {
        const cur = stack.pop()!;
        if (seen.has(cur)) continue;
        seen.add(cur);
        ids.push(cur);
        const kids = childrenByParent.get(cur) ?? [];
        for (const k of kids) stack.push(k);
      }

      const now = new Date();
      await prisma.$transaction([
        prisma.goal.updateMany({ where: { id: { in: ids } }, data: { isCompleted: true } as any }),
        prisma.habit.updateMany({
          where: { goalId: { in: ids } },
          // After a goal is completed, we don't want to do the habits anymore.
          data: { active: false, completed: true, lastCompletedAt: now } as any,
        }),
      ])

      const updated = await prisma.goal.findUnique({ where: { id } });
      return res.json(updated);
    }

    const updated = await prisma.goal.update({ where: { id }, data });
    res.json(updated);
  } catch (e: any) {
    // If this throws (e.g. schema not migrated / unknown column), the frontend would otherwise see "Failed to fetch".
    res.status(500).json({
      error: String(e?.message || e),
      // Prisma puts actionable info here; surface it for debugging.
      code: e?.code,
      meta: e?.meta,
    });
  }
});
app.delete('/goals/:id', async (req, res) => {
  const id = req.params.id;
  await prisma.goal.delete({ where: { id } });
  res.status(204).send();
});

// Habits
app.get('/habits', async (req, res) => {
  try {
    const userId = getUserId(req);
    const habits = await prisma.habit.findMany({ where: userId ? { userId } : undefined, orderBy: { createdAt: 'asc' } as any });
    // MySQL uses real JSON columns for these fields; return as-is.
    res.json(habits);
  } catch (e: any) { res.status(500).json({ error: String(e.message || e) }) }
});
app.get('/habits/:id', async (req, res) => {
  const id = req.params.id;
  try {
    const h = await prisma.habit.findUnique({ where: { id } });
    if (!h) return res.status(404).json({ error: 'not found' });
    // MySQL uses real JSON columns for these fields; return as-is.
    res.json(h);
  } catch (e: any) { res.status(500).json({ error: String(e.message || e) }) }
});
app.post('/habits', async (req, res) => {
  try {
    const userId = getUserId(req);

    // Accept the UI payload as-is but normalize types for Prisma.
    const HabitCreateSchema = z.object({
      name: z.string().min(1).transform((s) => s.trim()).default('Untitled'),
      type: z.enum(['do', 'avoid']).or(z.string().min(1)),
      goalId: z.union([z.string(), z.null(), z.undefined()]).optional(),

      active: z.boolean().optional(),
      count: z.number().int().optional(),
      must: z.number().int().nullable().optional(),
      duration: z.number().int().nullable().optional(),

      reminders: z.any().optional(),
      timings: z.any().optional(),
      outdates: z.any().optional(),

      // UI sends YYYY-MM-DD; Prisma expects DateTime
      dueDate: z.union([z.string(), z.date()]).nullable().optional(),
      lastCompletedAt: z.union([z.string(), z.date()]).nullable().optional(),

      time: z.string().nullable().optional(),
      endTime: z.string().nullable().optional(),
      repeat: z.string().nullable().optional(),
      allDay: z.boolean().nullable().optional(),
      notes: z.string().nullable().optional(),

      workloadUnit: z.string().nullable().optional(),
      workloadTotal: z.number().int().nullable().optional(),
      workloadPerCount: z.number().int().nullable().optional(),

      completed: z.boolean().nullable().optional(),
    }).passthrough();

    const parsed = HabitCreateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid payload', issues: parsed.error.issues });
    }

    const payload = parsed.data as any;

    // Treat empty string as missing.
    if (typeof payload.goalId === 'string' && payload.goalId.trim() === '') {
      delete payload.goalId;
    }

    // Coerce date-like strings.
    const toDateOrUndefined = (v: any) => {
      if (!v) return undefined;
      if (v instanceof Date) return v;
      const d = new Date(String(v));
      return Number.isNaN(d.getTime()) ? undefined : d;
    };
    if (payload.dueDate) payload.dueDate = toDateOrUndefined(payload.dueDate);
    if (payload.lastCompletedAt) payload.lastCompletedAt = toDateOrUndefined(payload.lastCompletedAt);

    if (userId) payload.userId = userId;

    // Allow creating habits without selecting a goal: attach to an auto-created default goal.
    if (!payload.goalId) {
      const g = await getOrCreateDefaultGoal(userId);
      payload.goalId = g.id;
    }

    const h = await prisma.habit.create({ data: payload });
    res.status(201).json(h);
  } catch (e: any) {
    const msg = String(e?.message || e);

    // Make common errors actionable for the UI.
    if (msg.includes('Argument `name`') || msg.includes('Argument `goalId`') || msg.includes('Argument `type`')) {
      return res.status(400).json({
        error: 'Invalid payload: name, goalId, type are required',
        details: msg,
      });
    }
    if (msg.includes('Foreign key constraint violated') && msg.includes('goalId')) {
      return res.status(400).json({
        error: 'Invalid goalId: goal does not exist',
        details: msg,
      });
    }

    return res.status(400).json({ error: msg });
  }
});
app.patch('/habits/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const data = { ...req.body } as any;

    // Support calendar drag/resize updates for a specific timing row.
    // Frontend may send: { dueDate, time, endTime, timingIndex }
    const timingIndexRaw = data.timingIndex;
    delete data.timingIndex;

    const toDateOrUndefined = (v: any) => {
      if (!v) return undefined;
      if (v instanceof Date) return v;
      const d = new Date(String(v));
      return Number.isNaN(d.getTime()) ? undefined : d;
    };

    // Allow UI to pass YYYY-MM-DD strings.
    if (data.dueDate) data.dueDate = toDateOrUndefined(data.dueDate);
    if (data.lastCompletedAt) data.lastCompletedAt = toDateOrUndefined(data.lastCompletedAt);

    // If a timingIndex is provided, update that row in timings JSON too so
    // the calendar uses the new time/endTime on next render.
    if (timingIndexRaw !== undefined) {
      const timingIndex = Number(timingIndexRaw);
      if (!Number.isNaN(timingIndex)) {
        const existing = await prisma.habit.findUnique({ where: { id } });
        if (!existing) return res.status(404).json({ error: 'not found' });
        const timings = Array.isArray((existing as any).timings) ? ([...(existing as any).timings] as any[]) : [];
        if (timings[timingIndex]) {
          const t = { ...(timings[timingIndex] as any) };
          // The UI uses dueDate/time/endTime; timing rows use date/start/end.
          if (typeof data.dueDate !== 'undefined') {
            // data.dueDate is Date here; store as YYYY-MM-DD
            const d = data.dueDate as Date;
            t.date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
          }
          if (typeof data.time !== 'undefined') t.start = data.time;
          if (typeof data.endTime !== 'undefined') t.end = data.endTime;
          timings[timingIndex] = t;
          data.timings = timings;
        }
      }
    }
    const updated = await prisma.habit.update({ where: { id }, data });
    res.json(updated);
  } catch (e: any) { res.status(400).json({ error: String(e.message || e) }) }
});
app.delete('/habits/:id', async (req, res) => {
  const id = req.params.id;
  await prisma.habit.delete({ where: { id } });
  res.status(204).send();
});

// Activities
app.get('/activities', async (req, res) => {
  const acts = await prisma.activity.findMany({ orderBy: { timestamp: 'desc' } });
  res.json(acts);
});
app.post('/activities', async (req, res) => {
  const payload = req.body;
  const userId = getUserId(req);
  if (userId) payload.userId = userId;
  const a = await prisma.activity.create({ data: payload });
  res.status(201).json(a);
});
app.patch('/activities/:id', async (req, res) => {
  const id = req.params.id;
  const updated = await prisma.activity.update({ where: { id }, data: req.body });
  res.json(updated);
});
app.delete('/activities/:id', async (req, res) => {
  const id = req.params.id;
  await prisma.activity.delete({ where: { id } });
  res.status(204).send();
});

// Preferences / Layout
app.get('/prefs', async (req, res) => {
  const userId = getUserId(req);
  const prefs = await prisma.preference.findMany({ where: userId ? { userId } : { userId: null } });
  res.json(prefs.reduce((acc: Record<string, any>, p: any) => { try { acc[p.key] = p.value } catch(e) { acc[p.key] = p.value } return acc }, {} as Record<string, any>));
});
app.post('/prefs', async (req, res) => {
  const { key, value } = req.body;
  const userId = getUserId(req);
  if (!key) return res.status(400).json({ error: 'key required' });
  const stored = (typeof value === 'string') ? value : value;

  // Preference has a compound unique constraint on (key, userId).
  // When userId is absent, we store it as NULL and must use findFirst + update/create.
  if (!userId) {
    const existing = await prisma.preference.findFirst({ where: { key, userId: null } });
    const saved = existing
      ? await prisma.preference.update({ where: { id: existing.id }, data: { value: stored } })
      : await prisma.preference.create({ data: { key, value: stored, userId: null } });
    return res.status(201).json({ key: saved.key, value: saved.value });
  }

  const upsert = await prisma.preference.upsert({
    where: { key_userId: { key, userId } },
    create: { key, value: stored, userId },
    update: { value: stored },
  });
  res.status(201).json({ key: upsert.key, value: upsert.value });
});

// Layout convenience endpoint: save pageSections for a single user-less app
app.get('/layout', async (req, res) => {
  const userId = getUserId(req);

  const p = userId
    ? await prisma.preference.findUnique({ where: { key_userId: { key: 'layout:pageSections', userId } } })
    : await prisma.preference.findFirst({ where: { key: 'layout:pageSections', userId: null } });

  if (!p) return res.json({ sections: ['next', 'activity', 'calendar', 'goals'] });

  // In MySQL, Preference.value is a Json column.
  // It may come back as array, string, or JSON object; normalize to array.
  const raw: any = (p as any).value;
  if (Array.isArray(raw)) return res.json({ sections: raw });
  if (typeof raw === 'string') {
    try { return res.json({ sections: JSON.parse(raw) }) } catch { return res.json({ sections: [raw] }) }
  }
  return res.json({ sections: ['next', 'activity', 'calendar', 'goals'] });
});

app.post('/layout', async (req, res) => {
  const { sections } = req.body;
  if (!Array.isArray(sections)) return res.status(400).json({ error: 'sections must be array' });

  const userId = getUserId(req);
  if (!userId) {
    const existing = await prisma.preference.findFirst({ where: { key: 'layout:pageSections', userId: null } });
    if (existing) {
      await prisma.preference.update({ where: { id: existing.id }, data: { value: sections } });
    } else {
      await prisma.preference.create({ data: { key: 'layout:pageSections', value: sections, userId: null } });
    }
    return res.json({ sections });
  }

  await prisma.preference.upsert({
    where: { key_userId: { key: 'layout:pageSections', userId } },
    create: { key: 'layout:pageSections', value: sections, userId },
    update: { value: sections },
  });
  return res.json({ sections });
});

const port = process.env.PORT ? Number(process.env.PORT) : 4000;
app.listen(port, () => console.log(`Server running on http://localhost:${port}`));
