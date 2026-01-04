import express from 'express';
import cors from 'cors';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { parse as parseCookie, serialize as serializeCookie } from 'cookie';
import bcrypt from 'bcryptjs';
import { createHash, randomBytes } from 'crypto';
import { jwtVerify, createRemoteJWKSet } from 'jose';
import jwksRsa from 'jwks-rsa';
import { ensureDatabaseUrlFromSecrets } from './runtime/dbUrl';
import DOMPurify from 'dompurify';
import { JSDOM } from 'jsdom';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

let dbUrlEnsured = false;
async function ensureDbUrlOnce() {
  if (dbUrlEnsured) return;
  dbUrlEnsured = true;
  try {
    await ensureDatabaseUrlFromSecrets();
  } catch (e: any) {
    // In local dev we expect DATABASE_URL to be present; in AWS it should be reconstructed.
    console.warn('[db] ensureDatabaseUrlFromSecrets failed', e?.message || e)
  }
}

// Initialize DOMPurify for server-side XSS protection
const window = new JSDOM('').window;
const purify = DOMPurify(window as any);

// Sanitize user input to prevent XSS attacks
function sanitizeInput(input: string): string {
  if (typeof input !== 'string') return '';
  // Remove HTML tags and dangerous characters
  return purify.sanitize(input, { ALLOWED_TAGS: [], ALLOWED_ATTR: [] });
}

const prisma = new PrismaClient();
// NOTE: VS Code TS service can lag behind newly generated Prisma client typings.
// Runtime PrismaClient delegates are correct (verified via node script).
// We use a narrow `any` cast for the new Diary models to keep compilation/editor happy.
const prismaAny = prisma as any
const app = express();

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}));

