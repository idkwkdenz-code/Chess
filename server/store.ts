import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import type {
  AppConfig,
  AuditLogEntry,
  FideTitle,
  OnlineGameState,
  PlatformTitle,
  PlayerRatings,
  PlayerStats,
  PublicUser,
  RatingHistoryPoint,
  TitleHistoryEntry,
  TournamentRecord,
  UserRole,
} from '../src/types/chess.js';

export interface StoredUser {
  id: string;
  username: string;
  displayName: string;
  passwordHash: string | null;
  role: UserRole;
  bio: string;
  avatarColor: string;
  status: 'ACTIVE' | 'SUSPENDED' | 'BANNED';
  suspendedUntil: number | null;
  verified: boolean;
  officialFideTitle: FideTitle | null;
  fideVerified: boolean;
  platformTitle: PlatformTitle;
  customTitle: string | null;
  customTitleIcon: string | null;
  titleHistory: TitleHistoryEntry[];
  ratings: PlayerRatings;
  peakRatings: PlayerRatings;
  ratingHistory: RatingHistoryPoint[];
  stats: PlayerStats;
  achievements: string[];
  friends: string[];
  friendRequests: string[];
  favoriteOpenings: string[];
  twoFactorEnabled: boolean;
  twoFactorSecret: string | null;
  loginHistory: { at: number; ip: string; userAgent: string; success: boolean }[];
  tokenVersion: number;
  createdAt: number;
  lastSeenAt: number;
}

export interface StoredGameReport {
  id: string;
  reporterUsername: string;
  reason: string;
  at: number;
}

export interface StoredOnlineGame extends OnlineGameState {
  reports: StoredGameReport[];
}

export interface DatabaseSchema {
  users: StoredUser[];
  games: StoredOnlineGame[];
  tournaments: TournamentRecord[];
  appConfig: AppConfig;
  auditLogs: AuditLogEntry[];
}

const DATA_DIR = path.resolve(process.cwd(), 'data');
const DB_PATH = path.join(DATA_DIR, 'db.json');

const DEFAULT_RATINGS = (): PlayerRatings => ({
  bullet: 400,
  blitz: 400,
  rapid: 400,
  classical: 400,
  daily: 400,
  chess960: 400,
  puzzle: 400,
  practice: 400,
});

const DEFAULT_STATS = (): PlayerStats => ({
  gamesPlayed: 0,
  wins: 0,
  losses: 0,
  draws: 0,
  currentStreak: 0,
  bestStreak: 0,
  puzzlesSolved: 0,
  puzzleStreak: 0,
  bestPuzzleStreak: 0,
  legendaryWins: [],
});

const DEFAULT_APP_CONFIG = (): AppConfig => ({
  appName: 'CART3R Chess Academy',
  announcement: 'Welcome to CART3R Chess Academy — Online Arena, Mirror Bot, and Game Review are live.',
  maintenanceMode: false,
  features: {
    stockfishEnabled: true,
    onlineEnabled: true,
    tournamentsEnabled: true,
    coachEnabled: true,
    puzzlesEnabled: true,
    mirrorBotEnabled: true,
  },
  maxEngineDepth: 10,
  enabledBoardThemes: [
    'wooden', 'green', 'blue', 'marble', 'dark', 'gold', 'purple', 'glass', 'galaxy', 'neon', 'cyberpunk', 'minimalist', 'custom',
  ],
  enabledSoundPacks: ['wood', 'glass', 'digital', 'silent'],
  version: '1.0.0',
});

