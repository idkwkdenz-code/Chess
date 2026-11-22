import React, { useEffect, useMemo, useState } from 'react';
import { Chess } from 'chess.js';
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  FileText,
  LineChart,
  Loader2,
  Play,
  Upload,
} from 'lucide-react';
import { ChessBoard } from '../components/ChessBoard';
import { analyzeFullGame, analyzePosition } from '../engine/chessEngine';
import { getAllOfflineGames } from '../utils/offlineDb';
import { soundEngine } from '../utils/soundEngine';
import type { GameReviewSummary, MoveClassification, SavedGameRecord, UserSettings } from '../types/chess';

const CLASSIFICATION_COLOR: Record<MoveClassification, string> = {
  'Brilliant!!': 'text-cyan-500',
  'Great!': 'text-sky-500',
  Best: 'text-emerald-500',
  Excellent: 'text-emerald-400',
  Good: 'text-slate-400',
  Book: 'text-amber-500',
  Inaccuracy: 'text-yellow-500',
  Mistake: 'text-orange-500',
  Miss: 'text-rose-400',
  Blunder: 'text-rose-600',
};

interface AnalysisPageProps {
  settings: UserSettings;
  initialGame: SavedGameRecord | null;
}

export const AnalysisPage: React.FC<AnalysisPageProps> = ({ settings, initialGame }) => {
  const [savedGames, setSavedGames] = useState<SavedGameRecord[]>([]);
  const [movesSan, setMovesSan] = useState<string[]>(
    initialGame?.movesSan.length
      ? initialGame.movesSan
      : ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5', 'c3', 'Nf6', 'd4', 'exd4', 'cxd4', 'Bb4+']
  );
  const [pgnInput, setPgnInput] = useState('');
  const [fenInput, setFenInput] = useState('');
  const [customStartFen, setCustomStartFen] = useState<string | null>(null);
  const [currentPly, setCurrentPly] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [review, setReview] = useState<GameReviewSummary | null>(null);
  const [analyzing, setAnalyzing] = useState(false);

  useEffect(() => {
    getAllOfflineGames().then(setSavedGames);
  }, []);

  useEffect(() => {
    if (initialGame && initialGame.movesSan.length > 0) {
      setMovesSan(initialGame.movesSan);
      setCustomStartFen(null);
      setCurrentPly(initialGame.movesSan.length);
      setReview(null);
    }
  }, [initialGame]);

  const currentBoardState = useMemo(() => {
    const chess = customStartFen ? new Chess(customStartFen) : new Chess();
    let lastMove: { from: string; to: string } | null = null;
    for (let i = 0; i < Math.min(currentPly, movesSan.length); i++) {
      try {
        const m = chess.move(movesSan[i]);
        if (m) lastMove = { from: m.from, to: m.to };
      } catch {
        break;
      }
    }
    return { fen: chess.fen(), lastMove };
  }, [movesSan, currentPly, customStartFen]);

  const liveEval = useMemo(() => {
    return analyzePosition(currentBoardState.fen, {
      depth: Math.min(4, settings.engineDepth),
      timeLimitMs: 260,
    });
  }, [currentBoardState.fen, settings.engineDepth]);

  const runFullReview = () => {
    if (movesSan.length === 0) return;
    setAnalyzing(true);
    setTimeout(() => {
      const res = analyzeFullGame(movesSan, Math.min(3, settings.engineDepth));
      setReview(res);
      setAnalyzing(false);
    }, 30);
  };

  useEffect(() => {
    if (movesSan.length > 0 && !review) {
      runFullReview();
    }
  }, [movesSan]);

  const handleBoardMove = (from: string, to: string, promotion = 'q') => {
    const chess = new Chess(currentBoardState.fen);
    try {
      const m = chess.move({ from, to, promotion });
      if (!m) return false;
      const sliced = movesSan.slice(0, currentPly);
      const next = [...sliced, m.san];
      setMovesSan(next);
      setCurrentPly(next.length);
      setReview(null);
      soundEngine.play(m.captured ? 'capture' : 'move');
      return true;
    } catch {
      return false;
    }
  };

  const importPgn = () => {
    const clean = pgnInput.trim();
    if (!clean) return;
    const c = new Chess();
    try {
      c.loadPgn(clean);
      const hist = c.history();
      setCustomStartFen(null);
      setMovesSan(hist);
      setCurrentPly(hist.length);
      setReview(null);
      setPgnInput('');
    } catch {
      // ignore invalid PGN
    }
  };

  const importFen = () => {
    const clean = fenInput.trim();
    if (!clean) return;
    try {
      const c = new Chess(clean);
      setCustomStartFen(c.fen());
      setMovesSan([]);
      setCurrentPly(0);
      setReview(null);
      setFenInput('');
    } catch {
      // ignore invalid FEN
    }
  };

  const currentAnalyzed = review && currentPly > 0 ? review.moves[currentPly - 1] : null;
  const bestArrow = useMemo(() => {
    const uci = currentAnalyzed ? currentAnalyzed.bestMoveUci : liveEval.bestMoveUci;
    if (uci && uci.length >= 4) {
      return { from: uci.slice(0, 2), to: uci.slice(2, 4) };
    }
    return null;
  }, [currentAnalyzed, liveEval.bestMoveUci]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold text-slate-900 dark:text-white">
            Engine Analysis & Game Review
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            Real centipawn evaluation, principal variations, move classifications, and accuracy percentages.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setFlipped((f) => !f)}
            className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200"
          >
            Flip Board
          </button>
          <button
            type="button"
            onClick={runFullReview}
            disabled={analyzing || movesSan.length === 0}
            className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold inline-flex items-center gap-1.5 disabled:opacity-50"
          >
            {analyzing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
            {analyzing ? 'Analyzing...' : 'Run Game Review'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-6 space-y-3">
          <ChessBoard
            fen={currentBoardState.fen}
            onMove={handleBoardMove}
            flipped={flipped}
            lastMove={currentBoardState.lastMove}
            evalCp={liveEval.evalCp}
            mateIn={liveEval.mateIn}
            bestMoveArrow={bestArrow}
            settings={settings}
          />

          {/* Step Navigation */}
          <div className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2">
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setCurrentPly(0)}
                className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
                aria-label="Start of game"
              >
                <ChevronsLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setCurrentPly((p) => Math.max(0, p - 1))}
                className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
                aria-label="Previous move"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setCurrentPly((p) => Math.min(movesSan.length, p + 1))}
                className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
                aria-label="Next move"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setCurrentPly(movesSan.length)}
                className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
                aria-label="End of game"
              >
                <ChevronsRight className="w-4 h-4" />
              </button>
            </div>
            <span className="text-xs font-mono-tabular text-slate-500 dark:text-slate-400">
              Ply {currentPly} / {movesSan.length}
            </span>
          </div>

          {/* Engine Principal Variations */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
              <span>Engine Lines (Depth {liveEval.depthReached} · {liveEval.nodes.toLocaleString()} nodes)</span>
              <span className="font-mono-tabular font-semibold text-emerald-600 dark:text-emerald-400">
                {liveEval.mateIn !== null
                  ? `Mate in ${Math.abs(liveEval.mateIn)}`
                  : `${liveEval.evalCp >= 0 ? '+' : ''}${(liveEval.evalCp / 100).toFixed(2)}`}
              </span>
            </div>
            <div className="space-y-1.5">
              {liveEval.topLines.map((line, i) => (
                <div
                  key={`${line.uci}-${i}`}
                  className="flex items-center gap-3 text-xs font-mono-tabular py-1 border-b border-slate-100 dark:border-slate-800 last:border-none"
                >
                  <span className="w-12 font-bold text-slate-900 dark:text-white">
                    {line.evalCp >= 0 ? '+' : ''}
                    {(line.evalCp / 100).toFixed(2)}
                  </span>
                  <span className="text-slate-600 dark:text-slate-300 truncate">
                    {line.pvSan.slice(0, 6).join(' ')}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="lg:col-span-6 space-y-4">
          {/* Accuracy & Opening Summary */}
          {review && (
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    ECO {review.ecoCode} · {review.openingName}
                  </p>
                  <h2 className="text-lg font-display font-bold text-slate-900 dark:text-white">
                    Game Accuracy Summary
                  </h2>
                </div>
                <LineChart className="w-5 h-5 text-emerald-500" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-slate-100 dark:bg-slate-800/70 p-3.5">
                  <p className="text-xs text-slate-500 dark:text-slate-400">White Accuracy</p>
                  <p className="text-2xl font-mono-tabular font-bold text-slate-900 dark:text-white mt-0.5">
                    {review.whiteAccuracy}%
                  </p>
                </div>
                <div className="rounded-xl bg-slate-100 dark:bg-slate-800/70 p-3.5">
                  <p className="text-xs text-slate-500 dark:text-slate-400">Black Accuracy</p>
                  <p className="text-2xl font-mono-tabular font-bold text-slate-900 dark:text-white mt-0.5">
                    {review.blackAccuracy}%
                  </p>
                </div>
              </div>

              {/* Evaluation Graph */}
              <div>
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">
                  Evaluation Advantage Graph (Click move to jump)
                </p>
                <div className="h-24 w-full rounded-xl bg-slate-950 border border-slate-800 p-2 flex items-end gap-0.5 overflow-hidden">
                  {review.moves.map((m) => {
                    const clamped = Math.max(-600, Math.min(600, m.evalAfterCp));
                    const heightPct = 50 + (clamped / 600) * 45;
                    const active = m.ply === currentPly;
                    return (
                      <button
                        key={m.ply}
                        type="button"
                        onClick={() => setCurrentPly(m.ply)}
                        title={`${m.moveNumber}. ${m.san} (${m.classification})`}
                        className={`flex-1 min-w-[4px] rounded-t-xs transition-all ${
                          active
                            ? 'bg-amber-400'
                            : m.evalAfterCp >= 0
                              ? 'bg-slate-100 hover:bg-emerald-400'
                              : 'bg-slate-600 hover:bg-rose-400'
                        }`}
                        style={{ height: `${heightPct}%` }}
                      />
                    );
                  })}
                </div>
              </div>

              {/* Active Move Explanation */}
              {currentAnalyzed && (
                <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 p-3.5 space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-mono-tabular font-bold text-slate-900 dark:text-white">
                      {currentAnalyzed.moveNumber}.
                      {currentAnalyzed.color === 'b' ? '.. ' : ' '}
                      {currentAnalyzed.san}
                    </span>
                    <span className={`font-bold ${CLASSIFICATION_COLOR[currentAnalyzed.classification]}`}>
                      {currentAnalyzed.classification}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-300">
                    {currentAnalyzed.comment}
                  </p>
                  {currentAnalyzed.bestMoveSan && currentAnalyzed.bestMoveSan !== currentAnalyzed.san && (
                    <p className="text-xs font-mono-tabular text-emerald-700 dark:text-emerald-400">
                      Best alternative: {currentAnalyzed.bestMoveSan}
                    </p>
                  )}
                </div>
              )}

              {/* Move Classification Breakdown */}
              <div className="max-h-56 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
                {review.moves.map((m) => (
                  <button
                    key={m.ply}
                    type="button"
                    onClick={() => setCurrentPly(m.ply)}
                    className={`w-full py-2 px-2 flex items-center justify-between text-xs text-left rounded-lg ${
                      m.ply === currentPly
                        ? 'bg-emerald-500/10'
                        : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                    }`}
                  >
                    <span className="font-mono-tabular font-semibold text-slate-900 dark:text-slate-100">
                      {m.moveNumber}.{m.color === 'b' ? '..' : ''} {m.san}
                    </span>
                    <span className={`font-semibold ${CLASSIFICATION_COLOR[m.classification]}`}>
                      {m.classification}
                    </span>
                    <span className="font-mono-tabular text-slate-500 dark:text-slate-400">
                      {m.evalAfterCp >= 0 ? '+' : ''}
                      {(m.evalAfterCp / 100).toFixed(2)}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Load Saved Game / PGN / FEN */}
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
            <h3 className="text-sm font-display font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <FileText className="w-4 h-4 text-emerald-500" />
              Load Saved Game, PGN, or FEN
            </h3>

            {savedGames.length > 0 && (
              <select
                aria-label="Select saved game"
                onChange={(e) => {
                  const g = savedGames.find((x) => x.id === e.target.value);
                  if (g) {
                    setCustomStartFen(null);
                    setMovesSan(g.movesSan);
                    setCurrentPly(g.movesSan.length);
                    setReview(null);
                  }
                }}
                defaultValue=""
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs text-slate-900 dark:text-white"
              >
                <option value="" disabled>
                  Choose a saved local game ({savedGames.length})...
                </option>
                {savedGames.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.whiteName} vs {g.blackName} ({g.result}) — {g.movesSan.length} plies
                  </option>
                ))}
              </select>
            )}

            <div className="flex gap-2">
              <input
                type="text"
                value={pgnInput}
                onChange={(e) => setPgnInput(e.target.value)}
                placeholder="Paste PGN moves (e.g. 1. e4 e5 2. Nf3 Nc6)..."
                className="flex-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs text-slate-900 dark:text-white"
              />
              <button
                type="button"
                onClick={importPgn}
                className="px-3 py-2 rounded-xl bg-slate-900 dark:bg-slate-700 text-white text-xs font-semibold inline-flex items-center gap-1"
              >
                <Upload className="w-3.5 h-3.5" />
                PGN
              </button>
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                value={fenInput}
                onChange={(e) => setFenInput(e.target.value)}
                placeholder="Paste custom FEN position..."
                className="flex-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs text-slate-900 dark:text-white"
              />
              <button
                type="button"
                onClick={importFen}
                className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200"
              >
                FEN
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