// Rate limiting for authentication endpoints
const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // limit each IP to 10 requests per windowMs
  message: {
    error: 'Too many authentication attempts, please try again later'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// General rate limiting
const generalRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: {
    error: 'Too many requests, please try again later'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(generalRateLimit);

// Ensure DB URL is available in serverless environments before hit any route.
app.use(async (_req, _res, next) => {
  try {
    await ensureDbUrlOnce();
    next();
  } catch (e) {
    next(e);
  }
});
app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) return callback(null, true);
    
    // Development origins
    const devOrigins = [
      'http://localhost:3000',
      'http://localhost:3001', 
      'http://localhost:5173',
      'http://localhost'
    ];
    
    // Production origins (add your actual production domains)
    const prodOrigins: string[] = [
      // Add your production domains here
      // 'https://yourdomain.com',
      // 'https://www.yourdomain.com'
    ];
    
    const allowedOrigins = process.env.NODE_ENV === 'production' ? prodOrigins : [...devOrigins, ...prodOrigins];
    
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.warn(`CORS blocked origin: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['content-type', 'authorization'],
}));
app.use(express.json());

// Support running behind a reverse proxy that routes the API under /api/* (e.g. CloudFront behavior).
// IMPORTANT: also keep serving routes at '/' for local dev (frontend default is http://localhost:4000).
// This way both /health and /api/health (and the same for /goals etc.) work.
const api = express();
api.use(app);
api.use('/api', app);

const SESSION_COOKIE = 'vow_session';
const SESSION_TTL_DAYS = 30;
const OAUTH_STATE_TTL_MIN = 10;

type OAuthProvider = 'google' | 'github'

function baseUrl(req: express.Request) {
  // Allow override behind proxies.
  const env = process.env.PUBLIC_BASE_URL;
  if (env) return env.replace(/\/+$/, '');
  const proto = (req.headers['x-forwarded-proto'] as string) || 'http';
  const host = req.headers.host;
  return `${proto}://${host}`;
}

function base64Url(buf: Buffer) {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function sha256Base64Url(input: string) {
  const h = createHash('sha256').update(input).digest();
  return base64Url(h);
}

function randomString(bytes = 32) {
  return base64Url(randomBytes(bytes));
}

function getOAuthConfig(provider: OAuthProvider) {
  if (provider === 'google') {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    if (!clientId || !clientSecret) return null;
    return {
      provider,
      clientId,
      clientSecret,
      authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
      tokenUrl: 'https://oauth2.googleapis.com/token',
      // We'll verify the ID token with Google JWKs
      jwksUrl: 'https://www.googleapis.com/oauth2/v3/certs',
      scopes: ['openid', 'email', 'profile'],
    } as const;
  }

  if (provider === 'github') {
    const clientId = process.env.GITHUB_CLIENT_ID;
    const clientSecret = process.env.GITHUB_CLIENT_SECRET;
    if (!clientId || !clientSecret) return null;
    return {
      provider,
      clientId,
      clientSecret,
      authUrl: 'https://github.com/login/oauth/authorize',
      tokenUrl: 'https://github.com/login/oauth/access_token',
      scopes: ['read:user', 'user:email'],
    } as const;
  }

  return null;
}

type Actor =
  | { type: 'guest'; id: string }
  | { type: 'user'; id: string }
  | { type: 'none'; id: null };

declare global {
  // eslint-disable-next-line no-var
  var __supabaseJwksClient: any | undefined;
}

function getBearerToken(req: express.Request): string | null {
  const auth = req.header('authorization') || req.header('Authorization');
  if (!auth) return null;
  const m = auth.match(/^Bearer\s+(.+)$/i);
  return m ? m[1] : null;
}

async function verifySupabaseJwt(token: string): Promise<{ supabaseUserId: string; email?: string; name?: string } | null> {
  const url = process.env.SUPABASE_JWKS_URL;
  const aud = process.env.SUPABASE_JWT_AUD;
  const issuer = process.env.SUPABASE_JWT_ISS;

  if (!url) {
    console.error('[auth] SUPABASE_JWKS_URL not configured');
    return null;
  }

  if (!global.__supabaseJwksClient) {
    global.__supabaseJwksClient = jwksRsa({ 
      jwksUri: url, 
      cache: true, 
      cacheMaxEntries: 5, 
      cacheMaxAge: 10 * 60 * 1000,
      timeout: 30000, // 30 second timeout
      rateLimit: true,
      jwksRequestsPerMinute: 5
    });
  }

  try {
    // Validate JWT structure
    const parts = token.split('.');
    if (parts.length !== 3) {
      throw new Error('Invalid JWT structure');
    }

    // Decode and validate header
    const decodedHeader = JSON.parse(Buffer.from(parts[0], 'base64').toString('utf8'));
    const kid = decodedHeader?.kid;
    if (!kid) throw new Error('JWT missing kid');
    
    // Get signing key
    const key = await global.__supabaseJwksClient.getSigningKey(kid);
    const pem = key.getPublicKey();

    // Verify JWT with strict validation
    const { payload } = await jwtVerify(token, pem as any, {
      ...(aud ? { audience: aud } : {}),
      ...(issuer ? { issuer } : {}),
      clockTolerance: 30, // 30 seconds clock skew tolerance
    });

    // Validate required claims
    const sub = String((payload as any).sub || '');
    if (!sub) throw new Error('JWT missing sub claim');
    
    // Validate token expiration
    const exp = (payload as any).exp;
    if (!exp || exp < Math.floor(Date.now() / 1000)) {
      throw new Error('JWT expired');
    }

    const email = (payload as any).email ? String((payload as any).email).toLowerCase() : undefined;
    const name = (payload as any).user_metadata?.full_name ? String((payload as any).user_metadata.full_name) : undefined;
    
    return { supabaseUserId: sub, email, name };
  } catch (error) {
    console.error('[auth] JWT verification failed:', error);
    return null;
  }
}

function getCookie(req: express.Request, name: string): string | null {
  const raw = req.headers.cookie;
  if (!raw) return null;
  const parsed = parseCookie(raw);
  return parsed?.[name] ?? null;
}

function setSessionCookie(res: express.Response, sessionId: string, expiresAt: Date) {
  // httpOnly so JS can't steal it; SameSite=Lax works for same-site dev.
  // In prod behind HTTPS, set secure: true.
  const cookieSecure = process.env.VOW_COOKIE_SECURE === '1' || process.env.VOW_COOKIE_SECURE === 'true';
  res.setHeader('Set-Cookie', serializeCookie(SESSION_COOKIE, sessionId, {
    httpOnly: true,
    sameSite: 'lax',
    secure: cookieSecure,
    path: '/',
    expires: expiresAt,
  }));
}

function clearSessionCookie(res: express.Response) {
  const cookieSecure = process.env.VOW_COOKIE_SECURE === '1' || process.env.VOW_COOKIE_SECURE === 'true';
  res.setHeader('Set-Cookie', serializeCookie(SESSION_COOKIE, '', {
    httpOnly: true,
    sameSite: 'lax',
    secure: cookieSecure,
    path: '/',
    expires: new Date(0),
  }));
}

async function getActor(req: express.Request, res?: express.Response): Promise<Actor> {
  // 1) Supabase Bearer token (stateless)
  const bearer = getBearerToken(req);
  if (bearer) {
    try {
      const v = await verifySupabaseJwt(bearer);
      if (v?.supabaseUserId) {
        // Map/create app user
        let user = await prisma.user.findUnique({ where: { supabaseUserId: v.supabaseUserId } as any });
        if (!user) {
          // If the user already exists by email (e.g. already used ID/Pass), link it.
          if (v.email) {
            const byEmail = await prisma.user.findUnique({ where: { email: v.email } });
            if (byEmail && !(byEmail as any).supabaseUserId) {
              user = await prisma.user.update({ where: { id: byEmail.id }, data: { supabaseUserId: v.supabaseUserId } as any });
            }
          }
        }
        if (!user) {
          // Create new app user; passwordHash is unused for Supabase users.
          const passwordHash = await bcrypt.hash(randomString(24), 10);
          const sanitizedName = v.name ? sanitizeInput(v.name) : undefined;
          user = await prisma.user.create({
            data: {
              email: v.email || `supabase_${v.supabaseUserId}@example.invalid`,
              passwordHash,
              name: sanitizedName,
              supabaseUserId: v.supabaseUserId,
            } as any,
          });
        }
        return { type: 'user', id: user.id };
      }
    } catch (e) {
      // fallthrough to guest cookie
      console.warn('[auth] supabase jwt verify failed', (e as any)?.message || e);
    }
  }

  // X-User-Id authentication removed for security

  const sessionId = getCookie(req, SESSION_COOKIE);
  if (!sessionId) return { type: 'none', id: null };

  const session = await prisma.session.findUnique({ where: { id: sessionId } });
  if (!session) return { type: 'none', id: null };
  if (session.expiresAt.getTime() < Date.now()) {
    // Expired; treat as none.
    return { type: 'none', id: null };
  }
  if (session.userId) return { type: 'user', id: session.userId };
  if (session.guestId) return { type: 'guest', id: session.guestId };
  return { type: 'none', id: null };
}

async function ensureGuestSession(req: express.Request, res: express.Response): Promise<Actor> {
  const actor = await getActor(req);
  if (actor.type !== 'none') return actor;

  const guest = await prisma.guest.create({ data: {} });
  const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000);
  const session = await prisma.session.create({ data: { guestId: guest.id, expiresAt } });
  setSessionCookie(res, session.id, expiresAt);
  return { type: 'guest', id: guest.id };
}

async function getOrCreateDefaultGoal(actor: Actor) {
  // A simple, forward-compatible convention: every actor has an "Inbox" root goal.
  const where = actor.type === 'none' ? { ownerType: null, ownerId: null } : { ownerType: actor.type, ownerId: actor.id };
  const existing = await prisma.goal.findFirst({ where: { ...where, name: 'Inbox', parentId: null }, orderBy: { createdAt: 'asc' } });
  if (existing) return existing;
  return await prisma.goal.create({ data: { name: 'Inbox', details: 'Default goal (auto-created)', parentId: null, ownerType: where.ownerType ?? undefined, ownerId: where.ownerId ?? undefined } as any });
}

app.get('/health', (req, res) => res.json({ ok: true }));

// Ensure every visitor gets a guest session cookie so dashboard actions are scoped.
app.use(async (req, res, next) => {
  try {
    if (req.path === '/health') return next();
    // If request is already authenticated with Supabase Bearer, don't rotate cookies.
    const bearer = getBearerToken(req);
    if (!bearer) {
      // Keep guest cookie for anonymous usage and for claim flow after OAuth login.
      await ensureGuestSession(req, res);
    }
    next();
  } catch (e) {
    next(e);
  }
});

// Simple logger
app.use((req, _res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
  next();
});

// Goals
app.get('/goals', async (req, res) => {
  const actor = await getActor(req);
  const where = actor.type === 'none' ? {} : { ownerType: actor.type, ownerId: actor.id };
  const goals = await prisma.goal.findMany({ where, orderBy: { createdAt: 'asc' } });
  res.json(goals);
});
app.get('/goals/:id', async (req, res) => {
  const id = req.params.id;
  const actor = await getActor(req);
  const goal = await prisma.goal.findFirst({ where: { id, ...(actor.type === 'none' ? {} : { ownerType: actor.type, ownerId: actor.id }) } as any });
  if (!goal) return res.status(404).json({ error: 'not found' });
  res.json(goal);
});
app.post('/goals', async (req, res) => {
  const actor = await getActor(req);
  const { name, details, dueDate, parentId } = req.body;
  const toDateOrNullOrUndefined = (v: any): Date | null | undefined => {
    // support: undefined (not provided), null (clear), '' (clear), 'YYYY-MM-DD', ISO strings
    if (typeof v === 'undefined') return undefined;
    if (v === null) return null;
    if (typeof v === 'string' && v.trim() === '') return null;
    if (v instanceof Date) return v;
    const d = new Date(String(v));
    return Number.isNaN(d.getTime()) ? undefined : d;
  };

  const data: any = { name, details, parentId };
  if (typeof dueDate !== 'undefined') {
    const parsed = toDateOrNullOrUndefined(dueDate);
    if (typeof parsed === 'undefined' && dueDate !== undefined) {
      return res.status(400).json({ error: 'Invalid dueDate' });
    }
    data.dueDate = parsed;
  }
  if (actor.type !== 'none') {
    data.ownerType = actor.type;
    data.ownerId = actor.id;
  }
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
      const actor = await getActor(req);
      // fetch all goals in scope to compute descendants (simple in-memory BFS)
      const allGoals = await prisma.goal.findMany({
        where: actor.type === 'none' ? {} : { ownerType: actor.type, ownerId: actor.id },
        select: { id: true, parentId: true },
      });
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

    const actor = await getActor(req);
    // Enforce ownership
    const existing = await prisma.goal.findFirst({ where: { id, ...(actor.type === 'none' ? {} : { ownerType: actor.type, ownerId: actor.id }) } as any });
    if (!existing) return res.status(404).json({ error: 'not found' });

    // Normalize date-like strings for Prisma DateTime fields.
    const toDateOrNullOrUndefined = (v: any): Date | null | undefined => {
      if (typeof v === 'undefined') return undefined;
      if (v === null) return null;
      if (typeof v === 'string' && v.trim() === '') return null;
      if (v instanceof Date) return v;
      const d = new Date(String(v));
      return Number.isNaN(d.getTime()) ? undefined : d;
    };
    if (typeof data.dueDate !== 'undefined') {
      const parsed = toDateOrNullOrUndefined(data.dueDate);
      if (typeof parsed === 'undefined') {
        return res.status(400).json({ error: 'Invalid dueDate' });
      }
      data.dueDate = parsed;
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
  const actor = await getActor(req);
  const existing = await prisma.goal.findFirst({ where: { id, ...(actor.type === 'none' ? {} : { ownerType: actor.type, ownerId: actor.id }) } as any });
  if (!existing) return res.status(404).json({ error: 'not found' });
  await prisma.goal.delete({ where: { id } });
  res.status(204).send();
});

// Habits
app.get('/habits', async (req, res) => {
  try {
    const actor = await getActor(req);
    const habits = await prisma.habit.findMany({
      where: actor.type === 'none' ? {} : { ownerType: actor.type, ownerId: actor.id },
      orderBy: { createdAt: 'asc' } as any,
    });
    // MySQL uses real JSON columns for these fields; return as-is.
    res.json(habits);
  } catch (e: any) { res.status(500).json({ error: String(e.message || e) }) }
});
app.get('/habits/:id', async (req, res) => {
  const id = req.params.id;
  try {
    const actor = await getActor(req);
    const h = await prisma.habit.findFirst({ where: { id, ...(actor.type === 'none' ? {} : { ownerType: actor.type, ownerId: actor.id }) } as any });
    if (!h) return res.status(404).json({ error: 'not found' });
    // MySQL uses real JSON columns for these fields; return as-is.
    res.json(h);
  } catch (e: any) { res.status(500).json({ error: String(e.message || e) }) }
});
app.post('/habits', async (req, res) => {
  try {
    const actor = await getActor(req);

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

    if (actor.type !== 'none') {
      payload.ownerType = actor.type;
      payload.ownerId = actor.id;
    }

    // Allow creating habits without selecting a goal: attach to an auto-created default goal.
    if (!payload.goalId) {
      const g = await getOrCreateDefaultGoal(actor);
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
    const actor = await getActor(req);
    const existing = await prisma.habit.findFirst({ where: { id, ...(actor.type === 'none' ? {} : { ownerType: actor.type, ownerId: actor.id }) } as any });
    if (!existing) return res.status(404).json({ error: 'not found' });
    const updated = await prisma.habit.update({ where: { id }, data });
    res.json(updated);
  } catch (e: any) { res.status(400).json({ error: String(e.message || e) }) }
});
app.delete('/habits/:id', async (req, res) => {
  const id = req.params.id;
  const actor = await getActor(req);
  const existing = await prisma.habit.findFirst({ where: { id, ...(actor.type === 'none' ? {} : { ownerType: actor.type, ownerId: actor.id }) } as any });
  if (!existing) return res.status(404).json({ error: 'not found' });
  await prisma.habit.delete({ where: { id } });
  res.status(204).send();
});

// Activities
app.get('/activities', async (req, res) => {
  const actor = await getActor(req);
  const acts = await prisma.activity.findMany({
    where: actor.type === 'none' ? {} : { ownerType: actor.type, ownerId: actor.id },
    orderBy: { timestamp: 'desc' },
  });
  res.json(acts);
});
app.post('/activities', async (req, res) => {
  const payload = req.body;
  const actor = await getActor(req);
  if (actor.type !== 'none') {
    payload.ownerType = actor.type;
    payload.ownerId = actor.id;
  }
  const a = await prisma.activity.create({ data: payload });
  res.status(201).json(a);
});
app.patch('/activities/:id', async (req, res) => {
  const id = req.params.id;
  const actor = await getActor(req);
  const existing = await prisma.activity.findFirst({ where: { id, ...(actor.type === 'none' ? {} : { ownerType: actor.type, ownerId: actor.id }) } as any });
  if (!existing) return res.status(404).json({ error: 'not found' });
  const updated = await prisma.activity.update({ where: { id }, data: req.body });
  res.json(updated);
});
app.delete('/activities/:id', async (req, res) => {
  const id = req.params.id;
  const actor = await getActor(req);
  const existing = await prisma.activity.findFirst({ where: { id, ...(actor.type === 'none' ? {} : { ownerType: actor.type, ownerId: actor.id }) } as any });
  if (!existing) return res.status(404).json({ error: 'not found' });
  await prisma.activity.delete({ where: { id } });
  res.status(204).send();
});

// Preferences / Layout
app.get('/prefs', async (req, res) => {
  const actor = await getActor(req);
  const prefs = await prisma.preference.findMany({ where: actor.type === 'none' ? {} : { ownerType: actor.type, ownerId: actor.id } });
  res.json(prefs.reduce((acc: Record<string, any>, p: any) => { try { acc[p.key] = p.value } catch(e) { acc[p.key] = p.value } return acc }, {} as Record<string, any>));
});
app.post('/prefs', async (req, res) => {
  const { key, value } = req.body;
  const actor = await getActor(req);
  if (!key) return res.status(400).json({ error: 'key required' });
  const stored = (typeof value === 'string') ? value : value;

  // Preference has a compound unique constraint on (key, ownerType, ownerId).
  const ownerType = actor.type === 'none' ? null : actor.type;
  const ownerId = actor.type === 'none' ? null : actor.id;
  const existing = await prisma.preference.findFirst({ where: { key, ownerType, ownerId } as any });
  const saved = existing
    ? await prisma.preference.update({ where: { id: existing.id }, data: { value: stored } })
    : await prisma.preference.create({ data: { key, value: stored, ownerType: ownerType ?? undefined, ownerId: ownerId ?? undefined } as any });
  return res.status(201).json({ key: saved.key, value: saved.value });
});

// Layout convenience endpoint: save pageSections for a single user-less app
app.get('/layout', async (req, res) => {
  const actor = await getActor(req);

  const p = await prisma.preference.findFirst({
    where: {
      key: 'layout:pageSections',
      ...(actor.type === 'none' ? {} : { ownerType: actor.type, ownerId: actor.id }),
    } as any,
  });

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

  const actor = await getActor(req);
  const ownerType = actor.type === 'none' ? null : actor.type;
  const ownerId = actor.type === 'none' ? null : actor.id;
  const existing = await prisma.preference.findFirst({ where: { key: 'layout:pageSections', ownerType, ownerId } as any });
  if (existing) {
    await prisma.preference.update({ where: { id: existing.id }, data: { value: sections } });
  } else {
    await prisma.preference.create({ data: { key: 'layout:pageSections', value: sections, ownerType: ownerType ?? undefined, ownerId: ownerId ?? undefined } as any });
  }
  return res.json({ sections });
});

// Diary
const DiaryTagCreateSchema = z.object({
  name: z.string().min(1).max(60).transform(s => s.trim()),
  color: z.string().max(30).optional().nullable(),
}).passthrough()

app.get('/diary/tags', async (req, res) => {
  const actor = await getActor(req)
  const where = actor.type === 'none' ? {} : { ownerType: actor.type, ownerId: actor.id }
  const tags = await prismaAny.diaryTag.findMany({ where, orderBy: { createdAt: 'asc' } as any })
  res.json(tags)
})

app.post('/diary/tags', async (req, res) => {
  const actor = await getActor(req)
  const parsed = DiaryTagCreateSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: 'invalid payload', issues: parsed.error.issues })
  const data: any = { ...parsed.data }
  if (actor.type !== 'none') {
    data.ownerType = actor.type
    data.ownerId = actor.id
  }
  try {
    const tag = await prismaAny.diaryTag.create({ data })
    res.status(201).json(tag)
  } catch (e: any) {
    res.status(400).json({ error: String(e?.message || e), code: e?.code, meta: e?.meta })
  }
})

app.patch('/diary/tags/:id', async (req, res) => {
  const id = req.params.id
  const actor = await getActor(req)
  const whereOwner = actor.type === 'none' ? {} : { ownerType: actor.type, ownerId: actor.id }
  const existing = await prismaAny.diaryTag.findFirst({ where: { id, ...(whereOwner as any) } as any })
  if (!existing) return res.status(404).json({ error: 'not found' })

  const updateSchema = DiaryTagCreateSchema.partial()
  const parsed = updateSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: 'invalid payload', issues: parsed.error.issues })
  const data: any = { ...parsed.data }
  if (typeof data.name === 'string') data.name = data.name.trim()
  try {
    const tag = await prismaAny.diaryTag.update({ where: { id }, data })
    res.json(tag)
  } catch (e: any) {
    res.status(400).json({ error: String(e?.message || e), code: e?.code, meta: e?.meta })
  }
})

