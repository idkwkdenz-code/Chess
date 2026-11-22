import React, { useMemo, useState } from 'react';
import { Chess } from 'chess.js';
import { BookOpen, GraduationCap, Loader2, Send, Sparkles } from 'lucide-react';
import { OPENINGS_DB } from '../data/openings';
import { ChessBoard } from '../components/ChessBoard';
import { analyzePosition } from '../engine/chessEngine';
import { soundEngine } from '../utils/soundEngine';
import type { OpeningEntry, UserSettings } from '../types/chess';

type LearnMode = 'coach' | 'openings';
type CoachLevel = 'Beginner' | 'Intermediate' | 'Advanced' | 'Expert' | 'Master';

export const LearnPage: React.FC<{ settings: UserSettings }> = ({ settings }) => {
  const [tab, setTab] = useState<LearnMode>('coach');
  const [coachLevel, setCoachLevel] = useState<CoachLevel>('Intermediate');
  const [fen, setFen] = useState(new Chess().fen());
  const [movesSan, setMovesSan] = useState<string[]>([]);
  const [question, setQuestion] = useState('');
  const [coachLoading, setCoachLoading] = useState(false);
  const [coachError, setCoachError] = useState('');
  const [messages, setMessages] = useState<{ role: 'coach' | 'student'; text: string }[]>([
    {
      role: 'coach',
      text: 'Welcome to the CART3R Grandmaster Study. Make moves on the board or select a coaching topic below—I will evaluate the exact position and tailor guidance to your chosen level.',
    },
  ]);

  const [selectedOpening, setSelectedOpening] = useState<OpeningEntry>(OPENINGS_DB[0]);
  const [openingStep, setOpeningStep] = useState(OPENINGS_DB[0].moves.length);

  const evalSummary = useMemo(() => {
    const res = analyzePosition(fen, { depth: 2, timeLimitMs: 180 });
    const score = res.mateIn !== null ? `Mate in ${Math.abs(res.mateIn)}` : `${(res.evalCp / 100).toFixed(2)}`;
    return {
      evalCp: res.evalCp,
      mateIn: res.mateIn,
      bestMoveSan: res.bestMoveSan,
      bestMoveUci: res.bestMoveUci,
      text: `Eval ${score}, Best move: ${res.bestMoveSan}, PV: ${res.pvSan.slice(0, 4).join(' ')}`,
    };
  }, [fen]);

  const handleBoardMove = (from: string, to: string, promotion = 'q') => {
    const c = new Chess(fen);
    try {
      const m = c.move({ from, to, promotion });
      if (!m) return false;
      setFen(c.fen());
      setMovesSan((prev) => [...prev, m.san]);
      soundEngine.play(m.captured ? 'capture' : 'move');
      return true;
    } catch {
      return false;
    }
  };

  const askCoach = async (promptText: string) => {
    const clean = promptText.trim();
    if (!clean || coachLoading) return;
    setMessages((m) => [...m, { role: 'student', text: clean }]);
    setQuestion('');
    setCoachError('');
    setCoachLoading(true);

    try {
      const res = await fetch('/api/coach/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fen,
          pgn: movesSan.join(' '),
          evalSummary: evalSummary.text,
          level: coachLevel,
          question: clean,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setCoachError(data.error || 'Unable to reach Chess Coach.');
      } else {
        setMessages((m) => [...m, { role: 'coach', text: data.reply }]);
      }
    } catch {
      setCoachError('Network error while contacting Chess Coach.');
    } finally {
      setCoachLoading(false);
    }
  };

  const openingFen = useMemo(() => {
    const c = new Chess();
    for (let i = 0; i < Math.min(openingStep, selectedOpening.moves.length); i++) {
      try {
        c.move(selectedOpening.moves[i]);
      } catch {
        break;
      }
    }
    return c.fen();
  }, [selectedOpening, openingStep]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold text-slate-900 dark:text-white">
            Grandmaster Coach & Opening Explorer
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            Personalized positional explanations, checkmate patterns, and ECO opening theory.
          </p>
        </div>

        <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-200/70 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
          <button
            type="button"
            onClick={() => setTab('coach')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 ${
              tab === 'coach'
                ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            <GraduationCap className="w-3.5 h-3.5" />
            AI Chess Coach
          </button>
          <button
            type="button"
            onClick={() => setTab('openings')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 ${
              tab === 'openings'
                ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            Opening Explorer
          </button>
        </div>
      </div>

      {tab === 'coach' ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-6 space-y-3">
            <ChessBoard
              fen={fen}
              onMove={handleBoardMove}
              evalCp={evalSummary.evalCp}
              mateIn={evalSummary.mateIn}
              bestMoveArrow={
                evalSummary.bestMoveUci.length >= 4
                  ? { from: evalSummary.bestMoveUci.slice(0, 2), to: evalSummary.bestMoveUci.slice(2, 4) }
                  : null
              }
              settings={settings}
            />
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
              <span>Engine Best: <strong className="text-emerald-600 dark:text-emerald-400">{evalSummary.bestMoveSan || '—'}</strong></span>
              <button
                type="button"
                onClick={() => {
                  setFen(new Chess().fen());
                  setMovesSan([]);
                }}
                className="px-3 py-1 rounded-lg border border-slate-200 dark:border-slate-700 font-medium text-slate-700 dark:text-slate-200"
              >
                Reset Board
              </button>
            </div>
          </div>

          <div className="lg:col-span-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden flex flex-col">
            <div className="relative h-28 bg-slate-950">
              <img
                src="/src/assets/images/chess_coach_study_1795364272039.jpg"
                alt="Grandmaster study desk"
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover opacity-70"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent p-4 flex items-end justify-between gap-2">
                <div>
                  <p className="text-xs font-medium text-amber-400">Grandmaster Study</p>
                  <h2 className="text-base font-display font-bold text-white">Intelligent Chess Coach</h2>
                </div>
                <select
                  value={coachLevel}
                  onChange={(e) => setCoachLevel(e.target.value as CoachLevel)}
                  aria-label="Coach learning level"
                  className="rounded-lg bg-slate-900/90 border border-slate-700 text-xs text-white px-2.5 py-1.5"
                >
                  {(['Beginner', 'Intermediate', 'Advanced', 'Expert', 'Master'] as const).map((lvl) => (
                    <option key={lvl} value={lvl}>
                      Level: {lvl}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex flex-wrap gap-1.5">
              {[
                'Explain the best plan here',
                'Check for tactical motifs & forks',
                'Teach a checkmate pattern',
                'Identify common weaknesses at my level',
                'Create a 7-day study plan',
              ].map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => askCoach(q)}
                  className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-emerald-600 hover:text-white text-xs font-medium text-slate-700 dark:text-slate-200 transition-colors"
                >
                  {q}
                </button>
              ))}
            </div>

            <div className="p-4 space-y-3 h-72 overflow-y-auto">
              {messages.map((m, idx) => (
                <div
                  key={idx}
                  className={`rounded-xl p-3 text-xs sm:text-sm leading-relaxed whitespace-pre-wrap ${
                    m.role === 'coach'
                      ? 'bg-slate-100 dark:bg-slate-800/80 text-slate-800 dark:text-slate-100'
                      : 'bg-emerald-600 text-white ml-8'
                  }`}
                >
                  {m.text}
                </div>
              ))}
              {coachLoading && (
                <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Analyzing position and preparing coaching notes...</span>
                </div>
              )}
              {coachError && (
                <div className="rounded-xl bg-rose-500/10 border border-rose-500/30 p-3 text-xs text-rose-700 dark:text-rose-300">
                  {coachError}
                </div>
              )}
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                askCoach(question);
              }}
              className="p-3 border-t border-slate-100 dark:border-slate-800 flex items-center gap-2"
            >
              <input
                type="text"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="Ask about this position, openings, or tactics..."
                className="flex-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <button
                type="submit"
                disabled={coachLoading}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold inline-flex items-center gap-1.5 disabled:opacity-50"
              >
                <Send className="w-4 h-4" />
                Ask
              </button>
            </form>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-5 space-y-2 max-h-[600px] overflow-y-auto pr-1">
            {OPENINGS_DB.map((op) => {
              const active = selectedOpening.id === op.id;
              return (
                <button
                  key={op.id}
                  type="button"
                  onClick={() => {
                    setSelectedOpening(op);
                    setOpeningStep(op.moves.length);
                  }}
                  className={`w-full text-left rounded-xl border p-4 transition-colors ${
                    active
                      ? 'border-emerald-600 bg-emerald-500/5 dark:bg-emerald-500/10'
                      : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-display font-bold text-slate-900 dark:text-white">
                      {op.name}
                    </span>
                    <span className="font-mono-tabular text-xs font-semibold text-amber-600 dark:text-amber-400">
                      {op.eco}
                    </span>
                  </div>
                  <p className="text-xs font-mono-tabular text-slate-500 dark:text-slate-400 mt-1">
                    {op.moves.join(' ')}
                  </p>
                  <div className="mt-2.5 h-1.5 w-full rounded-full overflow-hidden flex bg-slate-200 dark:bg-slate-800">
                    <div style={{ width: `${op.whiteWinPct}%` }} className="bg-slate-100 dark:bg-slate-200" />
                    <div style={{ width: `${op.drawPct}%` }} className="bg-slate-400" />
                    <div style={{ width: `${op.blackWinPct}%` }} className="bg-slate-800 dark:bg-slate-950" />
                  </div>
                </button>
              );
            })}
          </div>

          <div className="lg:col-span-7 space-y-4">
            <ChessBoard fen={openingFen} onMove={() => false} interactive={false} settings={settings} />

            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-mono-tabular text-amber-600 dark:text-amber-400 font-semibold">
                    ECO {selectedOpening.eco} · W {selectedOpening.whiteWinPct}% / D {selectedOpening.drawPct}% / B {selectedOpening.blackWinPct}%
                  </p>
                  <h2 className="text-xl font-display font-bold text-slate-900 dark:text-white">
                    {selectedOpening.name}
                  </h2>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setOpeningStep((s) => Math.max(0, s - 1))}
                    className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold"
                  >
                    Prev
                  </button>
                  <button
                    type="button"
                    onClick={() => setOpeningStep((s) => Math.min(selectedOpening.moves.length, s + 1))}
                    className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-semibold"
                  >
                    Next
                  </button>
                </div>
              </div>

              <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                {selectedOpening.summary}
              </p>

              <div>
                <h3 className="text-xs font-semibold text-slate-900 dark:text-white mb-2">Strategic Ideas</h3>
                <ul className="space-y-1.5 text-xs sm:text-sm text-slate-600 dark:text-slate-300 list-disc pl-4">
                  {selectedOpening.keyIdeas.map((idea) => (
                    <li key={idea}>{idea}</li>
                  ))}
                </ul>
              </div>

              <div>
                <h3 className="text-xs font-semibold text-slate-900 dark:text-white mb-2">Main Variations</h3>
                <div className="space-y-2">
                  {selectedOpening.variations.map((v) => (
                    <div key={v.name} className="rounded-xl bg-slate-50 dark:bg-slate-800/60 p-3">
                      <p className="text-xs font-semibold text-slate-900 dark:text-white">{v.name}</p>
                      <p className="text-xs font-mono-tabular text-emerald-700 dark:text-emerald-400 mt-0.5">
                        {v.moves.join(' ')}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{v.note}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
