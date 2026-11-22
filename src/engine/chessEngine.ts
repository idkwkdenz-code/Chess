import { Chess, Move, PieceSymbol } from 'chess.js';
import { OPENINGS_DB } from '../data/openings';
import type {
  AnalyzedMove,
  GameReviewSummary,
  LegendaryBot,
  MoveClassification,
  SavedGameRecord,
} from '../types/chess';

const PIECE_VALUES: Record<PieceSymbol, number> = {
  p: 100,
  n: 320,
  b: 330,
  r: 500,
  q: 900,
  k: 20000,
};

// Middlegame & Endgame Piece-Square Tables (from White's perspective, a8 = index 0)
const PAWN_PST = [
  0,  0,  0,  0,  0,  0,  0,  0,
  50, 50, 50, 50, 50, 50, 50, 50,
  10, 10, 20, 30, 30, 20, 10, 10,
  5,  5, 10, 27, 27, 10,  5,  5,
  0,  0,  0, 24, 24,  0,  0,  0,
  5, -5,-10,  0,  0,-10, -5,  5,
  5, 10, 10,-22,-22, 10, 10,  5,
  0,  0,  0,  0,  0,  0,  0,  0,
];

const KNIGHT_PST = [
 -50,-40,-30,-30,-30,-30,-40,-50,
 -40,-20,  0,  0,  0,  0,-20,-40,
 -30,  0, 10, 15, 15, 10,  0,-30,
 -30,  5, 15, 20, 20, 15,  5,-30,
 -30,  0, 15, 20, 20, 15,  0,-30,
 -30,  5, 10, 15, 15, 10,  5,-30,
 -40,-20,  0,  5,  5,  0,-20,-40,
 -50,-40,-30,-30,-30,-30,-40,-50,
];

const BISHOP_PST = [
 -20,-10,-10,-10,-10,-10,-10,-20,
 -10,  0,  0,  0,  0,  0,  0,-10,
 -10,  0,  5, 10, 10,  5,  0,-10,
 -10,  5,  5, 10, 10,  5,  5,-10,
 -10,  0, 10, 10, 10, 10,  0,-10,
 -10, 10, 10, 10, 10, 10, 10,-10,
 -10,  5,  0,  0,  0,  0,  5,-10,
 -20,-10,-10,-10,-10,-10,-10,-20,
];

const ROOK_PST = [
  0,  0,  0,  0,  0,  0,  0,  0,
  5, 10, 10, 10, 10, 10, 10,  5,
 -5,  0,  0,  0,  0,  0,  0, -5,
 -5,  0,  0,  0,  0,  0,  0, -5,
 -5,  0,  0,  0,  0,  0,  0, -5,
 -5,  0,  0,  0,  0,  0,  0, -5,
 -5,  0,  0,  0,  0,  0,  0, -5,
  0,  0,  0,  5,  5,  0,  0,  0,
];

const QUEEN_PST = [
 -20,-10,-10, -5, -5,-10,-10,-20,
 -10,  0,  0,  0,  0,  0,  0,-10,
 -10,  0,  5,  5,  5,  5,  0,-10,
  -5,  0,  5,  5,  5,  5,  0, -5,
   0,  0,  5,  5,  5,  5,  0, -5,
 -10,  5,  5,  5,  5,  5,  0,-10,
 -10,  0,  5,  0,  0,  0,  0,-10,
 -20,-10,-10, -5, -5,-10,-10,-20,
];

const KING_MID_PST = [
 -30,-40,-40,-50,-50,-40,-40,-30,
 -30,-40,-40,-50,-50,-40,-40,-30,
 -30,-40,-40,-50,-50,-40,-40,-30,
 -30,-40,-40,-50,-50,-40,-40,-30,
 -20,-30,-30,-40,-40,-30,-30,-20,
 -10,-20,-20,-20,-20,-20,-20,-10,
  20, 20,  0,  0,  0,  0, 20, 20,
  20, 30, 10,  0,  0, 10, 30, 20,
];

const PST_MAP: Record<PieceSymbol, number[]> = {
  p: PAWN_PST,
  n: KNIGHT_PST,
  b: BISHOP_PST,
  r: ROOK_PST,
  q: QUEEN_PST,
  k: KING_MID_PST,
};

export interface EngineSearchOptions {
  depth?: number;
  timeLimitMs?: number;
  aggression?: number;
  positionalWeight?: number;
  blunderMarginCp?: number;
  preferredFirstMoves?: string[];
  mirrorStyle?: MirrorStyleProfile;
}