app.delete('/diary/tags/:id', async (req, res) => {
  const id = req.params.id
  const actor = await getActor(req)
  const whereOwner = actor.type === 'none' ? {} : { ownerType: actor.type, ownerId: actor.id }
  const existing = await prismaAny.diaryTag.findFirst({ where: { id, ...(whereOwner as any) } as any })
  if (!existing) return res.status(404).json({ error: 'not found' })
  await prismaAny.diaryTag.delete({ where: { id } })
  res.status(204).send()
})

const DiaryCardCreateSchema = z.object({
  frontMd: z.string().optional().default(''),
  backMd: z.string().optional().default(''),
  tagIds: z.array(z.string()).optional().default([]),
  goalIds: z.array(z.string()).optional().default([]),
  habitIds: z.array(z.string()).optional().default([]),
}).passthrough()

function normalizeStringArray(v: any): string[] {
  if (!Array.isArray(v)) return []
  const out = v.map(x => String(x)).map(s => s.trim()).filter(Boolean)
  return Array.from(new Set(out))
}

app.get('/diary', async (req, res) => {
  const actor = await getActor(req)
  const whereOwner = actor.type === 'none' ? {} : { ownerType: actor.type, ownerId: actor.id }

  const q = (req.query.query ? String(req.query.query) : '').trim()
  const tagIds = normalizeStringArray(req.query.tag)
  const goalIds = normalizeStringArray(req.query.goal)
  const habitIds = normalizeStringArray(req.query.habit)

  // NOTE: MySQL string contains is case-insensitive with typical collations.
  const where: any = { ...whereOwner }
  if (q) {
    where.OR = [
      { frontMd: { contains: q } },
      { backMd: { contains: q } },
    ]
  }
  if (tagIds.length) where.tags = { some: { tagId: { in: tagIds } } }
  if (goalIds.length) where.goals = { some: { goalId: { in: goalIds } } }
  if (habitIds.length) where.habits = { some: { habitId: { in: habitIds } } }

  const cards = await prismaAny.diaryCard.findMany({
    where,
    orderBy: { updatedAt: 'desc' } as any,
    include: {
      tags: true,
      goals: true,
      habits: true,
    } as any,
  })
  res.json(cards)
})

