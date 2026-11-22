import React, { useEffect, useState } from 'react';
import {
  Activity,
  Bot,
  Compass,
  Crown,
  Flame,
  Gamepad2,
  GraduationCap,
  LineChart,
  Puzzle,
  RefreshCw,
  Swords,
  Trophy,
  Users,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { getAllOfflineGames } from '../utils/offlineDb';
import type { NavTab, SavedGameRecord } from '../types/chess';
import { PWAInstallButton } from '../components/PWAInstallButton';

interface HomePageProps {
  onNavigate: (tab: NavTab, subMode?: string) => void;
  onReviewGame: (game: SavedGameRecord) => void;
}

export const HomePage: React.FC<HomePageProps> = ({ onNavigate, onReviewGame }) => {
  const { appConfig, onlineCount, user, ownerSetup } = useAuth();
  const [stats, setStats] = useState({
    totalUsers: 1,
    onlineUsers: onlineCount,
    activeGames: 0,
    totalGames: 0,
    activeTournaments: 0,
    totalPuzzlesSolved: 0,
  });
  const [recentGames, setRecentGames] = useState<SavedGameRecord[]>([]);

  useEffect(() => {
    fetch('/api/stats')
      .then((r) => r.json())
      .then((data) => {
        if (data && typeof data.totalUsers === 'number') setStats(data);
      })
      .catch(() => {});
    getAllOfflineGames().then((list) => setRecentGames(list.slice(0, 4)));
  }, [onlineCount]);

  return (
    <div className="space-y-8">
      {/* Owner Setup Notice if @lmxynnn has not claimed initial password yet */}
      {!ownerSetup.claimed && !ownerSetup.envConfigured && (
        <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <Crown className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-slate-900 dark:text-white">
                Owner Account Initial Setup Ready (@lmxynnn)
              </p>
              <p className="text-xs text-slate-600 dark:text-slate-300">
                Set your private password on the Profile page to claim the @lmxynnn Owner Super Admin Dashboard.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('profile')}
            className="px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold whitespace-nowrap shrink-0"
          >
            Claim Owner Account
          </button>
        </div>
      )}

      {/* Owner Platform Announcement */}
      {appConfig.announcement && (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-3 flex items-center justify-between gap-4">
          <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-300">
            <span className="font-semibold text-emerald-700 dark:text-emerald-400 mr-2">Announcement:</span>
            {appConfig.announcement}
          </p>
          <PWAInstallButton />
        </div>
      )}

      {/* Hero Split */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        <div className="lg:col-span-7 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 sm:p-8 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400">
              <span>{appConfig.appName}</span>
              <span aria-hidden="true">·</span>
              <span>International Chess Platform</span>
              <span aria-hidden="true">·</span>
              <span>Created by @lmxynnn</span>
            </div>

            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-display font-bold tracking-tight text-slate-900 dark:text-white leading-[1.1] text-balance">
              Master Every Move from Opening Theory to Grandmaster Endgame.
            </h1>

            <p className="text-sm sm:text-base text-slate-600 dark:text-slate-300 max-w-2xl leading-relaxed">
              Play real-time Bullet, Blitz, Rapid, and Classical matches online, train offline against Stockfish-grade search or 16 Legendary AI personalities, challenge your own Mirror Bot, and review every move with centipawn accuracy.
            </p>
          </div>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => onNavigate('play', 'online')}
              className="px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold inline-flex items-center gap-2 transition-colors whitespace-nowrap shrink-0"
            >
              <Swords className="w-4 h-4" />
              Play Online Arena
            </button>
            <button
              type="button"
              onClick={() => onNavigate('play', 'mirror')}
              className="px-5 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/70 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm font-semibold inline-flex items-center gap-2 transition-colors whitespace-nowrap shrink-0"
            >
              <RefreshCw className="w-4 h-4" />
              Launch Mirror Bot
            </button>
            {!user && (
              <button
                type="button"
                onClick={() => onNavigate('profile')}
                className="px-5 py-3 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 text-sm font-medium whitespace-nowrap shrink-0"
              >
                Sign In / Register
              </button>
            )}
          </div>
        </div>

        <div className="lg:col-span-5 relative rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 min-h-[260px] bg-slate-950">
          <img
            src="/src/assets/images/chess_hero_board_1795364271547.jpg"
            alt="Walnut Staunton tournament chessboard and brass chess clock"
            referrerPolicy="no-referrer"
            className="w-full h-full lg:h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent flex flex-col justify-end p-6">
            <p className="text-xs font-medium text-amber-400">Tournament Standard Rules</p>
            <p className="text-lg font-display font-bold text-white mt-1">
              12 Custom Boards · 7 Piece Styles · Offline Ready
            </p>
          </div>
        </div>
      </section>

      {/* 4-Column Platform Pulse Strip */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>Players Online</span>
            <Users className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <p className="mt-2 text-2xl font-mono-tabular font-bold text-slate-900 dark:text-white">
            {Math.max(onlineCount, stats.onlineUsers)}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {stats.totalUsers} registered accounts
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>Active Online Games</span>
            <Activity className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <p className="mt-2 text-2xl font-mono-tabular font-bold text-slate-900 dark:text-white">
            {stats.activeGames}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {stats.totalGames} total recorded matches
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>Active Tournaments</span>
            <Trophy className="w-4 h-4 text-amber-500" />
          </div>
          <p className="mt-2 text-2xl font-mono-tabular font-bold text-slate-900 dark:text-white">
            {stats.activeTournaments}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Arena · Swiss · Knockout
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>Puzzles Solved</span>
            <Flame className="w-4 h-4 text-amber-500" />
          </div>
          <p className="mt-2 text-2xl font-mono-tabular font-bold text-slate-900 dark:text-white">
            {stats.totalPuzzlesSolved}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Daily · Rush · Battle
          </p>
        </div>
      </section>

      {/* Core Feature Launchpad */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-display font-bold text-slate-900 dark:text-white">
            Chess Training & Competition Modes
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[
            {
              title: 'Stockfish-Grade Engine',
              desc: 'Adjustable strength from Level 1 to 20, live evaluation bar, principal variations, and Engine vs Engine mode.',
              icon: Bot,
              action: () => onNavigate('play', 'stockfish'),
            },
            {
              title: '16 Legendary Chess AI',
              desc: 'Face AI personalities inspired by Kasparov, Carlsen, Fischer, Tal, Karpov, Morphy, Polgár, and 9 more icons.',
              icon: Crown,
              action: () => onNavigate('play', 'legends'),
            },
            {
              title: 'Mirror Bot & Self-Play',
              desc: 'Play both sides, train an AI that learns your opening habits, or challenge your own Ghost Replays.',
              icon: RefreshCw,
              action: () => onNavigate('play', 'mirror'),
            },
            {
              title: 'Tactical Puzzles & Rush',
              desc: 'Daily puzzles, 3-minute Puzzle Rush, AI Puzzle Battle, and checkmate challenges with Puzzle Elo.',
              icon: Puzzle,
              action: () => onNavigate('puzzles'),
            },
            {
              title: 'GM Coach & Openings',
              desc: 'Explore 12+ ECO openings with win statistics and ask our AI Grandmaster Coach for tailored lessons.',
              icon: GraduationCap,
              action: () => onNavigate('learn'),
            },
            {
              title: 'Engine Game Review',
              desc: 'Move-by-move Brilliant!! to Blunder classifications, accuracy %, eval graph, and missed tactics.',
              icon: LineChart,
              action: () => onNavigate('analysis'),
            },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.title}
                type="button"
                onClick={item.action}
                className="text-left rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 hover:border-emerald-600/50 dark:hover:border-emerald-500/50 transition-colors group"
              >
                <div className="w-10 h-10 rounded-lg bg-emerald-600/10 text-emerald-700 dark:text-emerald-400 flex items-center justify-center mb-3">
                  <Icon className="w-5 h-5" />
                </div>
                <h3 className="text-base font-display font-bold text-slate-900 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                  {item.title}
                </h3>
                <p className="mt-1.5 text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                  {item.desc}
                </p>
              </button>
            );
          })}
        </div>
      </section>

      {/* Local Offline Games & Quick Review */}
      <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 sm:p-6">
        <div className="flex items-center justify-between gap-4 mb-4">
          <div>
            <h2 className="text-lg font-display font-bold text-slate-900 dark:text-white">
              Recent Local & Practice Games
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Saved directly to IndexedDB for offline access and instant Game Review.
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('play', 'local')}
            className="px-3.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 whitespace-nowrap shrink-0"
          >
            New Local Game
          </button>
        </div>

        {recentGames.length === 0 ? (
          <div className="py-8 text-center text-sm text-slate-500 dark:text-slate-400">
            No saved games on this device yet. Play against Stockfish, Mirror Bot, or a Legendary AI to build your local archive.
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {recentGames.map((g) => (
              <div key={g.id} className="py-3 flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
                    {g.whiteName} vs {g.blackName}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {g.mode} · {g.result} · {g.movesSan.length} plies · {new Date(g.updatedAt).toLocaleDateString()}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onReviewGame(g)}
                  className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-emerald-600 hover:text-white text-xs font-semibold text-slate-800 dark:text-slate-200 transition-colors whitespace-nowrap shrink-0"
                >
                  Review Game
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};
