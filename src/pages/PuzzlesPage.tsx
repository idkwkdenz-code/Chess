import React, { useEffect, useMemo, useState } from 'react';
import { Chess } from 'chess.js';
import { CheckCircle2, Flame, HelpCircle, RotateCcw, Swords, Timer, Trophy, XCircle } from 'lucide-react';
import { PUZZLES_DB } from '../data/puzzles';
import { ChessBoard } from '../components/ChessBoard';
import { useAuth } from '../context/AuthContext';
import { soundEngine } from '../utils/soundEngine';
import { getKvValue, setKvValue } from '../utils/offlineDb';
import type { PuzzleItem, UserSettings } from '../types/chess';

type PuzzleMode = 'daily' | 'trainer' | 'rush' | 'battle' | 'endgame';

export const PuzzlesPage: React.FC<{ settings: UserSettings }> = ({ settings }) => {
  const { user, apiFetch, setSession } = useAuth();
  const [mode, setMode] = useState<PuzzleMode>('daily');
  const [themeFilter, setThemeFilter] = useState<string>('All');
  const [puzzleIdx, setPuzzleIdx] = useState(0);
  const [stepIdx, setStepIdx] = useState(0);
  const [fen, setFen] = useState(PUZZLES_DB[0].fen);
  const [lastMove, setLastMove] = useState<{ from: string; to: string } | null>(null);
  const [status, setStatus] = useState<'solving' | 'solved' | 'failed'>('solving');
  const [showHint, setShowHint] = useState(false);

  // Rush & Battle state
  const [rushActive, setRushActive] = useState(false);
  const [rushTimeLeft, setRushTimeLeft] = useState(180);
  const [rushScore, setRushScore] = useState(0);
  const [rushStrikes, setRushStrikes] = useState(0);
  const [bestRush, setBestRush] = useState(0);
  const [aiBattleScore, setAiBattleScore] = useState(0);
  const [localStreak, setLocalStreak] = useState(0);
  const [history, setHistory] = useState<{ id: string; title: string; solved: boolean; at: number }[]>([]);

  useEffect(() => {
    getKvValue<number>('best-puzzle-rush', 0).then(setBestRush);
    getKvValue<typeof history>('puzzle-history', []).then(setHistory);
  }, []);

  const filteredPuzzles = useMemo(() => {
    if (mode === 'daily') return [PUZZLES_DB[new Date().getDate() % PUZZLES_DB.length]];
    if (mode === 'endgame') return PUZZLES_DB.filter((p) => p.theme === 'Endgame' || p.theme === 'Mate in 2');
    if (themeFilter === 'All') return PUZZLES_DB;
    return PUZZLES_DB.filter((p) => p.theme === themeFilter);
  }, [mode, themeFilter]);

  const currentPuzzle: PuzzleItem = filteredPuzzles[puzzleIdx % filteredPuzzles.length] || PUZZLES_DB[0];

  const loadPuzzle = (pz: PuzzleItem) => {
    setFen(pz.fen);
    setStepIdx(0);
    setLastMove(null);
    setStatus('solving');
    setShowHint(false);
  };

  useEffect(() => {
    loadPuzzle(currentPuzzle);
  }, [currentPuzzle.id, mode]);

  // Puzzle Rush / Battle countdown
  useEffect(() => {
    if (!rushActive) return;
    const t = setInterval(() => {
      setRushTimeLeft((prev) => {
        if (prev <= 1) {
          setRushActive(false);
          return 0;
        }
        return prev - 1;
      });
      if (mode === 'battle' && Math.random() < 0.065) {
        setAiBattleScore((s) => s + 1);
      }
    }, 1000);
    return () => clearInterval(t);
  }, [rushActive, mode]);

  const startRushOrBattle = () => {
    setRushScore(0);
    setRushStrikes(0);
    setAiBattleScore(0);
    setRushTimeLeft(mode === 'battle' ? 120 : 180);
    setRushActive(true);
    setPuzzleIdx(Math.floor(Math.random() * PUZZLES_DB.length));
  };

  const recordResult = async (solved: boolean) => {
    const entry = { id: currentPuzzle.id, title: currentPuzzle.title, solved, at: Date.now() };
    const nextHist = [entry, ...history].slice(0, 30);
    setHistory(nextHist);
    setKvValue('puzzle-history', nextHist);
    setLocalStreak((s) => (solved ? s + 1 : 0));

    if (user) {
      try {
        const res = await apiFetch<{ user: typeof user }>('/api/games/record-practice', {
          method: 'POST',
          body: JSON.stringify({ type: 'puzzle', solved }),
        });
        setSession(res.user, null);
      } catch {
        // Offline safe
      }
    }
  };

  const handleMove = (from: string, to: string, promotion = 'q') => {
    if (status !== 'solving') return false;
    const chess = new Chess(fen);
    let moveRes;
    try {
      moveRes = chess.move({ from, to, promotion });
    } catch {
      return false;
    }
    if (!moveRes) return false;

    const expectedSan = currentPuzzle.solutionSan[stepIdx];
    const isCorrect =
      moveRes.san === expectedSan ||
      moveRes.san.replace(/[+#]/g, '') === expectedSan.replace(/[+#]/g, '');

    if (!isCorrect) {
      soundEngine.play('defeat');
      setStatus('failed');
      recordResult(false);
      if (rushActive) {
        const nextStrikes = rushStrikes + 1;
        setRushStrikes(nextStrikes);
        if (nextStrikes >= 3 && mode === 'rush') {
          setRushActive(false);
        } else {
          setTimeout(() => setPuzzleIdx((i) => i + 1), 650);
        }
      }
      return false;
    }

    setFen(chess.fen());
    setLastMove({ from: moveRes.from, to: moveRes.to });
    soundEngine.play(chess.isCheckmate() ? 'checkmate' : moveRes.captured ? 'capture' : 'move');

    const nextStep = stepIdx + 1;
    if (nextStep >= currentPuzzle.solutionSan.length) {
      setStatus('solved');
      soundEngine.play('victory');
      recordResult(true);
      if (rushActive) {
        const nextScore = rushScore + 1;
        setRushScore(nextScore);
        if (nextScore > bestRush) {
          setBestRush(nextScore);
          setKvValue('best-puzzle-rush', nextScore);
        }
        setTimeout(() => setPuzzleIdx((i) => i + 1), 600);
      }
      return true;
    }

    // Play opponent's forced reply after short pause
    setStepIdx(nextStep);
    setTimeout(() => {
      const replyChess = new Chess(chess.fen());
      const oppSan = currentPuzzle.solutionSan[nextStep];
      try {
        const oppMove = replyChess.move(oppSan);
        if (oppMove) {
          setFen(replyChess.fen());
          setLastMove({ from: oppMove.from, to: oppMove.to });
          soundEngine.play('move');
          if (nextStep + 1 >= currentPuzzle.solutionSan.length) {
            setStatus('solved');
            recordResult(true);
          } else {
            setStepIdx(nextStep + 1);
          }
        }
      } catch {
        // ignore
      }
    }, 360);

    return true;
  };

  const themes = ['All', 'Mate in 1', 'Mate in 2', 'Fork', 'Pin', 'Skewer', 'Discovered Attack', 'Sacrifice', 'Endgame'];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold text-slate-900 dark:text-white">
            Tactical Puzzles & Training
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            Puzzle Rating: <span className="font-mono-tabular font-semibold text-slate-900 dark:text-white">{user?.ratings.puzzle ?? 400}</span> · Current Streak: <span className="font-mono-tabular font-semibold text-emerald-600 dark:text-emerald-400">{user?.stats.puzzleStreak ?? localStreak}</span> · Best Rush: <span className="font-mono-tabular font-semibold">{bestRush}</span>
          </p>
        </div>

        <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-200/70 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-x-auto">
          {(
            [
              { id: 'daily', label: 'Daily' },
              { id: 'trainer', label: 'Tactics' },
              { id: 'rush', label: 'Puzzle Rush' },
              { id: 'battle', label: 'Puzzle Battle' },
              { id: 'endgame', label: 'Checkmates & Endgames' },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => {
                setRushActive(false);
                setMode(t.id);
                setPuzzleIdx(0);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                mode === t.id
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-7 flex flex-col items-center">
          <ChessBoard
            fen={fen}
            onMove={handleMove}
            lastMove={lastMove}
            interactive={status === 'solving' && (mode !== 'rush' && mode !== 'battle' ? true : rushActive)}
            settings={settings}
            bestMoveArrow={
              showHint && currentPuzzle.solutionSan[stepIdx]
                ? (() => {
                    const tmp = new Chess(fen);
                    const mv = tmp.moves({ verbose: true }).find((m) => m.san === currentPuzzle.solutionSan[stepIdx]);
                    return mv ? { from: mv.from, to: mv.to } : null;
                  })()
                : null
            }
          />
        </div>

        <div className="lg:col-span-5 space-y-4">
          {(mode === 'rush' || mode === 'battle') && (
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {mode === 'rush' ? <Flame className="w-5 h-5 text-amber-500" /> : <Swords className="w-5 h-5 text-emerald-500" />}
                  <h2 className="text-base font-display font-bold text-slate-900 dark:text-white">
                    {mode === 'rush' ? '3-Minute Puzzle Rush' : 'Puzzle Battle vs Academy Bot'}
                  </h2>
                </div>
                <span className="font-mono-tabular text-lg font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                  <Timer className="w-4 h-4" />
                  {Math.floor(rushTimeLeft / 60)}:{String(rushTimeLeft % 60).padStart(2, '0')}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 text-center">
                <div className="rounded-xl bg-slate-100 dark:bg-slate-800/70 p-3">
                  <p className="text-xs text-slate-500 dark:text-slate-400">Your Score</p>
                  <p className="text-2xl font-mono-tabular font-bold text-slate-900 dark:text-white">{rushScore}</p>
                </div>
                {mode === 'rush' ? (
                  <div className="rounded-xl bg-slate-100 dark:bg-slate-800/70 p-3">
                    <p className="text-xs text-slate-500 dark:text-slate-400">Strikes</p>
                    <p className="text-2xl font-mono-tabular font-bold text-rose-600 dark:text-rose-400">{rushStrikes} / 3</p>
                  </div>
                ) : (
                  <div className="rounded-xl bg-slate-100 dark:bg-slate-800/70 p-3">
                    <p className="text-xs text-slate-500 dark:text-slate-400">Rival Bot</p>
                    <p className="text-2xl font-mono-tabular font-bold text-amber-600 dark:text-amber-400">{aiBattleScore}</p>
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={startRushOrBattle}
                className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold"
              >
                {rushActive ? 'Restart Session' : `Start ${mode === 'rush' ? 'Puzzle Rush' : 'Puzzle Battle'}`}
              </button>
            </div>
          )}

          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {currentPuzzle.theme} · Rating {currentPuzzle.rating}
                </p>
                <h2 className="text-lg font-display font-bold text-slate-900 dark:text-white mt-0.5">
                  {currentPuzzle.title}
                </h2>
              </div>
              <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                {new Chess(fen).turn() === 'w' ? 'White to move' : 'Black to move'}
              </span>
            </div>

            {mode === 'trainer' && (
              <div className="flex flex-wrap gap-1.5">
                {themes.map((th) => (
                  <button
                    key={th}
                    type="button"
                    onClick={() => {
                      setThemeFilter(th);
                      setPuzzleIdx(0);
                    }}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                      themeFilter === th
                        ? 'bg-emerald-600 text-white'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    {th}
                  </button>
                ))}
              </div>
            )}

            {status === 'solved' && (
              <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/30 p-3.5 text-xs sm:text-sm text-emerald-800 dark:text-emerald-300 flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold">Puzzle Solved!</p>
                  <p className="mt-1 opacity-90">{currentPuzzle.explanation}</p>
                </div>
              </div>
            )}

            {status === 'failed' && (
              <div className="rounded-xl bg-rose-500/10 border border-rose-500/30 p-3.5 text-xs sm:text-sm text-rose-800 dark:text-rose-300 flex items-start gap-2.5">
                <XCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold">Not the sharpest move.</p>
                  <p className="mt-1 opacity-90">Retry the position or reveal a tactical hint.</p>
                </div>
              </div>
            )}

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setShowHint((h) => !h)}
                className="px-3.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 inline-flex items-center gap-1.5"
              >
                <HelpCircle className="w-3.5 h-3.5" />
                {showHint ? 'Hide Hint' : 'Hint'}
              </button>
              <button
                type="button"
                onClick={() => loadPuzzle(currentPuzzle)}
                className="px-3.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 inline-flex items-center gap-1.5"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Retry
              </button>
              {mode !== 'daily' && (
                <button
                  type="button"
                  onClick={() => setPuzzleIdx((i) => i + 1)}
                  className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold ml-auto"
                >
                  Next Puzzle
                </button>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
            <div className="flex items-center gap-2 mb-3">
              <Trophy className="w-4 h-4 text-amber-500" />
              <h3 className="text-sm font-display font-bold text-slate-900 dark:text-white">
                Recent Puzzle History
              </h3>
            </div>
            {history.length === 0 ? (
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Complete a puzzle to log your accuracy history.
              </p>
            ) : (
              <div className="space-y-2 max-h-44 overflow-y-auto">
                {history.slice(0, 8).map((h, i) => (
                  <div key={`${h.id}-${i}`} className="flex items-center justify-between text-xs py-1 border-b border-slate-100 dark:border-slate-800 last:border-none">
                    <span className="text-slate-700 dark:text-slate-300 truncate">{h.title}</span>
                    <span className={`font-semibold ${h.solved ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500'}`}>
                      {h.solved ? 'Solved' : 'Missed'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
