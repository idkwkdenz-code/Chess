import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Chess } from 'chess.js';
import {
  Bot,
  Copy,
  Crown,
  Eye,
  Flag,
  Handshake,
  Lightbulb,
  MessageSquare,
  Play as PlayIcon,
  Plus,
  RefreshCw,
  RotateCcw,
  RotateCw,
  Save,
  Send,
  Swords,
  Trophy,
  Undo2,
  Users,
} from 'lucide-react';
import { LEGENDARY_BOTS } from '../data/legends';
import { TIME_CONTROLS } from '../data/themes';
import { ChessBoard } from '../components/ChessBoard';
import { ChessClock } from '../components/ChessClock';
import { LegendAvatar, UserTitleBadge } from '../components/PlayerBadges';
import {
  analyzePosition,
  buildMirrorStyleProfile,
  detectOpening,
  selectBotMove,
} from '../engine/chessEngine';
import { useAuth } from '../context/AuthContext';
import { getAllOfflineGames, saveGameOffline } from '../utils/offlineDb';
import { soundEngine } from '../utils/soundEngine';
import type {
  LegendaryBot,
  SavedGameRecord,
  TimeCategory,
  TimeControl,
  TournamentRecord,
  UserSettings,
} from '../types/chess';

type PlaySubMode = 'online' | 'stockfish' | 'legends' | 'mirror' | 'local' | 'tournaments';
type MirrorSubMode = 'mirror-self' | 'mirror-ai' | 'mirror-random' | 'mirror-ghost';

interface PlayPageProps {
  settings: UserSettings;
  initialSubMode?: string;
  onReviewGame: (game: SavedGameRecord) => void;
}

