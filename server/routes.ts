import express from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { execFile } from 'child_process';
import { GoogleGenAI } from '@google/genai';
import {
  authenticateRequest,
  AuthedRequest,
  clearSessionCookie,
  generateTotpSecret,
  requireOwner,
  setSessionCookie,
  signAuthToken,
  verifyAuthToken,
  extractTokenFromRequest,
  verifyTotpCode,
} from './auth.js';
import { store } from './store.js';
import type { FideTitle, PlatformTitle } from '../src/types/chess.js';

const SERVER_STARTED_AT = Date.now();

function getGeminiClient(): GoogleGenAI | null {
  const key = (process.env.GEMINI_API_KEY || '').trim();
  if (!key || key === 'MY_GEMINI_API_KEY') return null;
  return new GoogleGenAI({
    apiKey: key,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function validateStrongPassword(pw: string): string | null {
  if (pw.length < 8) return 'Password must be at least 8 characters.';
  if (!/[A-Z]/.test(pw)) return 'Password must contain at least one uppercase letter.';
  if (!/[a-z]/.test(pw)) return 'Password must contain at least one lowercase letter.';
  if (!/[0-9!@#$%^&*]/.test(pw)) return 'Password must include a number or symbol.';
  return null;
}

export function createApiRouter() {
  const router = express.Router();

  // Public platform config & live stats
  router.get('/config', (_req, res) => {
    res.json(store.getDb().appConfig);
  });

  router.get('/stats', (_req, res) => {
    const db = store.getDb();
    const activeGames = db.games.filter((g) => g.status === 'active').length;
    const activeTournaments = db.tournaments.filter((t) => t.status === 'active').length;
    const totalPuzzlesSolved = db.users.reduce((acc, u) => acc + u.stats.puzzlesSolved, 0);
    res.json({
      totalUsers: db.users.length,
      onlineUsers: store.getOnlineCount(),
      activeGames,
      totalGames: db.games.length,
      activeTournaments,
      totalPuzzlesSolved,
    });
  });

  // Owner setup check (never exposes password or secret)
  router.get('/auth/owner-setup-status', (_req, res) => {
    const owner = store.findUserByUsername('lmxynnn');
    const envConfigured = Boolean((process.env.OWNER_INITIAL_PASSWORD || '').trim());
    res.json({
      ownerUsername: 'lmxynnn',
      claimed: Boolean(owner?.passwordHash),
      envConfigured,
    });
  });

  // One-time atomic Owner password claim when OWNER_INITIAL_PASSWORD is not set
  router.post('/auth/claim-owner', (req, res) => {
    const owner = store.findUserByUsername('lmxynnn');
    if (!owner) {
      res.status(404).json({ error: 'Owner account not found.' });
      return;
    }
    if ((process.env.OWNER_INITIAL_PASSWORD || '').trim() || owner.passwordHash) {
      res.status(409).json({ error: 'Owner account password has already been initialized.' });
      return;
    }
    const password = typeof req.body?.password === 'string' ? req.body.password : '';
    const err = validateStrongPassword(password);
    if (err) {
      res.status(400).json({ error: err });
      return;
    }
    owner.passwordHash = bcrypt.hashSync(password, 10);
    owner.loginHistory.unshift({
      at: Date.now(),
      ip: req.ip || 'unknown',
      userAgent: req.headers['user-agent'] || 'unknown',
      success: true,
    });
    store.addAuditLog(owner.id, owner.username, 'CLAIM_OWNER_PASSWORD', 'lmxynnn', 'Owner initial password claimed.');
    store.save();

    const token = signAuthToken(owner);
    setSessionCookie(res, token);
    res.json({ token, user: store.toPublicUser(owner) });
  });

  router.get('/auth/me', (req, res) => {
    const { token } = extractTokenFromRequest(req);
    if (!token) {
      res.json({ user: null });
      return;
    }
    const user = verifyAuthToken(token);
    if (!user) {
      res.json({ user: null });
      return;
    }
    res.json({ user: store.toPublicUser(user), token });
  });

  router.post('/auth/register', (req, res) => {
    const username = typeof req.body?.username === 'string' ? req.body.username.trim() : '';
    const password = typeof req.body?.password === 'string' ? req.body.password : '';

    if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
      res.status(400).json({ error: 'Username must be 3–20 characters (letters, numbers, underscore).' });
      return;
    }
    // Strictly prevent anyone from registering as lmxynnn or OWNER
    if (username.toLowerCase() === 'lmxynnn' || username.toLowerCase() === 'owner') {
      res.status(403).json({ error: 'This reserved username cannot be registered.' });
      return;
    }
    if (store.findUserByUsername(username)) {
      res.status(409).json({ error: 'Username is already taken.' });
      return;
    }
    const pwErr = validateStrongPassword(password);
    if (pwErr) {
      res.status(400).json({ error: pwErr });
      return;
    }

    const user = store.createPlayer(username, password);
    const token = signAuthToken(user);
    setSessionCookie(res, token);
    res.status(201).json({ token, user: store.toPublicUser(user) });
  });

  router.post('/auth/login', (req, res) => {
    const username = typeof req.body?.username === 'string' ? req.body.username.trim() : '';
    const password = typeof req.body?.password === 'string' ? req.body.password : '';
    const totpCode = typeof req.body?.totpCode === 'string' ? req.body.totpCode.trim() : '';

    const user = store.findUserByUsername(username);
    if (!user) {
      res.status(401).json({ error: 'Invalid username or password.' });
      return;
    }
    if (user.role === 'OWNER' && !user.passwordHash) {
      res.status(403).json({ error: 'Owner password not yet initialized. Use the initial setup form.', needsOwnerClaim: true });
      return;
    }
    if (!user.passwordHash || !bcrypt.compareSync(password, user.passwordHash)) {
      user.loginHistory.unshift({
        at: Date.now(),
        ip: req.ip || 'unknown',
        userAgent: req.headers['user-agent'] || 'unknown',
        success: false,
      });
      user.loginHistory = user.loginHistory.slice(0, 30);
      store.save();
      res.status(401).json({ error: 'Invalid username or password.' });
      return;
    }
    if (user.status === 'BANNED') {
      res.status(403).json({ error: 'This account has been banned.' });
      return;
    }
    if (user.status === 'SUSPENDED' && user.suspendedUntil && user.suspendedUntil > Date.now()) {
      res.status(403).json({ error: `Account suspended until ${new Date(user.suspendedUntil).toLocaleString()}.` });
      return;
    }
    if (user.twoFactorEnabled && user.twoFactorSecret) {
      if (!totpCode) {
        res.status(200).json({ requires2FA: true });
        return;
      }
      if (!verifyTotpCode(user.twoFactorSecret, totpCode)) {
        res.status(401).json({ error: 'Invalid two-factor authentication code.' });
        return;
      }
    }

    user.lastSeenAt = Date.now();
    user.loginHistory.unshift({
      at: Date.now(),
      ip: req.ip || 'unknown',
      userAgent: req.headers['user-agent'] || 'unknown',
      success: true,
    });
    user.loginHistory = user.loginHistory.slice(0, 30);
    store.save();

    const token = signAuthToken(user);
    setSessionCookie(res, token);
    res.json({ token, user: store.toPublicUser(user) });
  });

  router.post('/auth/logout', (_req, res) => {
    clearSessionCookie(res);
    res.json({ ok: true });
  });

  router.post('/auth/2fa/setup', authenticateRequest, (req: AuthedRequest, res) => {
    const user = req.user!;
    const secret = generateTotpSecret();
    user.twoFactorSecret = secret;
    store.save();
    const otpauthUrl = `otpauth://totp/CART3R%20Chess:${encodeURIComponent(user.username)}?secret=${secret}&issuer=CART3R%20Chess%20Academy`;
    res.json({ secret, otpauthUrl });
  });

  router.post('/auth/2fa/enable', authenticateRequest, (req: AuthedRequest, res) => {
    const user = req.user!;
    const code = typeof req.body?.code === 'string' ? req.body.code : '';
    if (!user.twoFactorSecret || !verifyTotpCode(user.twoFactorSecret, code)) {
      res.status(400).json({ error: 'Invalid 6-digit authenticator code.' });
      return;
    }
    user.twoFactorEnabled = true;
    store.addAuditLog(user.id, user.username, 'ENABLE_2FA', user.username, 'Enabled 2FA protection.');
    store.save();
    res.json({ user: store.toPublicUser(user) });
  });

  router.post('/auth/2fa/disable', authenticateRequest, (req: AuthedRequest, res) => {
    const user = req.user!;
    user.twoFactorEnabled = false;
    user.twoFactorSecret = null;
    store.addAuditLog(user.id, user.username, 'DISABLE_2FA', user.username, 'Disabled 2FA protection.');
    store.save();
    res.json({ user: store.toPublicUser(user) });
  });

  router.post('/auth/revoke-sessions', authenticateRequest, (req: AuthedRequest, res) => {
    const user = req.user!;
    user.tokenVersion += 1;
    store.addAuditLog(user.id, user.username, 'REVOKE_SESSIONS', user.username, 'Revoked all active sessions.');
    store.save();
    const token = signAuthToken(user);
    setSessionCookie(res, token);
    res.json({ token, user: store.toPublicUser(user) });
  });

  // Update player profile bio / favorite openings
  router.patch('/profile', authenticateRequest, (req: AuthedRequest, res) => {
    const user = req.user!;
    if (typeof req.body?.bio === 'string') {
      user.bio = req.body.bio.trim().slice(0, 280);
    }
    if (typeof req.body?.displayName === 'string' && req.body.displayName.trim().length >= 2) {
      user.displayName = req.body.displayName.trim().slice(0, 24);
    }
    if (Array.isArray(req.body?.favoriteOpenings)) {
      user.favoriteOpenings = req.body.favoriteOpenings.slice(0, 6).map(String);
    }
    store.save();
    res.json({ user: store.toPublicUser(user) });
  });

  // Record offline AI / Mirror Bot / Puzzle progress (never mutates official online ratings!)
  router.post('/games/record-practice', authenticateRequest, (req: AuthedRequest, res) => {
    const user = req.user!;
    const type = req.body?.type;
    if (type === 'puzzle') {
      const solved = Boolean(req.body?.solved);
      const delta = solved ? 14 : -10;
      user.ratings.puzzle = Math.max(100, user.ratings.puzzle + delta);
      if (user.ratings.puzzle > user.peakRatings.puzzle) {
        user.peakRatings.puzzle = user.ratings.puzzle;
      }
      if (solved) {
        user.stats.puzzlesSolved += 1;
        user.stats.puzzleStreak += 1;
        user.stats.bestPuzzleStreak = Math.max(user.stats.bestPuzzleStreak, user.stats.puzzleStreak);
      } else {
        user.stats.puzzleStreak = 0;
      }
      store.checkAchievements(user, false);
      store.save();
      res.json({ user: store.toPublicUser(user) });
      return;
    }

    if (type === 'practice-ai') {
      const outcome: 'win' | 'loss' | 'draw' = req.body?.outcome;
      const legendId = typeof req.body?.legendId === 'string' ? req.body.legendId : null;
      const delta = outcome === 'win' ? 16 : outcome === 'loss' ? -12 : 2;
      user.ratings.practice = Math.max(100, user.ratings.practice + delta);
      if (user.ratings.practice > user.peakRatings.practice) {
        user.peakRatings.practice = user.ratings.practice;
      }
      if (outcome === 'win' && legendId && !user.stats.legendaryWins.includes(legendId)) {
        user.stats.legendaryWins.push(legendId);
      }
      store.checkAchievements(user, outcome === 'win', req.body?.termination);
      store.save();
      res.json({ user: store.toPublicUser(user) });
      return;
    }

    res.status(400).json({ error: 'Unknown practice event type.' });
  });

  // Leaderboard & rating distribution
  router.get('/leaderboard', (req, res) => {
    const cat = (req.query.category as string) || 'blitz';
    const valid = ['bullet', 'blitz', 'rapid', 'classical', 'puzzle', 'practice'];
    const key = valid.includes(cat) ? (cat as keyof typeof store.getDb.prototype) : 'blitz';
    const users = store
      .getDb()
      .users.filter((u) => u.status === 'ACTIVE')
      .map((u) => store.toPublicUser(u))
      .sort((a, b) => (b.ratings[key as keyof typeof b.ratings] || 400) - (a.ratings[key as keyof typeof a.ratings] || 400));

    const buckets = [
      { label: '400–799', min: 400, max: 799, count: 0 },
      { label: '800–1199', min: 800, max: 1199, count: 0 },
      { label: '1200–1599', min: 1200, max: 1599, count: 0 },
      { label: '1600–1999', min: 1600, max: 1999, count: 0 },
      { label: '2000+', min: 2000, max: 4000, count: 0 },
    ];
    for (const u of users) {
      const r = u.ratings[key as keyof typeof u.ratings] || 400;
      const bucket = buckets.find((b) => r >= b.min && r <= b.max) || buckets[0];
      bucket.count += 1;
    }

    res.json({ leaderboard: users.slice(0, 50), distribution: buckets });
  });

  // Friends system
  router.get('/users/search', (req, res) => {
    const q = (typeof req.query.q === 'string' ? req.query.q : '').trim().toLowerCase();
    const matches = store
      .getDb()
      .users.filter((u) => u.status === 'ACTIVE' && (!q || u.username.toLowerCase().includes(q)))
      .slice(0, 20)
      .map((u) => store.toPublicUser(u));
    res.json({ users: matches });
  });

  router.post('/friends/request', authenticateRequest, (req: AuthedRequest, res) => {
    const user = req.user!;
    const targetUsername = typeof req.body?.username === 'string' ? req.body.username.trim() : '';
    const target = store.findUserByUsername(targetUsername);
    if (!target || target.id === user.id) {
      res.status(404).json({ error: 'Player not found.' });
      return;
    }
    if (user.friends.includes(target.id)) {
      res.status(400).json({ error: 'Already friends.' });
      return;
    }
    if (!target.friendRequests.includes(user.id)) {
      target.friendRequests.push(user.id);
      store.save();
    }
    res.json({ ok: true });
  });

  router.post('/friends/respond', authenticateRequest, (req: AuthedRequest, res) => {
    const user = req.user!;
    const requesterId = typeof req.body?.userId === 'string' ? req.body.userId : '';
    const accept = Boolean(req.body?.accept);
    user.friendRequests = user.friendRequests.filter((id) => id !== requesterId);
    if (accept) {
      const requester = store.findUserById(requesterId);
      if (requester) {
        if (!user.friends.includes(requester.id)) user.friends.push(requester.id);
        if (!requester.friends.includes(user.id)) requester.friends.push(user.id);
      }
    }
    store.save();
    res.json({ user: store.toPublicUser(user) });
  });

  // Public games & reporting
  router.get('/games/public', (_req, res) => {
    const games = store
      .getDb()
      .games.filter((g) => g.visibility === 'public' && (g.status === 'waiting' || g.status === 'active'))
      .slice(0, 30);
    res.json({ games });
  });

  router.get('/games/my', authenticateRequest, (req: AuthedRequest, res) => {
    const uid = req.user!.id;
    const games = store
      .getDb()
      .games.filter((g) => g.whiteId === uid || g.blackId === uid)
      .slice(0, 40);
    res.json({ games });
  });

  router.post('/games/:id/report', authenticateRequest, (req: AuthedRequest, res) => {
    const game = store.getDb().games.find((g) => g.id === req.params.id);
    if (!game) {
      res.status(404).json({ error: 'Game not found.' });
      return;
    }
    const reason = typeof req.body?.reason === 'string' ? req.body.reason.trim().slice(0, 300) : 'Suspicious play';
    game.reports.push({
      id: crypto.randomUUID(),
      reporterUsername: req.user!.username,
      reason,
      at: Date.now(),
    });
    store.save();
    res.json({ ok: true });
  });

  // Tournaments
  router.get('/tournaments', (_req, res) => {
    res.json({ tournaments: store.getDb().tournaments });
  });

  router.post('/tournaments', authenticateRequest, (req: AuthedRequest, res) => {
    if (!store.getDb().appConfig.features.tournamentsEnabled) {
      res.status(403).json({ error: 'Tournaments are currently disabled.' });
      return;
    }
    const name = typeof req.body?.name === 'string' ? req.body.name.trim().slice(0, 60) : '';
    const format = ['Arena', 'Swiss', 'Knockout'].includes(req.body?.format) ? req.body.format : 'Arena';
    const visibility: 'public' | 'private' = req.body?.visibility === 'private' ? 'private' : 'public';
    const timeControl = req.body?.timeControl;
    if (!name || !timeControl?.id) {
      res.status(400).json({ error: 'Tournament name and time control required.' });
      return;
    }
    const t = {
      id: `trn-${crypto.randomUUID().slice(0, 8)}`,
      name,
      format,
      visibility,
      inviteCode: visibility === 'private' ? Math.random().toString(36).slice(2, 8).toUpperCase() : undefined,
      timeControl,
      maxPlayers: Number(req.body?.maxPlayers) || 32,
      status: 'upcoming' as const,
      participants: [
        {
          userId: req.user!.id,
          username: req.user!.username,
          rating: req.user!.ratings[timeControl.category as 'blitz'] || 400,
          score: 0,
          wins: 0,
          draws: 0,
          losses: 0,
        },
      ],
      createdBy: req.user!.username,
      createdAt: Date.now(),
    };
    store.getDb().tournaments.unshift(t);
    store.save();
    res.status(201).json({ tournament: t });
  });

  router.post('/tournaments/:id/join', authenticateRequest, (req: AuthedRequest, res) => {
    const t = store.getDb().tournaments.find((x) => x.id === req.params.id);
    if (!t) {
      res.status(404).json({ error: 'Tournament not found.' });
      return;
    }
    if (t.visibility === 'private' && t.inviteCode && req.body?.inviteCode !== t.inviteCode) {
      res.status(403).json({ error: 'Invalid private tournament invite code.' });
      return;
    }
    if (t.participants.some((p) => p.userId === req.user!.id)) {
      res.json({ tournament: t });
      return;
    }
    if (t.participants.length >= t.maxPlayers) {
      res.status(400).json({ error: 'Tournament is full.' });
      return;
    }
    t.participants.push({
      userId: req.user!.id,
      username: req.user!.username,
      rating: req.user!.ratings[t.timeControl.category] || 400,
      score: 0,
      wins: 0,
      draws: 0,
      losses: 0,
    });
    store.save();
    res.json({ tournament: t });
  });

  // Intelligent Gemini Chess Coach
  router.post('/coach/ask', async (req, res) => {
    if (!store.getDb().appConfig.features.coachEnabled) {
      res.status(403).json({ error: 'Chess Coach is currently disabled by the Owner.' });
      return;
    }
    const ai = getGeminiClient();
    if (!ai) {
      res.status(503).json({
        error: 'Gemini API key is not configured in Settings > Secrets. Add GEMINI_API_KEY to activate the AI Grandmaster Coach.',
      });
      return;
    }
    const fen = typeof req.body?.fen === 'string' ? req.body.fen : '';
    const pgn = typeof req.body?.pgn === 'string' ? req.body.pgn : '';
    const evalSummary = typeof req.body?.evalSummary === 'string' ? req.body.evalSummary : '';
    const level = typeof req.body?.level === 'string' ? req.body.level : 'Intermediate';
    const question = typeof req.body?.question === 'string' ? req.body.question.trim() : '';

    if (!question) {
      res.status(400).json({ error: 'Please enter a chess question or topic for the coach.' });
      return;
    }

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: `Student Level: ${level}\nCurrent FEN: ${fen || 'Starting position'}\nMoves / PGN: ${pgn || 'None'}\nEngine Evaluation Context: ${evalSummary || 'Balanced'}\n\nStudent Request: ${question}`,
        config: {
          systemInstruction:
            'You are an elite FIDE Grandmaster Chess Coach at CART3R Chess Academy. Adapt your vocabulary and depth strictly to the Student Level (Beginner, Intermediate, Advanced, Expert, or Master). Explain concrete tactical motifs, candidate moves using exact algebraic notation, pawn structure plans, and checkmate patterns concisely in well-structured markdown without fluff.',
        },
      });
      res.json({ reply: response.text || 'Unable to generate coaching advice for this position.' });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Coach service unavailable.';
      res.status(502).json({ error: `Chess Coach upstream error: ${message}` });
    }
  });

  // Optional Native Stockfish Bridge (works when `stockfish` binary is installed in Termux/Linux)
  router.get('/engine/status', (_req, res) => {
    execFile('which', ['stockfish'], (err, stdout) => {
      res.json({
        nativeStockfish: !err && Boolean(stdout.trim()),
        binaryPath: stdout?.trim() || null,
        engineEnabled: store.getDb().appConfig.features.stockfishEnabled,
        maxDepth: store.getDb().appConfig.maxEngineDepth,
      });
    });
  });

  // =========================================================================
  // EXCLUSIVE OWNER SUPER ADMIN API ROUTES (ROLE === 'OWNER' VERIFIED SERVER-SIDE)
  // =========================================================================

  router.get('/owner/overview', authenticateRequest, requireOwner, (_req, res) => {
    const db = store.getDb();
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const gamesToday = db.games.filter((g) => g.createdAt >= startOfDay.getTime()).length;
    const newRegistrationsToday = db.users.filter((u) => u.createdAt >= startOfDay.getTime()).length;

    res.json({
      stats: {
        totalUsers: db.users.length,
        onlineUsers: store.getOnlineCount(),
        totalGames: db.games.length,
        gamesToday,
        activeGames: db.games.filter((g) => g.status === 'active').length,
        reportedGames: db.games.filter((g) => g.reports.length > 0).length,
        activeTournaments: db.tournaments.filter((t) => t.status === 'active').length,
        totalPuzzlesSolved: db.users.reduce((sum, u) => sum + u.stats.puzzlesSolved, 0),
        newRegistrationsToday,
        uptimeSeconds: Math.floor((Date.now() - SERVER_STARTED_AT) / 1000),
        serverStatus: 'Healthy',
      },
      appConfig: db.appConfig,
      auditLogs: db.auditLogs.slice(0, 80),
      loginHistory: store.findUserByUsername('lmxynnn')?.loginHistory || [],
    });
  });

  router.get('/owner/users', authenticateRequest, requireOwner, (req, res) => {
    const q = (typeof req.query.q === 'string' ? req.query.q : '').trim().toLowerCase();
    const users = store
      .getDb()
      .users.filter(
        (u) => !q || u.username.toLowerCase().includes(q) || u.id.toLowerCase().includes(q)
      )
      .map((u) => store.toPublicUser(u));
    res.json({ users });
  });

  router.post('/owner/users/:id/moderate', authenticateRequest, requireOwner, (req: AuthedRequest, res) => {
    const target = store.findUserById(req.params.id);
    if (!target) {
      res.status(404).json({ error: 'User not found.' });
      return;
    }
    const { action, hours, newUsername, verified } = req.body || {};
    if (target.role === 'OWNER' && ['ban', 'suspend'].includes(action)) {
      res.status(400).json({ error: 'Cannot ban or suspend the Owner account.' });
      return;
    }

    if (action === 'ban') {
      target.status = 'BANNED';
      target.tokenVersion += 1;
    } else if (action === 'unban') {
      target.status = 'ACTIVE';
      target.suspendedUntil = null;
    } else if (action === 'suspend') {
      const h = Math.max(1, Number(hours) || 24);
      target.status = 'SUSPENDED';
      target.suspendedUntil = Date.now() + h * 3600 * 1000;
      target.tokenVersion += 1;
    } else if (action === 'verify') {
      target.verified = Boolean(verified);
    } else if (action === 'rename' && typeof newUsername === 'string') {
      const clean = newUsername.trim();
      if (!/^[a-zA-Z0-9_]{3,20}$/.test(clean) || store.findUserByUsername(clean)) {
        res.status(400).json({ error: 'Invalid or already taken username.' });
        return;
      }
      target.username = clean;
      target.displayName = clean;
    } else {
      res.status(400).json({ error: 'Invalid moderation action.' });
      return;
    }

    store.addAuditLog(
      req.user!.id,
      req.user!.username,
      `USER_${String(action).toUpperCase()}`,
      target.username,
      `Applied ${action} on user ${target.id}`
    );
    store.save();
    res.json({ user: store.toPublicUser(target) });
  });

  router.post('/owner/users/:id/ratings', authenticateRequest, requireOwner, (req: AuthedRequest, res) => {
    const target = store.findUserById(req.params.id);
    if (!target) {
      res.status(404).json({ error: 'User not found.' });
      return;
    }
    const { mode, category, value } = req.body || {};
    const validCats = ['bullet', 'blitz', 'rapid', 'classical', 'puzzle'];
    if (mode === 'reset') {
      target.ratings.bullet = 400;
      target.ratings.blitz = 400;
      target.ratings.rapid = 400;
      target.ratings.classical = 400;
      target.ratings.puzzle = 400;
      store.addAuditLog(req.user!.id, req.user!.username, 'RESET_RATINGS', target.username, 'Reset all ratings to 400.');
    } else if (validCats.includes(category) && Number.isFinite(Number(value))) {
      const clamped = Math.max(100, Math.min(3500, Math.round(Number(value))));
      target.ratings[category as 'blitz'] = clamped;
      if (clamped > target.peakRatings[category as 'blitz']) {
        target.peakRatings[category as 'blitz'] = clamped;
      }
      target.ratingHistory.push({
        timestamp: Date.now(),
        category: category as 'blitz',
        rating: clamped,
        delta: 0,
      });
      store.addAuditLog(
        req.user!.id,
        req.user!.username,
        'ADJUST_RATING',
        target.username,
        `Set ${category} rating to ${clamped}`
      );
    } else {
      res.status(400).json({ error: 'Invalid rating adjustment parameters.' });
      return;
    }
    store.updatePlatformTitleForRating(target);
    store.save();
    res.json({ user: store.toPublicUser(target) });
  });

  router.post('/owner/users/:id/titles', authenticateRequest, requireOwner, (req: AuthedRequest, res) => {
    const target = store.findUserById(req.params.id);
    if (!target) {
      res.status(404).json({ error: 'User not found.' });
      return;
    }
    const { titleType, titleValue, icon, fideConfirmed } = req.body || {};
    if (titleType === 'CUSTOM') {
      target.customTitle = titleValue ? String(titleValue).trim().slice(0, 28) : null;
      target.customTitleIcon = icon ? String(icon).trim().slice(0, 20) : null;
      target.titleHistory.push({
        title: target.customTitle || 'Removed custom title',
        type: 'CUSTOM',
        awardedBy: req.user!.username,
        awardedAt: Date.now(),
      });
      store.addAuditLog(
        req.user!.id,
        req.user!.username,
        'CUSTOM_TITLE',
        target.username,
        `Custom title set to "${target.customTitle || 'none'}"`
      );
    } else if (titleType === 'PLATFORM') {
      const valid: PlatformTitle[] = [
        'Beginner', 'Intermediate', 'Advanced', 'Expert', 'Master', 'Elite', 'Grandmaster-level',
      ];
      if (!valid.includes(titleValue)) {
        res.status(400).json({ error: 'Invalid platform title.' });
        return;
      }
      target.platformTitle = titleValue;
      target.titleHistory.push({
        title: titleValue,
        type: 'PLATFORM',
        awardedBy: req.user!.username,
        awardedAt: Date.now(),
      });
      store.addAuditLog(req.user!.id, req.user!.username, 'PLATFORM_TITLE', target.username, `Assigned ${titleValue}`);
    } else if (titleType === 'FIDE') {
      if (titleValue === null || titleValue === '') {
        target.officialFideTitle = null;
        target.fideVerified = false;
      } else {
        if (!fideConfirmed) {
          res.status(400).json({ error: 'Official FIDE titles require explicit FIDE identity verification confirmation.' });
          return;
        }
        const validFide: FideTitle[] = ['GM', 'IM', 'FM', 'CM', 'WGM', 'WIM', 'WFM', 'WCM', 'NM'];
        if (!validFide.includes(titleValue)) {
          res.status(400).json({ error: 'Invalid FIDE title code.' });
          return;
        }
        target.officialFideTitle = titleValue;
        target.fideVerified = true;
      }
      target.titleHistory.push({
        title: titleValue || 'Removed FIDE verification',
        type: 'FIDE',
        awardedBy: req.user!.username,
        awardedAt: Date.now(),
        note: fideConfirmed ? 'FIDE credentials verified by Owner' : undefined,
      });
      store.addAuditLog(
        req.user!.id,
        req.user!.username,
        'FIDE_TITLE_VERIFICATION',
        target.username,
        `FIDE title set to ${titleValue || 'none'}`
      );
    } else {
      res.status(400).json({ error: 'Invalid title operation.' });
      return;
    }

    store.save();
    res.json({ user: store.toPublicUser(target) });
  });

  router.get('/owner/games', authenticateRequest, requireOwner, (_req, res) => {
    res.json({ games: store.getDb().games.slice(0, 100) });
  });

  router.post('/owner/games/:id/cancel', authenticateRequest, requireOwner, (req: AuthedRequest, res) => {
    const game = store.getDb().games.find((g) => g.id === req.params.id);
    if (!game) {
      res.status(404).json({ error: 'Game not found.' });
      return;
    }
    game.status = 'cancelled';
    game.result = '*';
    game.termination = 'Cancelled by Platform Owner';
    store.addAuditLog(req.user!.id, req.user!.username, 'CANCEL_GAME', game.id, 'Cancelled game from Owner panel.');
    store.save();
    res.json({ game });
  });

  router.post('/owner/tournaments/:id/manage', authenticateRequest, requireOwner, (req: AuthedRequest, res) => {
    const db = store.getDb();
    const idx = db.tournaments.findIndex((t) => t.id === req.params.id);
    if (idx === -1) {
      res.status(404).json({ error: 'Tournament not found.' });
      return;
    }
    const { action } = req.body || {};
    if (action === 'delete') {
      const removed = db.tournaments.splice(idx, 1)[0];
      store.addAuditLog(req.user!.id, req.user!.username, 'DELETE_TOURNAMENT', removed.name, 'Removed tournament.');
      store.save();
      res.json({ ok: true });
      return;
    }
    if (['upcoming', 'active', 'completed'].includes(action)) {
      db.tournaments[idx].status = action;
      store.addAuditLog(req.user!.id, req.user!.username, 'TOURNAMENT_STATUS', db.tournaments[idx].name, `Set status to ${action}`);
      store.save();
      res.json({ tournament: db.tournaments[idx] });
      return;
    }
    res.status(400).json({ error: 'Invalid tournament action.' });
  });

  router.put('/owner/config', authenticateRequest, requireOwner, (req: AuthedRequest, res) => {
    const cfg = store.getDb().appConfig;
    const body = req.body || {};
    if (typeof body.appName === 'string' && body.appName.trim()) {
      cfg.appName = body.appName.trim().slice(0, 50);
    }
    if (typeof body.announcement === 'string') {
      cfg.announcement = body.announcement.trim().slice(0, 240);
    }
    if (typeof body.maintenanceMode === 'boolean') {
      cfg.maintenanceMode = body.maintenanceMode;
    }
    if (typeof body.maxEngineDepth === 'number') {
      cfg.maxEngineDepth = Math.max(2, Math.min(18, Math.round(body.maxEngineDepth)));
    }
    if (body.features && typeof body.features === 'object') {
      cfg.features = { ...cfg.features, ...body.features };
    }
    if (Array.isArray(body.enabledBoardThemes)) {
      cfg.enabledBoardThemes = body.enabledBoardThemes.map(String);
    }
    if (Array.isArray(body.enabledSoundPacks)) {
      cfg.enabledSoundPacks = body.enabledSoundPacks.map(String);
    }
    if (typeof body.version === 'string' && body.version.trim()) {
      cfg.version = body.version.trim().slice(0, 20);
    }
    store.addAuditLog(req.user!.id, req.user!.username, 'UPDATE_APP_CONFIG', cfg.appName, 'Updated platform settings.');
    store.save();
    res.json({ appConfig: cfg });
  });

  return router;
}