export interface MirrorStyleProfile {
  gamesAnalyzed: number;
  openingMoveFreq: Record<string, Record<string, number>>; // plyKey -> san -> count
  captureTendency: number; // 0 to 1
  checkTendency: number; // 0 to 1
  castlingPreference: 'kingside' | 'queenside' | 'balanced';
  summary: string;
}

export interface EngineEvaluationResult {
  evalCp: number; // Always from White's perspective (+ = White better)
  mateIn: number | null; // +N = White mates, -N = Black mates
  bestMoveSan: string;
  bestMoveUci: string;
  pvSan: string[];
  depthReached: number;
  nodes: number;
  topLines: { san: string; uci: string; evalCp: number; pvSan: string[] }[];
}

export function evaluateStaticBoard(chess: Chess, positionalWeight = 1, aggression = 0): number {
  if (chess.isCheckmate()) {
    return chess.turn() === 'w' ? -30000 : 30000;
  }
  if (chess.isDraw() || chess.isStalemate() || chess.isThreefoldRepetition() || chess.isInsufficientMaterial()) {
    return 0;
  }

  const board = chess.board();
  let score = 0;
  let whiteBishops = 0;
  let blackBishops = 0;

  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const sq = board[r][c];
      if (!sq) continue;
      const base = PIECE_VALUES[sq.type];
      const pstIndex = sq.color === 'w' ? r * 8 + c : (7 - r) * 8 + c;
      const pstVal = PST_MAP[sq.type][pstIndex] * positionalWeight;
      const total = base + pstVal;
      if (sq.color === 'w') {
        score += total;
        if (sq.type === 'b') whiteBishops++;
      } else {
        score -= total;
        if (sq.type === 'b') blackBishops++;
      }
    }
  }

  if (whiteBishops >= 2) score += 30;
  if (blackBishops >= 2) score -= 30;

  if (chess.inCheck()) {
    score += chess.turn() === 'w' ? -(22 + aggression * 0.4) : 22 + aggression * 0.4;
  }

  return Math.round(score);
}

function scoreMoveOrder(move: Move): number {
  let s = 0;
  if (move.captured) {
    s += 10 * PIECE_VALUES[move.captured] - PIECE_VALUES[move.piece];
  }
  if (move.promotion) {
    s += PIECE_VALUES[move.promotion] + 500;
  }
  if (move.san.includes('+')) s += 45;
  if (move.san === 'O-O' || move.san === 'O-O-O') s += 40;
  return s;
}

interface SearchState {
  nodes: number;
  startTime: number;
  timeLimitMs: number;
  aborted: boolean;
  positionalWeight: number;
  aggression: number;
  tt: Map<string, { depth: number; score: number; flag: 'EXACT' | 'LOWER' | 'UPPER'; bestUci?: string }>;
}

function quiescence(chess: Chess, alpha: number, beta: number, color: number, state: SearchState, qDepth = 0): number {
  state.nodes++;
  if ((state.nodes & 255) === 0 && Date.now() - state.startTime > state.timeLimitMs) {
    state.aborted = true;
    return 0;
  }

  const standPat = color * evaluateStaticBoard(chess, state.positionalWeight, state.aggression);
  if (standPat >= beta) return beta;
  if (alpha < standPat) alpha = standPat;
  if (qDepth >= 3) return alpha;

  const captures = chess
    .moves({ verbose: true })
    .filter((m) => m.captured || m.promotion)
    .sort((a, b) => scoreMoveOrder(b) - scoreMoveOrder(a));

  for (const m of captures) {
    chess.move(m);
    const score = -quiescence(chess, -beta, -alpha, -color, state, qDepth + 1);
    chess.undo();
    if (state.aborted) return 0;
    if (score >= beta) return beta;
    if (score > alpha) alpha = score;
  }
  return alpha;
}