function createOwnerUser(): StoredUser {
  const now = Date.now();
  const envPass = (process.env.OWNER_INITIAL_PASSWORD || '').trim();
  const passwordHash = envPass ? bcrypt.hashSync(envPass, 10) : null;
  return {
    id: 'owner-lmxynnn',
    username: 'lmxynnn',
    displayName: 'lmxynnn',
    passwordHash,
    role: 'OWNER',
    bio: 'Creator & Owner of CART3R Chess Academy. International chess enthusiast and platform architect.',
    avatarColor: '#D97706',
    status: 'ACTIVE',
    suspendedUntil: null,
    verified: true,
    officialFideTitle: null,
    fideVerified: false,
    platformTitle: 'Grandmaster-level',
    customTitle: 'Platform Owner',
    customTitleIcon: 'crown',
    titleHistory: [
      {
        title: 'Platform Owner',
        type: 'CUSTOM',
        awardedBy: 'SYSTEM',
        awardedAt: now,
        note: 'Founding Owner account initialized automatically.',
      },
    ],
    ratings: { ...DEFAULT_RATINGS(), rapid: 1200, blitz: 1200, bullet: 1200, classical: 1200, puzzle: 1200 },
    peakRatings: { ...DEFAULT_RATINGS(), rapid: 1200, blitz: 1200, bullet: 1200, classical: 1200, puzzle: 1200 },
    ratingHistory: [],
    stats: DEFAULT_STATS(),
    achievements: ['first-victory'],
    friends: [],
    friendRequests: [],
    favoriteOpenings: ['Sicilian Defense', 'Italian Game'],
    twoFactorEnabled: false,
    twoFactorSecret: null,
    loginHistory: [],
    tokenVersion: 1,
    createdAt: now,
    lastSeenAt: now,
  };
}

function createInitialDb(): DatabaseSchema {
  const now = Date.now();
  return {
    users: [createOwnerUser()],
    games: [],
    tournaments: [
      {
        id: 'tourney-welcome-arena',
        name: 'CART3R Weekly Blitz Arena',
        format: 'Arena',
        visibility: 'public',
        timeControl: { id: 'blitz-3-2', label: '3+2', category: 'blitz', initialSeconds: 180, incrementSeconds: 2 },
        maxPlayers: 64,
        status: 'active',
        participants: [],
        createdBy: 'lmxynnn',
        createdAt: now,
      },
      {
        id: 'tourney-rapid-swiss',
        name: 'Academy Rapid Swiss Championship',
        format: 'Swiss',
        visibility: 'public',
        timeControl: { id: 'rapid-10-5', label: '10+5', category: 'rapid', initialSeconds: 600, incrementSeconds: 5 },
        maxPlayers: 32,
        status: 'upcoming',
        participants: [],
        createdBy: 'lmxynnn',
        createdAt: now,
      },
    ],
    appConfig: DEFAULT_APP_CONFIG(),
    auditLogs: [
      {
        id: crypto.randomUUID(),
        actorId: 'SYSTEM',
        actorUsername: 'SYSTEM',
        action: 'INITIALIZE_OWNER',
        target: 'lmxynnn',
        details: 'Owner account @lmxynnn initialized automatically during platform setup.',
        createdAt: now,
      },
    ],
  };
}

class Store {
  private db: DatabaseSchema;
  private onlineUserIds = new Set<string>();

  constructor() {
    this.db = this.load();
    this.ensureOwnerExists();
  }