export const PlayPage: React.FC<PlayPageProps> = ({ settings, initialSubMode, onReviewGame }) => {
  const {
    user,
    appConfig,
    wsConnected,
    lobbyGames,
    queueSize,
    activeOnlineGame,
    setActiveOnlineGame,
    sendWs,
    apiFetch,
    setSession,
  } = useAuth();

  const [subMode, setSubMode] = useState<PlaySubMode>(
    (['online', 'stockfish', 'legends', 'mirror', 'local', 'tournaments'].includes(initialSubMode || '')
      ? initialSubMode
      : 'stockfish') as PlaySubMode
  );

  useEffect(() => {
    if (
      initialSubMode &&
      ['online', 'stockfish', 'legends', 'mirror', 'local', 'tournaments'].includes(initialSubMode)
    ) {
      setSubMode(initialSubMode as PlaySubMode);
    }
  }, [initialSubMode]);

  // Time control selection (including custom)
  const [tcCategoryFilter, setTcCategoryFilter] = useState<TimeCategory | 'all'>('blitz');
  const [selectedTc, setSelectedTc] = useState<TimeControl>(TIME_CONTROLS[5]); // 3+2
  const [customMin, setCustomMin] = useState(7);
  const [customInc, setCustomInc] = useState(3);

  // Online lobby & matchmaking state
  const [inQueue, setInQueue] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [friendChallengeName, setFriendChallengeName] = useState('');
  const [chatText, setChatText] = useState('');
  const [onlineTickNow, setOnlineTickNow] = useState(Date.now());
  const [reportNotice, setReportNotice] = useState('');

  // Offline / Local / Engine / Mirror / Legend game state
  const [gameId, setGameId] = useState(() => `loc-${Date.now()}`);
  const [chessInstance] = useState(() => new Chess());
  const [fen, setFen] = useState(chessInstance.fen());
  const [movesSan, setMovesSan] = useState<string[]>([]);
  const [redoStack, setRedoStack] = useState<string[]>([]);
  const [lastMove, setLastMove] = useState<{ from: string; to: string } | null>(null);
  const [flipped, setFlipped] = useState(false);
  const [playerSide, setPlayerSide] = useState<'w' | 'b'>('w');
  const [gameResult, setGameResult] = useState<'1-0' | '0-1' | '1/2-1/2' | '*'>('*');
  const [termination, setTermination] = useState('');

  // Offline clocks
  const [whiteTimeMs, setWhiteTimeMs] = useState(selectedTc.initialSeconds * 1000);
  const [blackTimeMs, setBlackTimeMs] = useState(selectedTc.initialSeconds * 1000);
  const [clockRunning, setClockRunning] = useState(false);

  // Stockfish & Engine vs Engine
  const [stockfishSkill, setStockfishSkill] = useState(10);
  const [engineVsEngine, setEngineVsEngine] = useState(false);
  const [botThinking, setBotThinking] = useState(false);
  const [hintArrow, setHintArrow] = useState<{ from: string; to: string } | null>(null);

  // Legends
  const [selectedLegend, setSelectedLegend] = useState<LegendaryBot>(LEGENDARY_BOTS[0]);
  const [legendSearch, setLegendSearch] = useState('');

  // Mirror Bot
  const [mirrorSubMode, setMirrorSubMode] = useState<MirrorSubMode>('mirror-ai');
  const [savedGames, setSavedGames] = useState<SavedGameRecord[]>([]);
  const [ghostGame, setGhostGame] = useState<SavedGameRecord | null>(null);
  const [ghostPly, setGhostPly] = useState(0);

  // Tournaments
  const [tournaments, setTournaments] = useState<TournamentRecord[]>([]);
  const [newTourneyName, setNewTourneyName] = useState('');
  const [newTourneyFormat, setNewTourneyFormat] = useState<'Arena' | 'Swiss' | 'Knockout'>('Arena');
  const [newTourneyVis, setNewTourneyVis] = useState<'public' | 'private'>('public');

  const botTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadSavedArchive = async () => {
    const all = await getAllOfflineGames();
    setSavedGames(all);
  };

  useEffect(() => {
    loadSavedArchive();
    fetch('/api/tournaments')
      .then((r) => r.json())
      .then((d) => d.tournaments && setTournaments(d.tournaments))
      .catch(() => {});
  }, [subMode]);

  const mirrorProfile = useMemo(() => buildMirrorStyleProfile(savedGames), [savedGames]);

  const liveEval = useMemo(() => {
    if (!appConfig.features.stockfishEnabled) return null;
    return analyzePosition(fen, { depth: 2, timeLimitMs: 140 });
  }, [fen, appConfig.features.stockfishEnabled]);

  const activeOpening = useMemo(() => detectOpening(movesSan), [movesSan]);

  const resetOfflineBoard = (tc: TimeControl = selectedTc, side: 'w' | 'b' = playerSide) => {
    if (botTimerRef.current) clearTimeout(botTimerRef.current);
    chessInstance.reset();
    setGameId(`loc-${Date.now()}`);
    setFen(chessInstance.fen());
    setMovesSan([]);
    setRedoStack([]);
    setLastMove(null);
    setGameResult('*');
    setTermination('');
    setHintArrow(null);
    setWhiteTimeMs(tc.initialSeconds * 1000);
    setBlackTimeMs(tc.initialSeconds * 1000);
    setClockRunning(false);
    setBotThinking(false);
    setFlipped(side === 'b');
    setGhostPly(0);
  };

  // Save current offline game to IndexedDB
  const persistOfflineGame = async (
    nextResult: '1-0' | '0-1' | '1/2-1/2' | '*' = gameResult,
    nextTerm = termination,
    nextMoves = movesSan,
    nextFen = fen
  ) => {
    if (nextMoves.length === 0) return;
    const whiteName =
      subMode === 'stockfish'
        ? engineVsEngine
          ? `Engine Lv.${stockfishSkill}`
          : playerSide === 'w'
            ? user?.username || 'You'
            : `Stockfish Lv.${stockfishSkill}`
        : subMode === 'legends'
          ? playerSide === 'w'
            ? user?.username || 'You'
            : selectedLegend.name
          : subMode === 'mirror'
            ? mirrorSubMode === 'mirror-self'
              ? 'Self-Play (White)'
              : playerSide === 'w'
                ? user?.username || 'You'
                : 'Mirror Bot'
            : 'Local White';

    const blackName =
      subMode === 'stockfish'
        ? engineVsEngine
          ? `Engine Lv.${Math.max(1, stockfishSkill - 1)}`
          : playerSide === 'b'
            ? user?.username || 'You'
            : `Stockfish Lv.${stockfishSkill}`
        : subMode === 'legends'
          ? playerSide === 'b'
            ? user?.username || 'You'
            : selectedLegend.name
          : subMode === 'mirror'
            ? mirrorSubMode === 'mirror-self'
              ? 'Self-Play (Black)'
              : playerSide === 'b'
                ? user?.username || 'You'
                : 'Mirror Bot'
            : 'Local Black';

    const rec: SavedGameRecord = {
      id: gameId,
      mode:
        subMode === 'mirror'
          ? mirrorSubMode
          : subMode === 'legends'
            ? 'legend'
            : subMode === 'stockfish'
              ? 'stockfish'
              : 'local',
      whiteName,
      blackName,
      timeControlLabel: selectedTc.label,
      category: selectedTc.category,
      fen: nextFen,
      pgn: chessInstance.pgn(),
      movesSan: nextMoves,
      result: nextResult,
      termination: nextTerm || 'In Progress',
      playerColor: subMode === 'local' || mirrorSubMode === 'mirror-self' ? 'both' : playerSide,
      openingName: detectOpening(nextMoves).name,
      ecoCode: detectOpening(nextMoves).eco,
      legendId: subMode === 'legends' ? selectedLegend.id : undefined,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    await saveGameOffline(rec);
    await loadSavedArchive();
  };

  // Offline Clock Ticker
  useEffect(() => {
    if (!clockRunning || gameResult !== '*' || subMode === 'online' || subMode === 'tournaments') return;
    const interval = setInterval(() => {
      const turn = chessInstance.turn();
      if (turn === 'w') {
        setWhiteTimeMs((ms) => {
          if (ms <= 200) {
            setClockRunning(false);
            setGameResult('0-1');
            setTermination('Timeout — Black wins on time');
            soundEngine.play('defeat');
            return 0;
          }
          return ms - 200;
        });
      } else {
        setBlackTimeMs((ms) => {
          if (ms <= 200) {
            setClockRunning(false);
            setGameResult('1-0');
            setTermination('Timeout — White wins on time');
            soundEngine.play('victory');
            return 0;
          }
          return ms - 200;
        });
      }
    }, 200);
    return () => clearInterval(interval);
  }, [clockRunning, gameResult, subMode]);

  // Online clock smooth UI ticker
  useEffect(() => {
    if (!activeOnlineGame || activeOnlineGame.status !== 'active') return;
    const t = setInterval(() => setOnlineTickNow(Date.now()), 200);
    return () => clearInterval(t);
  }, [activeOnlineGame]);

  const checkOfflineEnd = async (c: Chess, nextMoves: string[]) => {
    if (!c.isGameOver()) return false;
    let res: '1-0' | '0-1' | '1/2-1/2' = '1/2-1/2';
    let term = 'Draw';
    if (c.isCheckmate()) {
      res = c.turn() === 'b' ? '1-0' : '0-1';
      term = `Checkmate — ${res === '1-0' ? 'White' : 'Black'} wins`;
      soundEngine.play('checkmate');
    } else if (c.isStalemate()) {
      term = 'Draw by stalemate';
      soundEngine.play('draw');
    } else if (c.isThreefoldRepetition()) {
      term = 'Draw by threefold repetition';
      soundEngine.play('draw');
    } else if (c.isInsufficientMaterial()) {
      term = 'Draw by insufficient material';
      soundEngine.play('draw');
    } else {
      term = 'Draw by 50-move rule';
      soundEngine.play('draw');
    }
    setGameResult(res);
    setTermination(term);
    setClockRunning(false);
    await persistOfflineGame(res, term, nextMoves, c.fen());

    if (user && (subMode === 'stockfish' || subMode === 'legends')) {
      const outcome =
        res === '1/2-1/2'
          ? 'draw'
          : (res === '1-0' && playerSide === 'w') || (res === '0-1' && playerSide === 'b')
            ? 'win'
            : 'loss';
      try {
        const r = await apiFetch<{ user: typeof user }>('/api/games/record-practice', {
          method: 'POST',
          body: JSON.stringify({
            type: 'practice-ai',
            outcome,
            legendId: subMode === 'legends' ? selectedLegend.id : null,
            termination: term,
          }),
        });
        setSession(r.user, null);
      } catch {
        // offline safe
      }
    }
    return true;
  };

  // Trigger Bot Move (Stockfish, Legendary AI, Mirror AI, Random Mirror, Ghost Replay, or Engine vs Engine)
  useEffect(() => {
    if (gameResult !== '*') return;
    if (subMode === 'online' || subMode === 'local' || subMode === 'tournaments') return;
    if (subMode === 'mirror' && mirrorSubMode === 'mirror-self') return;

    const turn = chessInstance.turn();
    const shouldBotMove =
      (subMode === 'stockfish' && (engineVsEngine || turn !== playerSide)) ||
      (subMode === 'legends' && turn !== playerSide) ||
      (subMode === 'mirror' && turn !== playerSide);

    if (!shouldBotMove) return;

    setBotThinking(true);
    botTimerRef.current = setTimeout(async () => {
      let chosenSan = '';
      if (subMode === 'mirror' && mirrorSubMode === 'mirror-ghost' && ghostGame) {
        const candidate = ghostGame.movesSan[movesSan.length];
        if (candidate && chessInstance.moves().includes(candidate)) {
          chosenSan = candidate;
        }
      }

      if (!chosenSan) {
        const botChoice = selectBotMove(chessInstance.fen(), movesSan, {
          skillLevel:
            subMode === 'mirror' && mirrorSubMode === 'mirror-random'
              ? stockfishSkill
              : stockfishSkill,
          legend: subMode === 'legends' ? selectedLegend : undefined,
          mirrorProfile:
            subMode === 'mirror' && mirrorSubMode === 'mirror-ai' ? mirrorProfile : undefined,
        });
        chosenSan = botChoice.san;
      }

      if (!chosenSan) {
        setBotThinking(false);
        return;
      }

      const prevTurn = chessInstance.turn();
      const moveRes = chessInstance.move(chosenSan);
      if (moveRes) {
        if (prevTurn === 'w') setWhiteTimeMs((ms) => ms + selectedTc.incrementSeconds * 1000);
        else setBlackTimeMs((ms) => ms + selectedTc.incrementSeconds * 1000);

        const nextMoves = [...movesSan, moveRes.san];
        setFen(chessInstance.fen());
        setMovesSan(nextMoves);
        setLastMove({ from: moveRes.from, to: moveRes.to });
        setHintArrow(null);
        setClockRunning(true);

        if (chessInstance.inCheck()) soundEngine.play('check');
        else if (moveRes.san === 'O-O' || moveRes.san === 'O-O-O') soundEngine.play('castle');
        else if (moveRes.captured) soundEngine.play('capture');
        else soundEngine.play('move');

        const ended = await checkOfflineEnd(chessInstance, nextMoves);
        if (!ended && nextMoves.length % 4 === 0) {
          persistOfflineGame('*', 'In Progress', nextMoves, chessInstance.fen());
        }
      }
      setBotThinking(false);
    }, engineVsEngine ? 520 : 420);

    return () => {
      if (botTimerRef.current) clearTimeout(botTimerRef.current);
    };
  }, [fen, subMode, mirrorSubMode, engineVsEngine, playerSide, stockfishSkill, selectedLegend.id, gameResult]);

  const handleOfflineMove = (from: string, to: string, promotion = 'q') => {
    if (gameResult !== '*' || botThinking) return false;
    const prevTurn = chessInstance.turn();
    let moveRes;
    try {
      moveRes = chessInstance.move({ from, to, promotion });
    } catch {
      return false;
    }
    if (!moveRes) return false;

    if (prevTurn === 'w') setWhiteTimeMs((ms) => ms + selectedTc.incrementSeconds * 1000);
    else setBlackTimeMs((ms) => ms + selectedTc.incrementSeconds * 1000);

    const nextMoves = [...movesSan, moveRes.san];
    setFen(chessInstance.fen());
    setMovesSan(nextMoves);
    setRedoStack([]);
    setLastMove({ from: moveRes.from, to: moveRes.to });
    setHintArrow(null);
    setClockRunning(true);

    if (subMode === 'mirror' && mirrorSubMode === 'mirror-self' && settings.autoFlipSelfPlay) {
      setFlipped(chessInstance.turn() === 'b');
    }

    if (chessInstance.inCheck()) soundEngine.play('check');
    else if (moveRes.san === 'O-O' || moveRes.san === 'O-O-O') soundEngine.play('castle');
    else if (moveRes.promotion) soundEngine.play('promote');
    else if (moveRes.captured) soundEngine.play('capture');
    else soundEngine.play('move');

    checkOfflineEnd(chessInstance, nextMoves);
    return true;
  };

  const handleUndo = () => {
    if (movesSan.length === 0 || botThinking) return;
    const steps =
      subMode === 'local' || (subMode === 'mirror' && mirrorSubMode === 'mirror-self')
        ? 1
        : Math.min(2, movesSan.length);
    const popped: string[] = [];
    for (let i = 0; i < steps; i++) {
      const u = chessInstance.undo();
      if (u) popped.unshift(u.san);
    }
    setFen(chessInstance.fen());
    setMovesSan((prev) => prev.slice(0, prev.length - popped.length));
    setRedoStack((prev) => [...popped, ...prev]);
    setGameResult('*');
    setTermination('');
    setLastMove(null);
  };

  const handleRedo = () => {
    if (redoStack.length === 0) return;
    const nextSan = redoStack[0];
    try {
      const m = chessInstance.move(nextSan);
      if (m) {
        setFen(chessInstance.fen());
        setMovesSan((prev) => [...prev, m.san]);
        setRedoStack((prev) => prev.slice(1));
        setLastMove({ from: m.from, to: m.to });
      }
    } catch {
      // ignore
    }
  };

  // Online computed remaining clocks
  const onlineClocks = useMemo(() => {
    if (!activeOnlineGame) return { whiteMs: 0, blackMs: 0 };
    if (activeOnlineGame.status !== 'active' || activeOnlineGame.movesSan.length === 0) {
      return { whiteMs: activeOnlineGame.whiteTimeMs, blackMs: activeOnlineGame.blackTimeMs };
    }
    const elapsed = Math.max(0, onlineTickNow - activeOnlineGame.lastTickAt);
    return {
      whiteMs:
        activeOnlineGame.turn === 'w'
          ? Math.max(0, activeOnlineGame.whiteTimeMs - elapsed)
          : activeOnlineGame.whiteTimeMs,
      blackMs:
        activeOnlineGame.turn === 'b'
          ? Math.max(0, activeOnlineGame.blackTimeMs - elapsed)
          : activeOnlineGame.blackTimeMs,
    };
  }, [activeOnlineGame, onlineTickNow]);

  const filteredTimeControls = useMemo(() => {
    if (tcCategoryFilter === 'all') return TIME_CONTROLS;
    return TIME_CONTROLS.filter((t) => t.category === tcCategoryFilter);
  }, [tcCategoryFilter]);

  return (
    <div className="space-y-6">
      {/* Sub-mode Segmented Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold text-slate-900 dark:text-white">
            Play Chess
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            Online Arena · Stockfish Engine · 16 Legendary AIs · Mirror Bot · Tournaments
          </p>
        </div>

        <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-200/70 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-x-auto max-w-full">
          {(
            [
              { id: 'online', label: 'Online', icon: Swords },
              { id: 'stockfish', label: 'Stockfish', icon: Bot },
              { id: 'legends', label: 'Legends (16)', icon: Crown },
              { id: 'mirror', label: 'Mirror Bot', icon: RefreshCw },
              { id: 'local', label: 'Pass & Play', icon: Users },
              { id: 'tournaments', label: 'Tournaments', icon: Trophy },
            ] as const
          ).map((m) => {
            const Icon = m.icon;
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => setSubMode(m.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors ${
                  subMode === m.id
                    ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {m.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* =================================================================== */}
      {/* ONLINE MULTIPLAYER MODE                                             */}
      {/* =================================================================== */}
      {subMode === 'online' && (
        <div className="space-y-6">
          {!activeOnlineGame ? (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              <div className="lg:col-span-7 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-5">
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-display font-bold text-slate-900 dark:text-white">
                    Live Matchmaking & Custom Time Controls
                  </h2>
                  <span className="text-xs font-mono-tabular text-slate-500 dark:text-slate-400">
                    WS: {wsConnected ? 'Connected' : 'Connecting...'} · Queue: {queueSize}
                  </span>
                </div>

                {/* Time Control Category Filter */}
                <div className="flex flex-wrap gap-1.5">
                  {(['bullet', 'blitz', 'rapid', 'classical', 'all'] as const).map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setTcCategoryFilter(cat)}
                      className={`px-3 py-1 rounded-lg text-xs font-semibold capitalize ${
                        tcCategoryFilter === cat
                          ? 'bg-emerald-600 text-white'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {filteredTimeControls.map((tc) => (
                    <button
                      key={tc.id}
                      type="button"
                      onClick={() => setSelectedTc(tc)}
                      className={`py-2.5 px-3 rounded-xl border text-center transition-colors ${
                        selectedTc.id === tc.id
                          ? 'border-emerald-600 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                          : 'border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200'
                      }`}
                    >
                      <p className="text-sm font-mono-tabular font-bold">{tc.label}</p>
                      <p className="text-[10px] capitalize text-slate-500">{tc.category}</p>
                    </button>
                  ))}
                </div>

                {/* Custom Time Control */}
                <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
                  <span className="font-medium text-slate-600 dark:text-slate-300">Custom:</span>
                  <input
                    type="number"
                    min={1}
                    max={180}
                    value={customMin}
                    onChange={(e) => setCustomMin(Number(e.target.value) || 5)}
                    className="w-16 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-2 py-1 font-mono-tabular"
                  />
                  <span>min +</span>
                  <input
                    type="number"
                    min={0}
                    max={60}
                    value={customInc}
                    onChange={(e) => setCustomInc(Number(e.target.value) || 0)}
                    className="w-16 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-2 py-1 font-mono-tabular"
                  />
                  <span>sec</span>
                  <button
                    type="button"
                    onClick={() => {
                      const cat: TimeCategory =
                        customMin < 3 ? 'bullet' : customMin < 10 ? 'blitz' : customMin <= 30 ? 'rapid' : 'classical';
                      setSelectedTc({
                        id: `custom-${customMin}-${customInc}`,
                        label: `${customMin}+${customInc}`,
                        category: cat,
                        initialSeconds: customMin * 60,
                        incrementSeconds: customInc,
                      });
                    }}
                    className="px-3 py-1 rounded-lg bg-slate-900 dark:bg-slate-700 text-white font-semibold"
                  >
                    Apply
                  </button>
                </div>

                {!user ? (
                  <div className="rounded-xl bg-amber-500/10 border border-amber-500/30 p-3.5 text-xs text-amber-800 dark:text-amber-300">
                    Sign in on the Profile tab to queue for rated matchmaking, create friend challenges, or chat in online rooms. Guests can spectate active games below!
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2.5">
                    {!inQueue ? (
                      <button
                        type="button"
                        onClick={() => {
                          setInQueue(true);
                          sendWs('queue:join', { timeControl: selectedTc });
                        }}
                        className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold inline-flex items-center gap-2"
                      >
                        <Swords className="w-4 h-4" />
                        Find Opponent ({selectedTc.label})
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setInQueue(false);
                          sendWs('queue:leave');
                        }}
                        className="px-5 py-2.5 rounded-xl bg-amber-600 text-white text-sm font-semibold"
                      >
                        Searching... Click to Cancel
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => sendWs('game:create', { timeControl: selectedTc, visibility: 'public', rated: true })}
                      className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold"
                    >
                      Create Open Table
                    </button>

                    <button
                      type="button"
                      onClick={() => sendWs('game:create', { timeControl: selectedTc, visibility: 'private', rated: false })}
                      className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold"
                    >
                      Create Private Room
                    </button>
                  </div>
                )}

                {user && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={friendChallengeName}
                        onChange={(e) => setFriendChallengeName(e.target.value)}
                        placeholder="Challenge @username..."
                        className="flex-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          if (!friendChallengeName.trim()) return;
                          sendWs('game:create', {
                            timeControl: selectedTc,
                            visibility: 'private',
                            rated: true,
                            targetUsername: friendChallengeName.trim(),
                          });
                          setFriendChallengeName('');
                        }}
                        className="px-3 py-2 rounded-xl bg-slate-900 dark:bg-slate-700 text-white text-xs font-semibold"
                      >
                        Challenge
                      </button>
                    </div>

                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={joinCode}
                        onChange={(e) => setJoinCode(e.target.value)}
                        placeholder="Private invite code..."
                        className="flex-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs font-mono-tabular uppercase"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          if (!joinCode.trim()) return;
                          sendWs('game:join', { inviteCode: joinCode.trim() });
                          setJoinCode('');
                        }}
                        className="px-3 py-2 rounded-xl bg-emerald-600 text-white text-xs font-semibold"
                      >
                        Join Code
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Public Games & Spectator Lobby */}
              <div className="lg:col-span-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
                <h2 className="text-base font-display font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Eye className="w-4 h-4 text-emerald-500" />
                  Live Public Tables & Spectator Mode ({lobbyGames.length})
                </h2>

                {lobbyGames.length === 0 ? (
                  <p className="text-xs text-slate-500 dark:text-slate-400 py-6 text-center">
                    No open or live public tables right now. Create one or join the matchmaking queue.
                  </p>
                ) : (
                  <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-96 overflow-y-auto">
                    {lobbyGames.map((g) => (
                      <div key={g.id} className="py-3 flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                            {g.whiteName} ({g.whiteRating}) vs {g.blackName}
                          </p>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono-tabular">
                            {g.timeControl.label} · {g.status} · {g.spectatorCount} watching
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            if (g.status === 'waiting' && user && g.whiteId !== user.id) {
                              sendWs('game:join', { gameId: g.id });
                            } else {
                              sendWs('game:watch', { gameId: g.id });
                            }
                          }}
                          className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold whitespace-nowrap shrink-0"
                        >
                          {g.status === 'waiting' && user && g.whiteId !== user.id ? 'Join Match' : 'Spectate'}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* Active Online Board View */
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              <div className="lg:col-span-7 space-y-3">
                {(() => {
                  const amBlack = user?.id === activeOnlineGame.blackId;
                  const amPlayer = user?.id === activeOnlineGame.whiteId || amBlack;
                  const topIsWhite = amBlack;
                  return (
                    <>
                      <ChessClock
                        ms={topIsWhite ? onlineClocks.whiteMs : onlineClocks.blackMs}
                        active={
                          activeOnlineGame.status === 'active' &&
                          activeOnlineGame.turn === (topIsWhite ? 'w' : 'b')
                        }
                        label={topIsWhite ? activeOnlineGame.whiteName : activeOnlineGame.blackName}
                        rating={topIsWhite ? activeOnlineGame.whiteRating : activeOnlineGame.blackRating}
                        subtitle={topIsWhite ? activeOnlineGame.whiteTitle || undefined : activeOnlineGame.blackTitle || undefined}
                      />

                      <ChessBoard
                        fen={activeOnlineGame.fen}
                        flipped={amBlack}
                        interactive={activeOnlineGame.status === 'active' && amPlayer}
                        allowedColor={amBlack ? 'b' : amPlayer ? 'w' : 'both'}
                        lastMove={activeOnlineGame.lastMove}
                        onMove={(from, to, promo) => {
                          if (!amPlayer) return false;
                          sendWs('game:move', {
                            gameId: activeOnlineGame.id,
                            from,
                            to,
                            promotion: promo,
                          });
                          soundEngine.play('move');
                          return true;
                        }}
                        settings={settings}
                      />

                      <ChessClock
                        ms={topIsWhite ? onlineClocks.blackMs : onlineClocks.whiteMs}
                        active={
                          activeOnlineGame.status === 'active' &&
                          activeOnlineGame.turn === (topIsWhite ? 'b' : 'w')
                        }
                        label={topIsWhite ? activeOnlineGame.blackName : activeOnlineGame.whiteName}
                        rating={topIsWhite ? activeOnlineGame.blackRating : activeOnlineGame.whiteRating}
                        subtitle={topIsWhite ? activeOnlineGame.blackTitle || undefined : activeOnlineGame.whiteTitle || undefined}
                      />
                    </>
                  );
                })()}
              </div>

              <div className="lg:col-span-5 space-y-4">
                <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {activeOnlineGame.timeControl.label} · {activeOnlineGame.rated ? 'Rated' : 'Casual'} · {activeOnlineGame.spectatorCount} Spectator(s)
                      </p>
                      <h3 className="text-base font-display font-bold text-slate-900 dark:text-white">
                        {activeOnlineGame.status === 'waiting'
                          ? `Waiting (Invite: ${activeOnlineGame.inviteCode})`
                          : activeOnlineGame.status === 'active'
                            ? `${activeOnlineGame.turn === 'w' ? 'White' : 'Black'} to move`
                            : `${activeOnlineGame.result} · ${activeOnlineGame.termination}`}
                      </h3>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setInQueue(false);
                        setActiveOnlineGame(null);
                      }}
                      className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold"
                    >
                      Leave Room
                    </button>
                  </div>

                  {activeOnlineGame.status === 'active' &&
                    (user?.id === activeOnlineGame.whiteId || user?.id === activeOnlineGame.blackId) && (
                      <div className="flex flex-wrap gap-2">
                        {activeOnlineGame.drawOfferFrom && activeOnlineGame.drawOfferFrom !== user?.id ? (
                          <button
                            type="button"
                            onClick={() => sendWs('game:draw_accept', { gameId: activeOnlineGame.id })}
                            className="px-3.5 py-2 rounded-lg bg-amber-600 text-white text-xs font-semibold"
                          >
                            Accept Draw Offer
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => sendWs('game:draw_offer', { gameId: activeOnlineGame.id })}
                            className="px-3.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold inline-flex items-center gap-1.5"
                          >
                            <Handshake className="w-3.5 h-3.5" />
                            Offer Draw
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => sendWs('game:resign', { gameId: activeOnlineGame.id })}
                          className="px-3.5 py-2 rounded-lg border border-rose-500/40 text-rose-600 dark:text-rose-400 text-xs font-semibold inline-flex items-center gap-1.5"
                        >
                          <Flag className="w-3.5 h-3.5" />
                          Resign
                        </button>
                      </div>
                    )}

                  {activeOnlineGame.status === 'completed' && (
                    <div className="flex flex-wrap gap-2">
                      {(user?.id === activeOnlineGame.whiteId || user?.id === activeOnlineGame.blackId) && (
                        <button
                          type="button"
                          onClick={() => sendWs('game:rematch', { gameId: activeOnlineGame.id })}
                          className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-xs font-semibold"
                        >
                          {activeOnlineGame.rematchFrom && activeOnlineGame.rematchFrom !== user?.id
                            ? 'Accept Rematch'
                            : 'Request Rematch'}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() =>
                          onReviewGame({
                            id: activeOnlineGame.id,
                            mode: 'online',
                            whiteName: activeOnlineGame.whiteName,
                            blackName: activeOnlineGame.blackName,
                            timeControlLabel: activeOnlineGame.timeControl.label,
                            fen: activeOnlineGame.fen,
                            pgn: activeOnlineGame.pgn,
                            movesSan: activeOnlineGame.movesSan,
                            result: activeOnlineGame.result,
                            termination: activeOnlineGame.termination,
                            playerColor: 'both',
                            createdAt: activeOnlineGame.createdAt,
                            updatedAt: Date.now(),
                          })
                        }
                        className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold"
                      >
                        Analyze in Game Review
                      </button>
                      {user && (
                        <button
                          type="button"
                          onClick={async () => {
                            await apiFetch(`/api/games/${activeOnlineGame.id}/report`, {
                              method: 'POST',
                              body: JSON.stringify({ reason: 'Suspicious timing / fair play review' }),
                            });
                            setReportNotice('Game flagged for Owner fair-play review.');
                          }}
                          className="px-3 py-2 rounded-lg text-xs text-slate-500 hover:text-rose-500"
                        >
                          Report Fair Play
                        </button>
                      )}
                    </div>
                  )}
                  {reportNotice && <p className="text-xs text-emerald-500">{reportNotice}</p>}
                </div>

                {/* Live Game Chat */}
                <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-3">
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                    <MessageSquare className="w-3.5 h-3.5 text-emerald-500" />
                    Match Chat
                  </h4>
                  <div className="h-44 overflow-y-auto space-y-1.5 text-xs">
                    {activeOnlineGame.chat.map((c) => (
                      <div key={c.id} className="py-1">
                        <UserTitleBadge username={c.sender} role={c.role} compact />{' '}
                        <span className="text-slate-600 dark:text-slate-300">{c.text}</span>
                      </div>
                    ))}
                  </div>
                  {user && (
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        if (!chatText.trim()) return;
                        sendWs('game:chat', { gameId: activeOnlineGame.id, text: chatText });
                        setChatText('');
                      }}
                      className="flex gap-2"
                    >
                      <input
                        type="text"
                        value={chatText}
                        onChange={(e) => setChatText(e.target.value)}
                        placeholder="Send message..."
                        className="flex-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-1.5 text-xs"
                      />
                      <button
                        type="submit"
                        className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-semibold"
                      >
                        <Send className="w-3.5 h-3.5" />
                      </button>
                    </form>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* =================================================================== */}
      {/* TOURNAMENTS                                                         */}
      {/* =================================================================== */}
      {subMode === 'tournaments' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-8 space-y-4">
            <div className="relative rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 h-40">
              <img
                src="/src/assets/images/chess_tournament_hall_1795364271761.jpg"
                alt="International chess championship hall"
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent p-5 flex flex-col justify-end">
                <p className="text-xs font-semibold text-amber-400">Official Academy Events</p>
                <h2 className="text-xl font-display font-bold text-white">
                  Arena, Swiss & Knockout Tournaments
                </h2>
              </div>
            </div>

            <div className="space-y-3">
              {tournaments.map((t) => {
                const joined = user && t.participants.some((p) => p.userId === user.id);
                return (
                  <div
                    key={t.id}
                    className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                  >
                    <div>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {t.format} · {t.timeControl.label} · {t.visibility} · {t.status}
                      </p>
                      <h3 className="text-base font-display font-bold text-slate-900 dark:text-white mt-0.5">
                        {t.name}
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                        {t.participants.length} / {t.maxPlayers} players registered · Host: @{t.createdBy}
                      </p>
                    </div>

                    {user && (
                      <button
                        type="button"
                        disabled={Boolean(joined)}
                        onClick={async () => {
                          const res = await apiFetch<{ tournament: TournamentRecord }>(
                            `/api/tournaments/${t.id}/join`,
                            { method: 'POST', body: JSON.stringify({}) }
                          );
                          setTournaments((prev) =>
                            prev.map((x) => (x.id === res.tournament.id ? res.tournament : x))
                          );
                        }}
                        className={`px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap shrink-0 ${
                          joined
                            ? 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                            : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                        }`}
                      >
                        {joined ? 'Registered' : 'Join Tournament'}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="lg:col-span-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
            <h3 className="text-base font-display font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Plus className="w-4 h-4 text-emerald-500" />
              Create Tournament
            </h3>
            <input
              type="text"
              value={newTourneyName}
              onChange={(e) => setNewTourneyName(e.target.value)}
              placeholder="Tournament title..."
              className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs"
            />
            <div className="grid grid-cols-2 gap-2">
              <select
                value={newTourneyFormat}
                onChange={(e) => setNewTourneyFormat(e.target.value as typeof newTourneyFormat)}
                className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs"
              >
                <option value="Arena">Arena</option>
                <option value="Swiss">Swiss</option>
                <option value="Knockout">Knockout</option>
              </select>
              <select
                value={newTourneyVis}
                onChange={(e) => setNewTourneyVis(e.target.value as typeof newTourneyVis)}
                className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs"
              >
                <option value="public">Public</option>
                <option value="private">Private</option>
              </select>
            </div>
            <button
              type="button"
              disabled={!user || !newTourneyName.trim()}
              onClick={async () => {
                const res = await apiFetch<{ tournament: TournamentRecord }>('/api/tournaments', {
                  method: 'POST',
                  body: JSON.stringify({
                    name: newTourneyName.trim(),
                    format: newTourneyFormat,
                    visibility: newTourneyVis,
                    timeControl: selectedTc,
                    maxPlayers: 32,
                  }),
                });
                setTournaments((prev) => [res.tournament, ...prev]);
                setNewTourneyName('');
              }}
              className="w-full py-2.5 rounded-xl bg-emerald-600 text-white text-xs font-semibold disabled:opacity-50"
            >
              {user ? 'Launch Tournament' : 'Sign in to Create'}
            </button>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* OFFLINE / ENGINE / LEGENDS / MIRROR BOT / PASS & PLAY               */}
      {/* =================================================================== */}
      {subMode !== 'online' && subMode !== 'tournaments' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Board Column */}
          <div className="lg:col-span-7 space-y-3">
            <ChessClock
              ms={flipped ? whiteTimeMs : blackTimeMs}
              active={clockRunning && chessInstance.turn() === (flipped ? 'w' : 'b')}
              label={
                subMode === 'legends'
                  ? selectedLegend.name
                  : subMode === 'stockfish'
                    ? `Stockfish Engine Lv.${stockfishSkill}`
                    : subMode === 'mirror'
                      ? mirrorSubMode === 'mirror-self'
                        ? flipped
                          ? 'Self-Play (White)'
                          : 'Self-Play (Black)'
                        : mirrorSubMode === 'mirror-ghost'
                          ? 'Ghost Replay Self'
                          : 'Mirror Bot'
                      : flipped
                        ? 'Player 1 (White)'
                        : 'Player 2 (Black)'
              }
              rating={
                subMode === 'legends'
                  ? selectedLegend.estimatedRating
                  : subMode === 'stockfish'
                    ? 400 + stockfishSkill * 115
                    : undefined
              }
              subtitle={botThinking ? 'Calculating candidate lines...' : undefined}
            />

            <ChessBoard
              fen={fen}
              onMove={handleOfflineMove}
              flipped={flipped}
              interactive={gameResult === '*' && !botThinking && !engineVsEngine}
              allowedColor={
                subMode === 'local' || (subMode === 'mirror' && mirrorSubMode === 'mirror-self')
                  ? 'both'
                  : playerSide
              }
              lastMove={lastMove}
              bestMoveArrow={hintArrow}
              evalCp={liveEval ? liveEval.evalCp : null}
              mateIn={liveEval ? liveEval.mateIn : null}
              settings={settings}
            />

            <ChessClock
              ms={flipped ? blackTimeMs : whiteTimeMs}
              active={clockRunning && chessInstance.turn() === (flipped ? 'b' : 'w')}
              label={
                subMode === 'mirror' && mirrorSubMode === 'mirror-self'
                  ? flipped
                    ? 'Self-Play (Black)'
                    : 'Self-Play (White)'
                  : user?.username
                    ? `@${user.username}`
                    : 'Challenger'
              }
              rating={user?.ratings.practice}
            />

            {/* Board Controls */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setFlipped((f) => !f)}
                className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold inline-flex items-center gap-1.5"
              >
                <RotateCw className="w-3.5 h-3.5" />
                Flip
              </button>
              <button
                type="button"
                onClick={handleUndo}
                disabled={movesSan.length === 0}
                className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold inline-flex items-center gap-1.5 disabled:opacity-40"
              >
                <Undo2 className="w-3.5 h-3.5" />
                Undo
              </button>
              <button
                type="button"
                onClick={handleRedo}
                disabled={redoStack.length === 0}
                className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold inline-flex items-center gap-1.5 disabled:opacity-40"
              >
                Redo
              </button>
              <button
                type="button"
                onClick={() => {
                  const res = analyzePosition(fen, { depth: 3, timeLimitMs: 250 });
                  if (res.bestMoveUci.length >= 4) {
                    setHintArrow({
                      from: res.bestMoveUci.slice(0, 2),
                      to: res.bestMoveUci.slice(2, 4),
                    });
                  }
                }}
                className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold inline-flex items-center gap-1.5"
              >
                <Lightbulb className="w-3.5 h-3.5 text-amber-500" />
                Hint
              </button>
              <button
                type="button"
                onClick={() => persistOfflineGame()}
                disabled={movesSan.length === 0}
                className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold inline-flex items-center gap-1.5 disabled:opacity-40"
              >
                <Save className="w-3.5 h-3.5 text-emerald-500" />
                Save
              </button>
              <button
                type="button"
                onClick={() => resetOfflineBoard()}
                className="px-3.5 py-2 rounded-lg bg-emerald-600 text-white text-xs font-semibold inline-flex items-center gap-1.5 ml-auto"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                New Game
              </button>
            </div>
          </div>

          {/* Right Mode Configuration & Move Notation */}
          <div className="lg:col-span-5 space-y-4">
            {/* Game Over Banner */}
            {gameResult !== '*' && (
              <div className="rounded-2xl border border-emerald-500/40 bg-emerald-500/10 p-4 space-y-3">
                <p className="text-sm font-display font-bold text-slate-900 dark:text-white">
                  {gameResult} · {termination}
                </p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      onReviewGame({
                        id: gameId,
                        mode: 'stockfish',
                        whiteName: 'White',
                        blackName: 'Black',
                        timeControlLabel: selectedTc.label,
                        fen,
                        pgn: chessInstance.pgn(),
                        movesSan,
                        result: gameResult,
                        termination,
                        playerColor: playerSide,
                        createdAt: Date.now(),
                        updatedAt: Date.now(),
                      })
                    }
                    className="px-3.5 py-2 rounded-lg bg-emerald-600 text-white text-xs font-semibold"
                  >
                    Open Game Review
                  </button>
                  <button
                    type="button"
                    onClick={() => resetOfflineBoard()}
                    className="px-3.5 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-semibold"
                  >
                    Play Again
                  </button>
                </div>
              </div>
            )}

            {/* STOCKFISH CONTROLS */}
            {subMode === 'stockfish' && (
              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
                <h2 className="text-base font-display font-bold text-slate-900 dark:text-white">
                  Stockfish Engine Configuration
                </h2>
                <label className="block space-y-1.5">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-600 dark:text-slate-300">Engine Strength Level</span>
                    <span className="font-mono-tabular font-bold text-emerald-600 dark:text-emerald-400">
                      Lv.{stockfishSkill} (~{400 + stockfishSkill * 115} Elo)
                    </span>
                  </div>
                  <input
                    type="range"
                    min={1}
                    max={20}
                    value={stockfishSkill}
                    onChange={(e) => setStockfishSkill(Number(e.target.value))}
                    className="w-full accent-emerald-600"
                  />
                </label>

                <div className="flex items-center justify-between gap-2">
                  <div className="flex gap-1.5">
                    {(['w', 'b'] as const).map((side) => (
                      <button
                        key={side}
                        type="button"
                        onClick={() => {
                          setPlayerSide(side);
                          setEngineVsEngine(false);
                          resetOfflineBoard(selectedTc, side);
                        }}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${
                          !engineVsEngine && playerSide === side
                            ? 'bg-emerald-600 text-white'
                            : 'bg-slate-100 dark:bg-slate-800'
                        }`}
                      >
                        Play {side === 'w' ? 'White' : 'Black'}
                      </button>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      resetOfflineBoard(selectedTc, 'w');
                      setEngineVsEngine((e) => !e);
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold inline-flex items-center gap-1 ${
                      engineVsEngine ? 'bg-amber-500 text-slate-950' : 'border border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    <PlayIcon className="w-3 h-3" />
                    {engineVsEngine ? 'Engine vs Engine ON' : 'Engine vs Engine'}
                  </button>
                </div>
              </div>
            )}

            {/* LEGENDARY AI ROSTER (16 LEGENDS) */}
            {subMode === 'legends' && (
              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-base font-display font-bold text-slate-900 dark:text-white">
                    16 Legendary AI Personalities
                  </h2>
                  <input
                    type="text"
                    value={legendSearch}
                    onChange={(e) => setLegendSearch(e.target.value)}
                    placeholder="Filter legend..."
                    className="w-32 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-2.5 py-1 text-xs"
                  />
                </div>

                <div className="rounded-xl bg-slate-50 dark:bg-slate-800/60 p-3 flex items-start gap-3">
                  <LegendAvatar legend={selectedLegend} size="md" />
                  <div className="min-w-0">
                    <p className="text-sm font-display font-bold text-slate-900 dark:text-white">
                      {selectedLegend.name} · {selectedLegend.estimatedRating}
                    </p>
                    <p className="text-[11px] text-amber-600 dark:text-amber-400 font-medium">
                      {selectedLegend.styleLabel} · {selectedLegend.difficulty}
                    </p>
                    <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 leading-relaxed">
                      {selectedLegend.biography}
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                      Openings: {selectedLegend.openingPreferences.join(', ')}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 max-h-56 overflow-y-auto pr-1">
                  {LEGENDARY_BOTS.filter((l) =>
                    l.name.toLowerCase().includes(legendSearch.toLowerCase())
                  ).map((leg) => (
                    <button
                      key={leg.id}
                      type="button"
                      onClick={() => {
                        setSelectedLegend(leg);
                        resetOfflineBoard(selectedTc, playerSide);
                      }}
                      className={`p-2.5 rounded-xl border text-left flex items-center gap-2.5 transition-colors ${
                        selectedLegend.id === leg.id
                          ? 'border-emerald-600 bg-emerald-500/10'
                          : 'border-slate-200 dark:border-slate-800'
                      }`}
                    >
                      <LegendAvatar legend={leg} size="sm" />
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                          {leg.name.replace(' AI', '')}
                        </p>
                        <p className="text-[10px] font-mono-tabular text-slate-500">
                          {leg.estimatedRating} · {leg.country}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-slate-400">
                  Disclaimer: AI opponents are customized engine personalities inspired by historical styles, not actual players.
                </p>
              </div>
            )}

            {/* MIRROR BOT */}
            {subMode === 'mirror' && (
              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
                <h2 className="text-base font-display font-bold text-slate-900 dark:text-white">
                  Mirror Bot Studio
                </h2>
                <div className="grid grid-cols-2 gap-2">
                  {(
                    [
                      { id: 'mirror-self', label: '1. Self-Play' },
                      { id: 'mirror-ai', label: '2. Mirror AI' },
                      { id: 'mirror-random', label: '3. Random Mirror' },
                      { id: 'mirror-ghost', label: '4. Ghost Replay' },
                    ] as const
                  ).map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => {
                        setMirrorSubMode(m.id);
                        resetOfflineBoard();
                      }}
                      className={`py-2 px-3 rounded-xl border text-xs font-semibold ${
                        mirrorSubMode === m.id
                          ? 'border-emerald-600 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                          : 'border-slate-200 dark:border-slate-800'
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>

                {mirrorSubMode === 'mirror-ai' && (
                  <div className="rounded-xl bg-slate-50 dark:bg-slate-800/60 p-3 text-xs text-slate-600 dark:text-slate-300">
                    <p className="font-semibold text-slate-900 dark:text-white mb-1">
                      Learned Style Profile ({mirrorProfile.gamesAnalyzed} Games)
                    </p>
                    <p>{mirrorProfile.summary}</p>
                  </div>
                )}

                {mirrorSubMode === 'mirror-random' && (
                  <label className="block space-y-1 text-xs">
                    <span>Adaptive Strength: Lv.{stockfishSkill}</span>
                    <input
                      type="range"
                      min={1}
                      max={16}
                      value={stockfishSkill}
                      onChange={(e) => setStockfishSkill(Number(e.target.value))}
                      className="w-full accent-emerald-600"
                    />
                  </label>
                )}

                {mirrorSubMode === 'mirror-ghost' && (
                  <div className="space-y-2">
                    <select
                      value={ghostGame?.id || ''}
                      onChange={(e) => {
                        const found = savedGames.find((g) => g.id === e.target.value) || null;
                        setGhostGame(found);
                        resetOfflineBoard();
                      }}
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs"
                    >
                      <option value="">Select a previous game to challenge...</option>
                      {savedGames.map((g) => (
                        <option key={g.id} value={g.id}>
                          {g.whiteName} vs {g.blackName} ({g.movesSan.length} plies)
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            )}

            {/* Move Notation & PGN/FEN Export */}
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-900 dark:text-white">
                  {activeOpening.eco} · {activeOpening.name}
                </span>
                <button
                  type="button"
                  onClick={() => navigator.clipboard?.writeText(chessInstance.pgn() || fen)}
                  className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold"
                >
                  <Copy className="w-3 h-3" />
                  Copy PGN
                </button>
              </div>

              <div className="max-h-48 overflow-y-auto rounded-xl bg-slate-50 dark:bg-slate-800/50 p-3 font-mono-tabular text-xs leading-relaxed">
                {movesSan.length === 0 ? (
                  <span className="text-slate-400">Make the first move on the board...</span>
                ) : (
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                    {Array.from({ length: Math.ceil(movesSan.length / 2) }).map((_, i) => (
                      <React.Fragment key={i}>
                        <div className="text-slate-800 dark:text-slate-200">
                          <span className="text-slate-400 mr-1.5">{i + 1}.</span>
                          {movesSan[i * 2]}
                        </div>
                        <div className="text-slate-600 dark:text-slate-300">
                          {movesSan[i * 2 + 1] || ''}
                        </div>
                      </React.Fragment>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