function negamax(
  chess: Chess,
  depth: number,
  ply: number,
  alpha: number,
  beta: number,
  color: number,
  state: SearchState
): { score: number; pv: string[] } {
  state.nodes++;
  if ((state.nodes & 255) === 0 && Date.now() - state.startTime > state.timeLimitMs) {
    state.aborted = true;
    return { score: 0, pv: [] };
  }

  if (chess.isCheckmate()) {
    return { score: -(30000 - ply), pv: [] };
  }
  if (chess.isDraw() || chess.isStalemate() || chess.isThreefoldRepetition() || chess.isInsufficientMaterial()) {
    return { score: 0, pv: [] };
  }
  if (depth <= 0) {
    return { score: quiescence(chess, alpha, beta, color, state), pv: [] };
  }

  const fenKey = chess.fen().split(' ').slice(0, 4).join(' ');
  const ttEntry = state.tt.get(fenKey);
  if (ttEntry && ttEntry.depth >= depth) {
    if (ttEntry.flag === 'EXACT') return { score: ttEntry.score, pv: [] };
    if (ttEntry.flag === 'LOWER' && ttEntry.score > alpha) alpha = ttEntry.score;
    else if (ttEntry.flag === 'UPPER' && ttEntry.score < beta) beta = ttEntry.score;
    if (alpha >= beta) return { score: ttEntry.score, pv: [] };
  }

  const moves = chess.moves({ verbose: true }).sort((a, b) => {
    const uciA = a.from + a.to + (a.promotion || '');
    const uciB = b.from + b.to + (b.promotion || '');
    if (ttEntry?.bestUci === uciA) return -1;
    if (ttEntry?.bestUci === uciB) return 1;
    return scoreMoveOrder(b) - scoreMoveOrder(a);
  });

  if (moves.length === 0) {
    return { score: 0, pv: [] };
  }

  const origAlpha = alpha;
  let bestScore = -Infinity;
  let bestPv: string[] = [];
  let bestUci = '';

  for (const move of moves) {
    chess.move(move);
    const child = negamax(chess, depth - 1, ply + 1, -beta, -alpha, -color, state);
    chess.undo();
    if (state.aborted) return { score: 0, pv: [] };

    let score = -child.score;
    if (state.aggression !== 0 && (move.san.includes('+') || move.captured)) {
      score += Math.round(state.aggression * 0.25);
    }

    if (score > bestScore) {
      bestScore = score;
      bestPv = [move.san, ...child.pv];
      bestUci = move.from + move.to + (move.promotion || '');
    }
    if (score > alpha) alpha = score;
    if (alpha >= beta) break;
  }

  let flag: 'EXACT' | 'LOWER' | 'UPPER' = 'EXACT';
  if (bestScore <= origAlpha) flag = 'UPPER';
  else if (bestScore >= beta) flag = 'LOWER';
  if (state.tt.size < 40000) {
    state.tt.set(fenKey, { depth, score: bestScore, flag, bestUci });
  }

  return { score: bestScore, pv: bestPv };
}

export function analyzePosition(fen: string, options: EngineSearchOptions = {}): EngineEvaluationResult {
  const chess = new Chess(fen);
  const legalMoves = chess.moves({ verbose: true });
  if (legalMoves.length === 0) {
    const evalCp = evaluateStaticBoard(chess);
    return {
      evalCp,
      mateIn: chess.isCheckmate() ? 0 : null,
      bestMoveSan: '',
      bestMoveUci: '',
      pvSan: [],
      depthReached: 0,
      nodes: 1,
      topLines: [],
    };
  }

  const maxDepth = Math.max(1, Math.min(6, options.depth ?? 3));
  const timeLimitMs = options.timeLimitMs ?? 650;
  const color = chess.turn() === 'w' ? 1 : -1;

  const state: SearchState = {
    nodes: 0,
    startTime: Date.now(),
    timeLimitMs,
    aborted: false,
    positionalWeight: options.positionalWeight ?? 1,
    aggression: options.aggression ?? 0,
    tt: new Map(),
  };

  let bestLines: { san: string; uci: string; evalCp: number; pvSan: string[]; rawScore: number }[] = [];
  let depthReached = 1;

  for (let d = 1; d <= maxDepth; d++) {
    const currentLines: { san: string; uci: string; evalCp: number; pvSan: string[]; rawScore: number }[] = [];
    const ordered = [...legalMoves].sort((a, b) => scoreMoveOrder(b) - scoreMoveOrder(a));

    for (const move of ordered) {
      chess.move(move);
      const child = negamax(chess, d - 1, 1, -40000, 40000, -color, state);
      chess.undo();
      if (state.aborted) break;

      const sideScore = -child.score;
      const whiteEvalCp = color * sideScore;
      currentLines.push({
        san: move.san,
        uci: move.from + move.to + (move.promotion || ''),
        evalCp: whiteEvalCp,
        pvSan: [move.san, ...child.pv],
        rawScore: sideScore,
      });
    }

    if (state.aborted && bestLines.length > 0) break;
    currentLines.sort((a, b) => b.rawScore - a.rawScore);
    bestLines = currentLines;
    depthReached = d;
    if (Date.now() - state.startTime > timeLimitMs * 0.75) break;
  }

  // Fallback if aborted at depth 1
  if (bestLines.length === 0) {
    bestLines = legalMoves.map((m) => {
      chess.move(m);
      const evalCp = evaluateStaticBoard(chess);
      chess.undo();
      return {
        san: m.san,
        uci: m.from + m.to + (m.promotion || ''),
        evalCp,
        pvSan: [m.san],
        rawScore: color * evalCp,
      };
    });
    bestLines.sort((a, b) => b.rawScore - a.rawScore);
  }

  const top = bestLines[0];
  let mateIn: number | null = null;
  if (Math.abs(top.evalCp) >= 29000) {
    const plies = Math.max(1, 30000 - Math.abs(top.evalCp));
    const movesToMate = Math.ceil(plies / 2);
    mateIn = top.evalCp > 0 ? movesToMate : -movesToMate;
  }

  return {
    evalCp: top.evalCp,
    mateIn,
    bestMoveSan: top.san,
    bestMoveUci: top.uci,
    pvSan: top.pvSan,
    depthReached,
    nodes: state.nodes,
    topLines: bestLines.slice(0, 3).map(({ san, uci, evalCp, pvSan }) => ({ san, uci, evalCp, pvSan })),
  };
}