app.get('/diary/:id', async (req, res) => {
  const id = req.params.id
  const actor = await getActor(req)
  const whereOwner = actor.type === 'none' ? {} : { ownerType: actor.type, ownerId: actor.id }
  const card = await prismaAny.diaryCard.findFirst({
    where: { id, ...(whereOwner as any) } as any,
    include: { tags: true, goals: true, habits: true } as any,
  })
  if (!card) return res.status(404).json({ error: 'not found' })
  res.json(card)
})

app.post('/diary', async (req, res) => {
  const actor = await getActor(req)
  const parsed = DiaryCardCreateSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: 'invalid payload', issues: parsed.error.issues })
  const data = parsed.data as any

  const tagIds = normalizeStringArray(data.tagIds)
  const goalIds = normalizeStringArray(data.goalIds)
  const habitIds = normalizeStringArray(data.habitIds)

  const ownerType = actor.type === 'none' ? null : actor.type
  const ownerId = actor.type === 'none' ? null : actor.id

  // Validate ownership for referenced Goal/Habit/Tag (best-effort)
  if (ownerType && ownerId) {
    if (tagIds.length) {
      const count = await prismaAny.diaryTag.count({ where: { id: { in: tagIds }, ownerType, ownerId } as any })
      if (count !== tagIds.length) return res.status(400).json({ error: 'invalid tagIds' })
    }
    if (goalIds.length) {
      const count = await prisma.goal.count({ where: { id: { in: goalIds }, ownerType, ownerId } as any })
      if (count !== goalIds.length) return res.status(400).json({ error: 'invalid goalIds' })
    }
    if (habitIds.length) {
      const count = await prisma.habit.count({ where: { id: { in: habitIds }, ownerType, ownerId } as any })
      if (count !== habitIds.length) return res.status(400).json({ error: 'invalid habitIds' })
    }
  }

  const card = await prismaAny.diaryCard.create({
    data: {
      frontMd: String(data.frontMd ?? ''),
      backMd: String(data.backMd ?? ''),
      ...(ownerType ? { ownerType } : {}),
      ...(ownerId ? { ownerId } : {}),
      tags: tagIds.length ? { create: tagIds.map(tagId => ({ tagId, ...(ownerType ? { ownerType } : {}), ...(ownerId ? { ownerId } : {}) })) } : undefined,
      goals: goalIds.length ? { create: goalIds.map(goalId => ({ goalId, ...(ownerType ? { ownerType } : {}), ...(ownerId ? { ownerId } : {}) })) } : undefined,
      habits: habitIds.length ? { create: habitIds.map(habitId => ({ habitId, ...(ownerType ? { ownerType } : {}), ...(ownerId ? { ownerId } : {}) })) } : undefined,
    } as any,
    include: { tags: true, goals: true, habits: true } as any,
  })
  res.status(201).json(card)
})

