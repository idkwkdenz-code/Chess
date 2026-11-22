export type UserRole = 'OWNER' | 'PLAYER';

export type FideTitle = 'GM' | 'IM' | 'FM' | 'CM' | 'WGM' | 'WIM' | 'WFM' | 'WCM' | 'NM';

export type PlatformTitle =
  | 'Beginner'
  | 'Intermediate'
  | 'Advanced'
  | 'Expert'
  | 'Master'
  | 'Elite'
  | 'Grandmaster-level';

export type TimeCategory = 'bullet' | 'blitz' | 'rapid' | 'classical';

export interface TimeControl {
  id: string;
  label: string;
  category: TimeCategory;
  initialSeconds: number;
  incrementSeconds: number;
}

export interface PlayerRatings {
  bullet: number;
  blitz: number;
  rapid: number;
  classical: number;
  daily: number;
  chess960: number;
  puzzle: number;
  practice: number;
}

export interface RatingHistoryPoint {
  timestamp: number;
  category: keyof PlayerRatings;
  rating: number;
  delta: number;
}

export interface TitleHistoryEntry {
  title: string;
  type: 'FIDE' | 'PLATFORM' | 'CUSTOM';
  awardedBy: string;
  awardedAt: number;
  note?: string;
}

export interface PlayerStats {
  gamesPlayed: number;
  wins: number;
  losses: number;
  draws: number;
  currentStreak: number;
  bestStreak: number;
  puzzlesSolved: number;
  puzzleStreak: number;
  bestPuzzleStreak: number;
  legendaryWins: string[];
}

export interface PublicUser {
  id: string;
  username: string;
  displayName: string;
  role: UserRole;
  bio: string;
  avatarColor: string;
  status: 'ACTIVE' | 'SUSPENDED' | 'BANNED';
  suspendedUntil?: number | null;
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
  online?: boolean;
  twoFactorEnabled?: boolean;
  createdAt: number;
  lastSeenAt: number;
}

export type MoveClassification =
  | 'Brilliant!!'
  | 'Great!'
  | 'Best'
  | 'Excellent'
  | 'Good'
  | 'Book'
  | 'Inaccuracy'
  | 'Mistake'
  | 'Miss'
  | 'Blunder';

export interface AnalyzedMove {
  ply: number;
  moveNumber: number;
  color: 'w' | 'b';
  san: string;
  uci: string;
  fenBefore: string;
  fenAfter: string;
  evalBeforeCp: number;
  evalAfterCp: number;
  bestMoveSan: string;
  bestMoveUci: string;
  pvSan: string[];
  cpLoss: number;
  classification: MoveClassification;
  comment: string;
}

export interface GameReviewSummary {
  whiteAccuracy: number;
  blackAccuracy: number;
  openingName: string;
  ecoCode: string;
  moves: AnalyzedMove[];
  counts: Record<'w' | 'b', Record<MoveClassification, number>>;
}

export interface SavedGameRecord {
  id: string;
  mode: 'online' | 'stockfish' | 'legend' | 'mirror-self' | 'mirror-ai' | 'mirror-random' | 'mirror-ghost' | 'local';
  whiteName: string;
  blackName: string;
  whiteRating?: number;
  blackRating?: number;
  timeControlLabel: string;
  category?: TimeCategory;
  fen: string;
  pgn: string;
  movesSan: string[];
  result: '1-0' | '0-1' | '1/2-1/2' | '*';
  termination: string;
  playerColor: 'w' | 'b' | 'both';
  openingName?: string;
  ecoCode?: string;
  legendId?: string;
  createdAt: number;
  updatedAt: number;
}

export interface OnlineGameState {
  id: string;
  whiteId: string;
  blackId: string;
  whiteName: string;
  blackName: string;
  whiteTitle?: string | null;
  blackTitle?: string | null;
  whiteRole?: UserRole;
  blackRole?: UserRole;
  whiteRating: number;
  blackRating: number;
  timeControl: TimeControl;
  visibility: 'public' | 'private';
  inviteCode?: string;
  rated: boolean;
  fen: string;
  pgn: string;
  movesSan: string[];
  lastMove?: { from: string; to: string } | null;
  whiteTimeMs: number;
  blackTimeMs: number;
  turn: 'w' | 'b';
  lastTickAt: number;
  status: 'waiting' | 'active' | 'completed' | 'aborted' | 'cancelled';
  result: '1-0' | '0-1' | '1/2-1/2' | '*';
  termination: string;
  drawOfferFrom?: string | null;
  rematchFrom?: string | null;
  chat: { id: string; sender: string; role?: UserRole; text: string; at: number }[];
  spectatorCount: number;
  createdAt: number;
}