export function selectBotMove(
  fen: string,
  moveHistorySan: string[],
  options: {
    skillLevel?: number; // 1-20
    legend?: LegendaryBot;
    mirrorProfile?: MirrorStyleProfile;
  }
): { san: string; uci: string; evalCp: number } {
  const chess = new Chess(fen);
  const legal = chess.moves({ verbose: true });
  if (legal.length === 0) return { san: '', uci: '', evalCp: 0 };

  const ply = moveHistorySan.length;

  // Mirror AI opening imitation from player's recorded games
  if (options.mirrorProfile && ply < 8) {
    const plyFreq = options.mirrorProfile.openingMoveFreq[String(ply)];
    if (plyFreq) {
      const candidates = legal.filter((m) => plyFreq[m.san] > 0);
      if (candidates.length > 0) {
        candidates.sort((a, b) => (plyFreq[b.san] || 0) - (plyFreq[a.san] || 0));
        const pick = candidates[0];
        return { san: pick.san, uci: pick.from + pick.to + (pick.promotion || ''), evalCp: 0 };
      }
    }
  }

  // Legendary AI opening preferences
  if (options.legend && ply < 4 && Math.random() < options.legend.params.openingBookWeight) {
    const pref = options.legend.params.preferredOpenings;
    const match = legal.find((m) => pref.includes(m.san));
    if (match && ply === 0) {
      return { san: match.san, uci: match.from + match.to + (match.promotion || ''), evalCp: 15 };
    }
  }

  const skill = options.skillLevel ?? 10;
  const depth = options.legend
    ? Math.min(4, options.legend.params.depth)
    : skill <= 4
      ? 1
      : skill <= 10
        ? 2
        : skill <= 16
          ? 3
          : 4;

  const blunderMargin = options.legend
    ? options.legend.params.blunderMarginCp
    : Math.max(0, Math.round((20 - skill) * 18));

  const aggression = options.legend
    ? options.legend.params.aggression
    : options.mirrorProfile
      ? Math.round((options.mirrorProfile.captureTendency + options.mirrorProfile.checkTendency) * 20)
      : 0;

  const evalRes = analyzePosition(fen, {
    depth,
    timeLimitMs: 420,
    aggression,
    positionalWeight: options.legend?.params.positional ?? 1,
  });

  if (blunderMargin > 0 && evalRes.topLines.length > 1) {
    const color = chess.turn() === 'w' ? 1 : -1;
    const bestSideScore = color * evalRes.topLines[0].evalCp;
    const acceptable = evalRes.topLines.filter(
      (line) => bestSideScore - color * line.evalCp <= blunderMargin
    );
    if (acceptable.length > 1 && Math.random() < (options.legend ? 0.35 : Math.min(0.65, (20 - skill) / 22))) {
      const choice = acceptable[Math.floor(Math.random() * acceptable.length)];
      return { san: choice.san, uci: choice.uci, evalCp: choice.evalCp };
    }
  }

  return { san: evalRes.bestMoveSan, uci: evalRes.bestMoveUci, evalCp: evalRes.evalCp };
}