app.patch('/diary/:id', async (req, res) => {
  const id = req.params.id
  const actor = await getActor(req)
  const whereOwner = actor.type === 'none' ? {} : { ownerType: actor.type, ownerId: actor.id }
  const existing = await prismaAny.diaryCard.findFirst({ where: { id, ...(whereOwner as any) } as any })
  if (!existing) return res.status(404).json({ error: 'not found' })

  const updateSchema = DiaryCardCreateSchema.partial()
  const parsed = updateSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: 'invalid payload', issues: parsed.error.issues })
  const data = parsed.data as any

  const ownerType = actor.type === 'none' ? null : actor.type
  const ownerId = actor.type === 'none' ? null : actor.id

  const tagIds = (data.tagIds !== undefined) ? normalizeStringArray(data.tagIds) : null
  const goalIds = (data.goalIds !== undefined) ? normalizeStringArray(data.goalIds) : null
  const habitIds = (data.habitIds !== undefined) ? normalizeStringArray(data.habitIds) : null

  // validate references
  if (ownerType && ownerId) {
    if (tagIds && tagIds.length) {
      const count = await prismaAny.diaryTag.count({ where: { id: { in: tagIds }, ownerType, ownerId } as any })
      if (count !== tagIds.length) return res.status(400).json({ error: 'invalid tagIds' })
    }
    if (goalIds && goalIds.length) {
      const count = await prisma.goal.count({ where: { id: { in: goalIds }, ownerType, ownerId } as any })
      if (count !== goalIds.length) return res.status(400).json({ error: 'invalid goalIds' })
    }
    if (habitIds && habitIds.length) {
      const count = await prisma.habit.count({ where: { id: { in: habitIds }, ownerType, ownerId } as any })
      if (count !== habitIds.length) return res.status(400).json({ error: 'invalid habitIds' })
    }
  }

  const updated = await prisma.$transaction(async (tx) => {
    const txAny = tx as any
    // Update content
    await txAny.diaryCard.update({
      where: { id },
      data: {
        ...(data.frontMd !== undefined ? { frontMd: String(data.frontMd ?? '') } : {}),
        ...(data.backMd !== undefined ? { backMd: String(data.backMd ?? '') } : {}),
      } as any,
    })

    // Replace relations if provided
    if (tagIds !== null) {
      await txAny.diaryCardTag.deleteMany({ where: { cardId: id } as any })
      if (tagIds.length) {
        await txAny.diaryCardTag.createMany({
          data: tagIds.map(tagId => ({
            cardId: id,
            tagId,
            ...(ownerType ? { ownerType } : {}),
            ...(ownerId ? { ownerId } : {}),
          })) as any,
          skipDuplicates: true,
        })
      }
    }
    if (goalIds !== null) {
      await txAny.diaryCardGoal.deleteMany({ where: { cardId: id } as any })
      if (goalIds.length) {
        await txAny.diaryCardGoal.createMany({
          data: goalIds.map(goalId => ({
            cardId: id,
            goalId,
            ...(ownerType ? { ownerType } : {}),
            ...(ownerId ? { ownerId } : {}),
          })) as any,
          skipDuplicates: true,
        })
      }
    }
    if (habitIds !== null) {
      await txAny.diaryCardHabit.deleteMany({ where: { cardId: id } as any })
      if (habitIds.length) {
        await txAny.diaryCardHabit.createMany({
          data: habitIds.map(habitId => ({
            cardId: id,
            habitId,
            ...(ownerType ? { ownerType } : {}),
            ...(ownerId ? { ownerId } : {}),
          })) as any,
          skipDuplicates: true,
        })
      }
    }

    return await txAny.diaryCard.findUnique({ where: { id }, include: { tags: true, goals: true, habits: true } as any })
  })

  res.json(updated)
})