export interface TournamentRecord {
  id: string;
  name: string;
  format: 'Arena' | 'Swiss' | 'Knockout';
  visibility: 'public' | 'private';
  inviteCode?: string;
  timeControl: TimeControl;
  maxPlayers: number;
  status: 'upcoming' | 'active' | 'completed';
  participants: {
    userId: string;
    username: string;
    rating: number;
    score: number;
    wins: number;
    draws: number;
    losses: number;
  }[];
  createdBy: string;
  createdAt: number;
}

export interface AppConfig {
  appName: string;
  announcement: string;
  maintenanceMode: boolean;
  features: {
    stockfishEnabled: boolean;
    onlineEnabled: boolean;
    tournamentsEnabled: boolean;
    coachEnabled: boolean;
    puzzlesEnabled: boolean;
    mirrorBotEnabled: boolean;
  };
  maxEngineDepth: number;
  enabledBoardThemes: string[];
  enabledSoundPacks: string[];
  version: string;
}

export interface AuditLogEntry {
  id: string;
  actorId: string;
  actorUsername: string;
  action: string;
  target: string;
  details: string;
  createdAt: number;
}

export interface LegendaryBot {
  id: string;
  name: string;
  era: string;
  country: string;
  estimatedRating: number;
  difficulty: 'Club' | 'Master' | 'Grandmaster' | 'World Champion';
  styleLabel: string;
  biography: string;
  openingPreferences: string[];
  accentHex: string;
  monogram: string;
  params: {
    depth: number;
    aggression: number; // -20 to +40 cp bonus for attacks
    positional: number; // 0.7 to 1.4 multiplier
    blunderMarginCp: number; // 0 = exact best, 35 = human-like
    openingBookWeight: number;
    preferredOpenings: string[];
  };
}

export interface OpeningEntry {
  id: string;
  eco: string;
  name: string;
  moves: string[];
  fen: string;
  whiteWinPct: number;
  drawPct: number;
  blackWinPct: number;
  summary: string;
  keyIdeas: string[];
  variations: { name: string; moves: string[]; note: string }[];
}

export interface PuzzleItem {
  id: string;
  title: string;
  theme: 'Mate in 1' | 'Mate in 2' | 'Fork' | 'Pin' | 'Skewer' | 'Discovered Attack' | 'Sacrifice' | 'Endgame';
  rating: number;
  fen: string;
  solutionSan: string[];
  explanation: string;
}

export type BoardThemeId =
  | 'neon'
  | 'cyberpunk'
  | 'galaxy'
  | 'purple'
  | 'blue'
  | 'green'
  | 'marble'
  | 'wooden'
  | 'glass'
  | 'gold'
  | 'dark'
  | 'minimalist'
  | 'custom';

export type PieceStyleId =
  | 'classic'
  | 'modern'
  | '3d'
  | 'neon'
  | 'glass'
  | 'minimalist'
  | 'futuristic';

export type SoundPackId = 'wood' | 'glass' | 'digital' | 'silent';

export interface UserSettings {
  themeMode: 'dark' | 'light';
  boardTheme: BoardThemeId;
  customLightSquare: string;
  customDarkSquare: string;
  pieceStyle: PieceStyleId;
  soundPack: SoundPackId;
  soundVolume: number;
  muted: boolean;
  showCoordinates: boolean;
  showLegalMoves: boolean;
  highlightLastMove: boolean;
  highlightCheck: boolean;
  pieceAnimations: boolean;
  moveConfirmation: boolean;
  autoFlipSelfPlay: boolean;
  engineDepth: number;
  showEvalBar: boolean;
  language: 'en' | 'es' | 'fr' | 'de' | 'tl';
}

export type NavTab = 'home' | 'play' | 'puzzles' | 'learn' | 'analysis' | 'profile' | 'settings';