export function buildMirrorStyleProfile(games: SavedGameRecord[]): MirrorStyleProfile {
  const openingMoveFreq: Record<string, Record<string, number>> = {};
  let totalMoves = 0;
  let captures = 0;
  let checks = 0;
  let kingsideCastles = 0;
  let queensideCastles = 0;

  for (const g of games) {
    g.movesSan.forEach((san, idx) => {
      totalMoves++;
      if (san.includes('x')) captures++;
      if (san.includes('+') || san.includes('#')) checks++;
      if (san === 'O-O') kingsideCastles++;
      if (san === 'O-O-O') queensideCastles++;
      if (idx < 10) {
        const key = String(idx);
        if (!openingMoveFreq[key]) openingMoveFreq[key] = {};
        openingMoveFreq[key][san] = (openingMoveFreq[key][san] || 0) + 1;
      }
    });
  }

  const captureTendency = totalMoves > 0 ? captures / totalMoves : 0.18;
  const checkTendency = totalMoves > 0 ? checks / totalMoves : 0.08;
  const castlingPreference =
    kingsideCastles >= queensideCastles * 1.5
      ? 'kingside'
      : queensideCastles > kingsideCastles
        ? 'queenside'
        : 'balanced';

  const topFirstMoves = Object.entries(openingMoveFreq['0'] || {})
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .map(([m]) => m);

  const summary =
    games.length === 0
      ? 'Play at least 1 game so Mirror Bot can learn your opening choices, tactical aggression, and castling habits.'
      : `Trained on ${games.length} saved game${games.length > 1 ? 's' : ''}: favors ${
          topFirstMoves.length ? topFirstMoves.join(' / ') : 'classical development'
        }, ${(captureTendency * 100).toFixed(0)}% capture rate, and ${castlingPreference} castling.`;

  return {
    gamesAnalyzed: games.length,
    openingMoveFreq,
    captureTendency,
    checkTendency,
    castlingPreference,
    summary,
  };
}

export function detectOpening(movesSan: string[]): { name: string; eco: string } {
  const temp = new Chess();
  let matched = { name: 'Starting Position', eco: 'A00' };
  for (let i = 0; i < Math.min(movesSan.length, 14); i++) {
    try {
      temp.move(movesSan[i]);
    } catch {
      break;
    }
    const boardKey = temp.fen().split(' ').slice(0, 4).join(' ');
    for (const op of OPENINGS_DB) {
      if (op.fen.split(' ').slice(0, 4).join(' ') === boardKey) {
        matched = { name: op.name, eco: op.eco };
      }
    }
  }
  return matched;
}

function cpToWinProb(cp: number): number {
  return 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * cp)) - 1);
}