  private load(): DatabaseSchema {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      if (!fs.existsSync(DB_PATH)) {
        const init = createInitialDb();
        this.writeAtomic(init);
        return init;
      }
      const raw = fs.readFileSync(DB_PATH, 'utf-8');
      const parsed = JSON.parse(raw) as DatabaseSchema;
      if (!parsed.users || !parsed.appConfig) {
        throw new Error('Invalid DB structure');
      }
      return parsed;
    } catch {
      const init = createInitialDb();
      this.writeAtomic(init);
      return init;
    }
  }

  private ensureOwnerExists() {
    let owner = this.db.users.find((u) => u.username.toLowerCase() === 'lmxynnn');
    if (!owner) {
      owner = createOwnerUser();
      this.db.users.unshift(owner);
      this.save();
    } else {
      // Enforce immutable OWNER role on lmxynnn and prevent others from holding OWNER
      owner.role = 'OWNER';
      const envPass = (process.env.OWNER_INITIAL_PASSWORD || '').trim();
      if (envPass) {
        // Configured env secret overrides any fallback hash
        if (!owner.passwordHash || !bcrypt.compareSync(envPass, owner.passwordHash)) {
          owner.passwordHash = bcrypt.hashSync(envPass, 10);
          this.save();
        }
      }
    }
    for (const u of this.db.users) {
      if (u.username.toLowerCase() !== 'lmxynnn' && u.role === 'OWNER') {
        u.role = 'PLAYER';
      }
    }
  }

  private writeAtomic(data: DatabaseSchema) {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    const tmpPath = `${DB_PATH}.${process.pid}.tmp`;
    fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2), 'utf-8');
    fs.renameSync(tmpPath, DB_PATH);
  }

  save() {
    this.writeAtomic(this.db);
  }

  getDb(): DatabaseSchema {
    return this.db;
  }

  setOnline(userId: string, isOnline: boolean) {
    if (isOnline) {
      this.onlineUserIds.add(userId);
      const u = this.findUserById(userId);
      if (u) u.lastSeenAt = Date.now();
    } else {
      this.onlineUserIds.delete(userId);
    }
  }

  isOnline(userId: string): boolean {
    return this.onlineUserIds.has(userId);
  }

  getOnlineCount(): number {
    return this.onlineUserIds.size;
  }

  findUserById(id: string): StoredUser | undefined {
    return this.db.users.find((u) => u.id === id);
  }

  findUserByUsername(username: string): StoredUser | undefined {
    const target = username.trim().toLowerCase();
    return this.db.users.find((u) => u.username.toLowerCase() === target);
  }

  toPublicUser(user: StoredUser): PublicUser {
    return {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      role: user.role,
      bio: user.bio,
      avatarColor: user.avatarColor,
      status: user.status,
      suspendedUntil: user.suspendedUntil,
      verified: user.verified,
      officialFideTitle: user.officialFideTitle,
      fideVerified: user.fideVerified,
      platformTitle: user.platformTitle,
      customTitle: user.customTitle,
      customTitleIcon: user.customTitleIcon,
      titleHistory: user.titleHistory,
      ratings: user.ratings,
      peakRatings: user.peakRatings,
      ratingHistory: user.ratingHistory.slice(-40),
      stats: user.stats,
      achievements: user.achievements,
      friends: user.friends,
      friendRequests: user.friendRequests,
      favoriteOpenings: user.favoriteOpenings,
      online: this.onlineUserIds.has(user.id),
      twoFactorEnabled: user.twoFactorEnabled,
      createdAt: user.createdAt,
      lastSeenAt: user.lastSeenAt,
    };
  }

  createPlayer(username: string, password: string): StoredUser {
    const clean = username.trim();
    const now = Date.now();
    const colors = ['#15803D', '#0284C7', '#7C3AED', '#DC2626', '#0D9488', '#4F46E5'];
    const avatarColor = colors[Math.floor(Math.random() * colors.length)];
    const user: StoredUser = {
      id: `usr-${crypto.randomUUID().slice(0, 12)}`,
      username: clean,
      displayName: clean,
      passwordHash: bcrypt.hashSync(password, 10),
      role: 'PLAYER',
      bio: 'Competitive player at CART3R Chess Academy.',
      avatarColor,
      status: 'ACTIVE',
      suspendedUntil: null,
      verified: false,
      officialFideTitle: null,
      fideVerified: false,
      platformTitle: 'Beginner',
      customTitle: null,
      customTitleIcon: null,
      titleHistory: [
        {
          title: 'Beginner',
          type: 'PLATFORM',
          awardedBy: 'SYSTEM',
          awardedAt: now,
          note: 'Starting platform tier',
        },
      ],
      ratings: DEFAULT_RATINGS(),
      peakRatings: DEFAULT_RATINGS(),
      ratingHistory: [],
      stats: DEFAULT_STATS(),
      achievements: [],
      friends: [],
      friendRequests: [],
      favoriteOpenings: [],
      twoFactorEnabled: false,
      twoFactorSecret: null,
      loginHistory: [],
      tokenVersion: 1,
      createdAt: now,
      lastSeenAt: now,
    };
    this.db.users.push(user);
    this.save();
    return user;
  }

  addAuditLog(actorId: string, actorUsername: string, action: string, target: string, details: string) {
    this.db.auditLogs.unshift({
      id: crypto.randomUUID(),
      actorId,
      actorUsername,
      action,
      target,
      details,
      createdAt: Date.now(),
    });
    if (this.db.auditLogs.length > 500) {
      this.db.auditLogs = this.db.auditLogs.slice(0, 500);
    }
    this.save();
  }

  updatePlatformTitleForRating(user: StoredUser) {
    const maxRating = Math.max(user.ratings.bullet, user.ratings.blitz, user.ratings.rapid, user.ratings.classical);
    let next: PlatformTitle = 'Beginner';
    if (maxRating >= 2400) next = 'Grandmaster-level';
    else if (maxRating >= 2100) next = 'Elite';
    else if (maxRating >= 1800) next = 'Master';
    else if (maxRating >= 1500) next = 'Expert';
    else if (maxRating >= 1200) next = 'Advanced';
    else if (maxRating >= 800) next = 'Intermediate';
    if (user.platformTitle !== next && user.role !== 'OWNER') {
      user.platformTitle = next;
      user.titleHistory.push({
        title: next,
        type: 'PLATFORM',
        awardedBy: 'RATING_ENGINE',
        awardedAt: Date.now(),
        note: `Reached ${maxRating} rating`,
      });
    }
  }

  applyEloMatchResult(
    whiteId: string,
    blackId: string,
    category: 'bullet' | 'blitz' | 'rapid' | 'classical',
    result: '1-0' | '0-1' | '1/2-1/2',
    termination: string
  ) {
    const w = this.findUserById(whiteId);
    const b = this.findUserById(blackId);
    if (!w || !b || w.id === b.id) return null;

    const rW = w.ratings[category];
    const rB = b.ratings[category];
    const expW = 1 / (1 + Math.pow(10, (rB - rW) / 400));
    const expB = 1 - expW;
    const scoreW = result === '1-0' ? 1 : result === '0-1' ? 0 : 0.5;
    const scoreB = 1 - scoreW;

    const kW = w.stats.gamesPlayed < 20 ? 40 : rW >= 2400 ? 12 : 24;
    const kB = b.stats.gamesPlayed < 20 ? 40 : rB >= 2400 ? 12 : 24;

    const newW = Math.max(100, Math.round(rW + kW * (scoreW - expW)));
    const newB = Math.max(100, Math.round(rB + kB * (scoreB - expB)));
    const now = Date.now();

    w.ratings[category] = newW;
    b.ratings[category] = newB;
    if (newW > w.peakRatings[category]) w.peakRatings[category] = newW;
    if (newB > b.peakRatings[category]) b.peakRatings[category] = newB;

    w.ratingHistory.push({ timestamp: now, category, rating: newW, delta: newW - rW });
    b.ratingHistory.push({ timestamp: now, category, rating: newB, delta: newB - rB });

    w.stats.gamesPlayed += 1;
    b.stats.gamesPlayed += 1;
    if (result === '1-0') {
      w.stats.wins += 1;
      w.stats.currentStreak += 1;
      w.stats.bestStreak = Math.max(w.stats.bestStreak, w.stats.currentStreak);
      b.stats.losses += 1;
      b.stats.currentStreak = 0;
    } else if (result === '0-1') {
      b.stats.wins += 1;
      b.stats.currentStreak += 1;
      b.stats.bestStreak = Math.max(b.stats.bestStreak, b.stats.currentStreak);
      w.stats.losses += 1;
      w.stats.currentStreak = 0;
    } else {
      w.stats.draws += 1;
      b.stats.draws += 1;
      w.stats.currentStreak = 0;
      b.stats.currentStreak = 0;
    }

    this.checkAchievements(w, result === '1-0', termination);
    this.checkAchievements(b, result === '0-1', termination);
    this.updatePlatformTitleForRating(w);
    this.updatePlatformTitleForRating(b);
    this.save();

    return { whiteAfter: newW, blackAfter: newB };
  }

  checkAchievements(user: StoredUser, didWin: boolean, termination?: string) {
    const add = (id: string) => {
      if (!user.achievements.includes(id)) user.achievements.push(id);
    };
    if (didWin) {
      add('first-victory');
      if (termination?.toLowerCase().includes('checkmate')) add('first-checkmate');
      if (user.stats.wins >= 10) add('ten-wins');
      if (user.stats.wins >= 100) add('hundred-wins');
      if (user.stats.wins >= 1000) add('thousand-wins');
      if (user.stats.currentStreak >= 5) add('win-streak-5');
    }
    if (user.stats.bestPuzzleStreak >= 10) add('puzzle-streak-10');
    if (user.stats.legendaryWins.length > 0) add('legend-slayer');
  }
}

export const store = new Store();