app.delete('/diary/:id', async (req, res) => {
  const id = req.params.id
  const actor = await getActor(req)
  const whereOwner = actor.type === 'none' ? {} : { ownerType: actor.type, ownerId: actor.id }
  const existing = await prismaAny.diaryCard.findFirst({ where: { id, ...(whereOwner as any) } as any })
  if (!existing) return res.status(404).json({ error: 'not found' })
  await prismaAny.diaryCard.delete({ where: { id } })
  res.status(204).send()
})

// Auth
app.get('/me', async (req, res) => {
  const actor = await getActor(req);
  res.json({ actor });
});

const RegisterSchema = z.object({
  email: z.string().email().transform((s) => s.toLowerCase().trim()),
  password: z.string().min(8),
  name: z.string().min(1).max(100).optional(),
});

async function mergeGuestIntoUser(guestId: string, userId: string) {
  // Move all guest-owned records to user.
  await prisma.$transaction([
    prisma.goal.updateMany({ where: { ownerType: 'guest', ownerId: guestId }, data: { ownerType: 'user', ownerId: userId } }),
    prisma.habit.updateMany({ where: { ownerType: 'guest', ownerId: guestId }, data: { ownerType: 'user', ownerId: userId } }),
    prisma.activity.updateMany({ where: { ownerType: 'guest', ownerId: guestId }, data: { ownerType: 'user', ownerId: userId } }),
    prisma.preference.updateMany({ where: { ownerType: 'guest', ownerId: guestId }, data: { ownerType: 'user', ownerId: userId } }),
    prisma.guest.update({ where: { id: guestId }, data: { mergedIntoUserId: userId, mergedAt: new Date() } }),
  ]);
}