export function analyzeFullGame(movesSan: string[], depth = 2): GameReviewSummary {
  const chess = new Chess();
  const analyzed: AnalyzedMove[] = [];
  const counts: Record<'w' | 'b', Record<MoveClassification, number>> = {
    w: { 'Brilliant!!': 0, 'Great!': 0, Best: 0, Excellent: 0, Good: 0, Book: 0, Inaccuracy: 0, Mistake: 0, Miss: 0, Blunder: 0 },
    b: { 'Brilliant!!': 0, 'Great!': 0, Best: 0, Excellent: 0, Good: 0, Book: 0, Inaccuracy: 0, Mistake: 0, Miss: 0, Blunder: 0 },
  };

  let openingMatched = { name: 'Standard Opening', eco: 'A00' };
  const winProbLossesW: number[] = [];
  const winProbLossesB: number[] = [];

  for (let i = 0; i < movesSan.length; i++) {
    const san = movesSan[i];
    const fenBefore = chess.fen();
    const color = chess.turn();
    const moveNumber = Math.floor(i / 2) + 1;

    const evalBefore = analyzePosition(fenBefore, { depth, timeLimitMs: 140 });

    let moveObj: Move;
    try {
      moveObj = chess.move(san);
    } catch {
      break;
    }
    const fenAfter = chess.fen();
    const evalAfter = analyzePosition(fenAfter, { depth, timeLimitMs: 120 });

    const sideMult = color === 'w' ? 1 : -1;
    const beforeForSide = sideMult * evalBefore.evalCp;
    const afterForSide = sideMult * evalAfter.evalCp;
    const cpLoss = Math.max(0, beforeForSide - afterForSide);

    // Check if still in opening book
    const posKey = fenAfter.split(' ').slice(0, 4).join(' ');
    let isBook = false;
    for (const op of OPENINGS_DB) {
      if (op.fen.split(' ').slice(0, 4).join(' ') === posKey) {
        openingMatched = { name: op.name, eco: op.eco };
        isBook = true;
      }
    }

    let classification: MoveClassification = 'Good';
    let comment = '';

    const secondBestSide =
      evalBefore.topLines.length > 1 ? sideMult * evalBefore.topLines[1].evalCp : beforeForSide - 200;
    const isOnlyMove = beforeForSide - secondBestSide >= 120 && cpLoss <= 15;
    const sacrificedPiece = Boolean(moveObj.captured) === false && cpLoss <= 20 && evalBefore.bestMoveSan === san && beforeForSide >= 80 && chess.isCheck();

    if (isBook && i < 10) {
      classification = 'Book';
      comment = `Standard theoretical move in the ${openingMatched.name} (${openingMatched.eco}).`;
    } else if (sacrificedPiece) {
      classification = 'Brilliant!!';
      comment = `${san} is a brilliant forcing move maintaining decisive initiative.`;
    } else if (san === evalBefore.bestMoveSan || cpLoss <= 12) {
      if (isOnlyMove) {
        classification = 'Great!';
        comment = `${san} was the only move to preserve the advantage.`;
      } else {
        classification = 'Best';
        comment = `${san} is the engine’s top choice.`;
      }
    } else if (cpLoss <= 28) {
      classification = 'Excellent';
      comment = `${san} stays very close to the best line (${evalBefore.bestMoveSan}).`;
    } else if (cpLoss <= 60) {
      classification = 'Good';
      comment = `Solid playable choice; ${evalBefore.bestMoveSan} was slightly sharper.`;
    } else if (cpLoss <= 120) {
      classification = 'Inaccuracy';
      comment = `Slight precision loss (−${(cpLoss / 100).toFixed(2)}). ${evalBefore.bestMoveSan} kept tighter control.`;
    } else if (cpLoss <= 260) {
      if (beforeForSide >= 350 && afterForSide < 150) {
        classification = 'Miss';
        comment = `Missed a winning continuation! ${evalBefore.bestMoveSan} maintained a decisive edge.`;
      } else {
        classification = 'Mistake';
        comment = `Mistake (−${(cpLoss / 100).toFixed(2)}). Better was ${evalBefore.bestMoveSan}.`;
      }
    } else {
      classification = 'Blunder';
      comment = `Critical blunder (−${(cpLoss / 100).toFixed(2)}). ${evalBefore.bestMoveSan} was strongly required.`;
    }

    counts[color][classification] += 1;

    const wpBefore = cpToWinProb(beforeForSide);
    const wpAfter = cpToWinProb(afterForSide);
    const wpLoss = Math.max(0, wpBefore - wpAfter);
    if (color === 'w') winProbLossesW.push(wpLoss);
    else winProbLossesB.push(wpLoss);

    analyzed.push({
      ply: i + 1,
      moveNumber,
      color,
      san,
      uci: moveObj.from + moveObj.to + (moveObj.promotion || ''),
      fenBefore,
      fenAfter,
      evalBeforeCp: evalBefore.evalCp,
      evalAfterCp: evalAfter.evalCp,
      bestMoveSan: evalBefore.bestMoveSan,
      bestMoveUci: evalBefore.bestMoveUci,
      pvSan: evalBefore.pvSan,
      cpLoss,
      classification,
      comment,
    });
  }

  const calcAcc = (losses: number[]) => {
    if (losses.length === 0) return 100;
    const avg = losses.reduce((a, b) => a + b, 0) / losses.length;
    const acc = 103.1668 * Math.exp(-0.04354 * avg) - 3.1669;
    return Math.max(5, Math.min(99.9, Number(acc.toFixed(1))));
  };

  return {
    whiteAccuracy: calcAcc(winProbLossesW),
    blackAccuracy: calcAcc(winProbLossesB),
    openingName: openingMatched.name,
    ecoCode: openingMatched.eco,
    moves: analyzed,
    counts,
  };
}