async function exchangeToken(url: string, body: Record<string, string>, acceptJson = true) {
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      ...(acceptJson ? { 'Accept': 'application/json' } : {}),
    },
    body: new URLSearchParams(body).toString(),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`token exchange failed: HTTP ${res.status} ${res.statusText}: ${text}`);
  try { return JSON.parse(text) } catch { return text }
}

async function githubGetUser(accessToken: string) {
  const res = await fetch('https://api.github.com/user', {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'User-Agent': 'vow',
      'Accept': 'application/vnd.github+json',
    }
  });
  if (!res.ok) throw new Error(`github user fetch failed: ${res.status}`);
  return await res.json();
}

app.post('/auth/register', authRateLimit, async (req, res) => {
  const parsed = RegisterSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'invalid payload', issues: parsed.error.issues });

  const { email, password, name } = parsed.data;
  const actor = await getActor(req);

  // Sanitize user input to prevent XSS
  const sanitizedName = name ? sanitizeInput(name) : null;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return res.status(409).json({ error: 'email already in use' });

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({ data: { email, passwordHash, name: sanitizedName } as any });

  if (actor.type === 'guest') {
    await mergeGuestIntoUser(actor.id, user.id);
  }

  const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000);
  const session = await prisma.session.create({ data: { userId: user.id, expiresAt } });
  setSessionCookie(res, session.id, expiresAt);
  res.status(201).json({ user: { id: user.id, email: user.email, name: sanitizedName } });
});

const LoginSchema = z.object({
  email: z.string().email().transform((s) => s.toLowerCase().trim()),
  password: z.string().min(1),
});

app.post('/auth/login', authRateLimit, async (req, res) => {
  const parsed = LoginSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'invalid payload', issues: parsed.error.issues });

  const { email, password } = parsed.data;
  const actor = await getActor(req);
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return res.status(401).json({ error: 'invalid credentials' });

  const ok = await bcrypt.compare(password, (user as any).passwordHash);
  if (!ok) return res.status(401).json({ error: 'invalid credentials' });

  if (actor.type === 'guest') {
    await mergeGuestIntoUser(actor.id, user.id);
  }

  const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000);
  const session = await prisma.session.create({ data: { userId: user.id, expiresAt } });
  setSessionCookie(res, session.id, expiresAt);
  res.json({ user: { id: user.id, email: user.email, name: user.name } });
});

// OAuth (Google / GitHub)
app.get('/auth/oauth/:provider/start', authRateLimit, async (req, res) => {
  const provider = String(req.params.provider) as OAuthProvider;
  if (provider !== 'google' && provider !== 'github') return res.status(404).json({ error: 'unknown provider' });

  const conf = getOAuthConfig(provider);
  if (!conf) return res.status(501).json({ error: 'oauth not configured' });

  const actor = await getActor(req);
  const guestId = actor.type === 'guest' ? actor.id : null;

  const state = randomString(24);
  const codeVerifier = randomString(48);
  const codeChallenge = sha256Base64Url(codeVerifier);
  const expiresAt = new Date(Date.now() + OAUTH_STATE_TTL_MIN * 60 * 1000);

  await prisma.oAuthState.create({
    data: {
      provider,
      state,
      codeVerifier,
      guestId: guestId ?? undefined,
      expiresAt,
    } as any,
  });

  const redirectUri = `${baseUrl(req)}/auth/oauth/${provider}/callback`;
  const params: Record<string, string> = {
    client_id: conf.clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: conf.scopes.join(' '),
    state,
  };
  // PKCE
  params.code_challenge = codeChallenge;
  params.code_challenge_method = 'S256';

  // optional return-to (after login)
  const returnTo = typeof req.query.returnTo === 'string' ? req.query.returnTo : '';
  if (returnTo) {
    // piggyback on state row? store in DB if needed later; keep simple for now.
  }

  const url = `${conf.authUrl}?${new URLSearchParams(params).toString()}`;
  res.redirect(url);
});

app.get('/auth/oauth/:provider/callback', authRateLimit, async (req, res) => {
  const provider = String(req.params.provider) as OAuthProvider;
  if (provider !== 'google' && provider !== 'github') return res.status(404).json({ error: 'unknown provider' });
  const conf = getOAuthConfig(provider);
  if (!conf) return res.status(501).json({ error: 'oauth not configured' });

  const code = typeof req.query.code === 'string' ? req.query.code : null;
  const state = typeof req.query.state === 'string' ? req.query.state : null;

  if (!code || !state) return res.status(400).json({ error: 'missing code/state' });

  const st = await prisma.oAuthState.findUnique({ where: { state } });
  if (!st) return res.status(400).json({ error: 'invalid state' });
  if (st.expiresAt.getTime() < Date.now()) return res.status(400).json({ error: 'state expired' });

  const redirectUri = `${baseUrl(req)}/auth/oauth/${provider}/callback`;

  // Exchange code for token
  if (provider === 'google') {
    const token: any = await exchangeToken(conf.tokenUrl, {
      client_id: conf.clientId,
      client_secret: conf.clientSecret,
      code,
      grant_type: 'authorization_code',
      redirect_uri: redirectUri,
      code_verifier: st.codeVerifier,
    });

    const idToken = token?.id_token;
    if (!idToken) return res.status(400).json({ error: 'missing id_token' });

    const jwks = createRemoteJWKSet(new URL((conf as any).jwksUrl));
    const verified = await jwtVerify(idToken, jwks, { audience: conf.clientId });
    const sub = String((verified.payload as any).sub || '');
    const email = String((verified.payload as any).email || '').toLowerCase();
    const name = String((verified.payload as any).name || '').trim();
    if (!sub) return res.status(400).json({ error: 'invalid id_token payload' });

    let userId: string;
    const existingAccount = await prisma.oAuthAccount.findUnique({ where: { provider_providerAccountId: { provider, providerAccountId: sub } } as any });
    if (existingAccount) {
      userId = existingAccount.userId;
    } else {
      // Try link by email if exists.
      const existingUser = email ? await prisma.user.findUnique({ where: { email } }) : null;
      const sanitizedName = name ? sanitizeInput(name) : undefined;
      const user = existingUser ?? await prisma.user.create({ data: { email: email || `google_${sub}@example.invalid`, passwordHash: await bcrypt.hash(randomString(24), 10), name: sanitizedName } as any });
      userId = user.id;
      await prisma.oAuthAccount.create({
        data: {
          provider,
          providerAccountId: sub,
          userId,
          accessToken: token?.access_token,
          refreshToken: token?.refresh_token,
          expiresAt: token?.expires_in ? new Date(Date.now() + Number(token.expires_in) * 1000) : undefined,
        } as any,
      });
    }

    if (st.guestId) await mergeGuestIntoUser(st.guestId, userId);

    const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000);
    const session = await prisma.session.create({ data: { userId, expiresAt } });
    setSessionCookie(res, session.id, expiresAt);
    await prisma.oAuthState.delete({ where: { state } }).catch(() => {});
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    return res.redirect(`${frontendUrl}/dashboard`);
  }

  // GitHub
  const token: any = await exchangeToken(conf.tokenUrl, {
    client_id: conf.clientId,
    client_secret: conf.clientSecret,
    code,
    redirect_uri: redirectUri,
    // GitHub supports PKCE too (as of recent updates). Keep verifier for compatibility.
    code_verifier: st.codeVerifier,
  });

  const accessToken = token?.access_token;
  if (!accessToken) return res.status(400).json({ error: 'missing access_token' });

  const gh = await githubGetUser(accessToken);
  const ghId = String(gh?.id || '');
  const ghLogin = String(gh?.login || '');
  if (!ghId) return res.status(400).json({ error: 'invalid github user' });

  let userId: string;
  const existingAccount = await prisma.oAuthAccount.findUnique({ where: { provider_providerAccountId: { provider, providerAccountId: ghId } } as any });
  if (existingAccount) {
    userId = existingAccount.userId;
  } else {
    // GitHub email requires extra call; keep minimal: create placeholder email.
    const placeholderEmail = `github_${ghId}@example.invalid`;
    const sanitizedGhLogin = ghLogin ? sanitizeInput(ghLogin) : undefined;
    const user = await prisma.user.create({ data: { email: placeholderEmail, passwordHash: await bcrypt.hash(randomString(24), 10), name: sanitizedGhLogin } as any });
    userId = user.id;
    await prisma.oAuthAccount.create({ data: { provider, providerAccountId: ghId, userId, accessToken } as any });
  }

  if (st.guestId) await mergeGuestIntoUser(st.guestId, userId);

  const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000);
  const session = await prisma.session.create({ data: { userId, expiresAt } });
  setSessionCookie(res, session.id, expiresAt);
  await prisma.oAuthState.delete({ where: { state } }).catch(() => {});
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
  return res.redirect(`${frontendUrl}/dashboard`);
});

app.post('/auth/logout', async (req, res) => {
  try {
    const sessionId = getCookie(req, SESSION_COOKIE);
    if (sessionId) {
      await prisma.session.delete({ where: { id: sessionId } }).catch(() => {});
    }
    clearSessionCookie(res);
    res.status(204).send();
  } catch (e: any) {
    // Logout is best-effort.
    clearSessionCookie(res);
    res.status(204).send();
  }
});

// Supabase Auth flow: after user signs in on the frontend, call this once to merge
// the current guest's data into the authenticated user.
app.post('/auth/claim', async (req, res) => {
  const bearer = getBearerToken(req);
  if (!bearer) return res.status(401).json({ error: 'missing bearer token' });

  // Determine authenticated user (by bearer)
  const userActor = await getActor(req);
  if (userActor.type !== 'user') return res.status(401).json({ error: 'invalid bearer token' });

  // Determine current guest (by cookie)
  const sessionId = getCookie(req, SESSION_COOKIE);
  if (!sessionId) return res.status(200).json({ ok: true, merged: false, reason: 'no guest session' });
  const session = await prisma.session.findUnique({ where: { id: sessionId } });
  const guestId = session?.guestId;
  if (!guestId) return res.status(200).json({ ok: true, merged: false, reason: 'no guest id' });

  await mergeGuestIntoUser(guestId, userActor.id);

  // Optional: convert the existing guest session to a user session so future calls can omit Bearer.
  // But per requirement we keep Bearer-only for auth; still, clearing guest cookie avoids repeat merges.
  await prisma.session.delete({ where: { id: sessionId } }).catch(() => {});
  clearSessionCookie(res);

  return res.json({ ok: true, merged: true });
});

// If running on Lambda, we don't call listen(); the handler will proxy requests to the app.
const port = process.env.PORT ? Number(process.env.PORT) : 4000;
if (!process.env.AWS_LAMBDA_FUNCTION_NAME && !process.env.VOW_NO_LISTEN) {
  api.listen(port, () => console.log(`Server running on http://localhost:${port}`));
}

export default api;
