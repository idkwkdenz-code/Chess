import React, { useEffect, useState } from 'react';
import {
  Crown,
  Gamepad2,
  GraduationCap,
  Home,
  LineChart,
  Puzzle,
  Settings,
  User,
} from 'lucide-react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { DEFAULT_SETTINGS, loadSettingsOffline, saveSettingsOffline } from './utils/offlineDb';
import { soundEngine } from './utils/soundEngine';
import { HomePage } from './pages/HomePage';
import { PlayPage } from './pages/PlayPage';
import { PuzzlesPage } from './pages/PuzzlesPage';
import { LearnPage } from './pages/LearnPage';
import { AnalysisPage } from './pages/AnalysisPage';
import { ProfilePage } from './pages/ProfilePage';
import { SettingsPage } from './pages/SettingsPage';
import { OfflineBanner } from './components/PWAInstallButton';
import type { NavTab, SavedGameRecord, UserSettings } from './types/chess';

const NAV_ITEMS: { id: NavTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'home', label: 'Home', icon: Home },
  { id: 'play', label: 'Play', icon: Gamepad2 },
  { id: 'puzzles', label: 'Puzzles', icon: Puzzle },
  { id: 'learn', label: 'Learn', icon: GraduationCap },
  { id: 'analysis', label: 'Analysis', icon: LineChart },
  { id: 'profile', label: 'Profile', icon: User },
  { id: 'settings', label: 'Settings', icon: Settings },
];

function AppShell() {
  const { user, appConfig, incomingChallenge, dismissChallenge, sendWs } = useAuth();
  const [activeTab, setActiveTab] = useState<NavTab>('home');
  const [playSubMode, setPlaySubMode] = useState<string | undefined>(undefined);
  const [reviewGame, setReviewGame] = useState<SavedGameRecord | null>(null);
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS);

  useEffect(() => {
    loadSettingsOffline().then((loaded) => {
      setSettings(loaded);
      soundEngine.configure(loaded.soundPack, loaded.soundVolume, loaded.muted);
    });
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    if (settings.themeMode === 'dark') root.classList.add('dark');
    else root.classList.remove('dark');
    soundEngine.configure(settings.soundPack, settings.soundVolume, settings.muted);
  }, [settings]);

  const updateSettings = (patch: Partial<UserSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      saveSettingsOffline(next);
      return next;
    });
  };

  const navigate = (tab: NavTab, subMode?: string) => {
    setActiveTab(tab);
    if (subMode) setPlaySubMode(subMode);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleOpenReview = (game: SavedGameRecord) => {
    setReviewGame(game);
    setActiveTab('analysis');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (appConfig.maintenanceMode && user?.role !== 'OWNER') {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-[#F6F7F5] dark:bg-[#0B0E11]">
        <div className="max-w-md w-full rounded-2xl border border-amber-500/30 bg-white dark:bg-slate-900 p-8 text-center space-y-4">
          <Crown className="w-10 h-10 text-amber-500 mx-auto" />
          <h1 className="text-xl font-display font-bold text-slate-900 dark:text-white">
            {appConfig.appName} — Scheduled Maintenance
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Platform updates are currently in progress. Please check back shortly.
          </p>
          <button
            type="button"
            onClick={() => setActiveTab('profile')}
            className="text-xs font-semibold text-emerald-600 hover:underline"
          >
            Owner Sign In
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#F6F7F5] dark:bg-[#0B0E11] text-[#11181C] dark:text-[#F1F5F9]">
      {/* Strict 3-Zone Top Bar Contract */}
      <header className="sticky top-0 z-30 h-14 border-b border-slate-200 dark:border-slate-800/80 bg-white/90 dark:bg-[#0B0E11]/90 backdrop-blur-md">
        <div className="max-w-7xl mx-auto h-full px-4 sm:px-6 flex items-center justify-between gap-8">
          {/* Zone 1: Single-line Brand Wordmark */}
          <button
            type="button"
            onClick={() => navigate('home')}
            className="text-base sm:text-lg font-display font-bold tracking-tight text-slate-900 dark:text-white whitespace-nowrap shrink-0"
          >
            {appConfig.appName}
          </button>

          {/* Zone 2: Clean Single-Line Nav Links */}
          <nav className="hidden md:flex items-center gap-5 text-sm font-medium text-slate-600 dark:text-slate-400">
            {NAV_ITEMS.map((item) => {
              const active = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => navigate(item.id)}
                  className={`py-1 whitespace-nowrap shrink-0 transition-colors border-b-2 ${
                    active
                      ? 'text-slate-900 dark:text-white border-emerald-600 font-semibold'
                      : 'border-transparent hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </nav>

          {/* Zone 3: 1 Primary Action */}
          <div className="shrink-0">
            <button
              type="button"
              onClick={() => navigate(user ? 'profile' : 'play', user ? undefined : 'online')}
              className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold whitespace-nowrap shrink-0 inline-flex items-center gap-1.5"
            >
              {user?.role === 'OWNER' && <Crown className="w-3.5 h-3.5 text-amber-300 fill-current" />}
              {user ? `@${user.username}` : 'Play Now'}
            </button>
          </div>
        </div>
      </header>

      {/* Incoming Friend Challenge Banner */}
      {incomingChallenge && (
        <div className="bg-emerald-600 text-white px-4 py-2.5 text-xs flex items-center justify-center gap-4">
          <span>
            <strong>@{incomingChallenge.fromUsername}</strong> challenged you to a {incomingChallenge.timeControl.label} match!
          </span>
          <button
            type="button"
            onClick={() => {
              sendWs('game:join', { gameId: incomingChallenge.gameId, inviteCode: incomingChallenge.inviteCode });
              dismissChallenge();
              navigate('play', 'online');
            }}
            className="px-3 py-1 rounded bg-white text-emerald-700 font-bold"
          >
            Accept
          </button>
          <button type="button" onClick={dismissChallenge} className="underline">
            Dismiss
          </button>
        </div>
      )}

      {/* Main Content Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 pb-24 md:pb-10">
        {activeTab === 'home' && <HomePage onNavigate={navigate} onReviewGame={handleOpenReview} />}
        {activeTab === 'play' && (
          <PlayPage settings={settings} initialSubMode={playSubMode} onReviewGame={handleOpenReview} />
        )}
        {activeTab === 'puzzles' && <PuzzlesPage settings={settings} />}
        {activeTab === 'learn' && <LearnPage settings={settings} />}
        {activeTab === 'analysis' && <AnalysisPage settings={settings} initialGame={reviewGame} />}
        {activeTab === 'profile' && <ProfilePage onReviewGame={handleOpenReview} />}
        {activeTab === 'settings' && <SettingsPage settings={settings} onUpdateSettings={updateSettings} />}
      </main>

      {/* Desktop Quiet Footer */}
      <footer className="hidden md:block border-t border-slate-200 dark:border-slate-800/80 py-5 px-6 text-xs text-slate-500 dark:text-slate-400">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <span>{appConfig.appName} · Created by @lmxynnn</span>
          <a
            href="https://www.tiktok.com/@lmxynnn"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
          >
            TikTok @lmxynnn
          </a>
        </div>
      </footer>

      {/* Mobile Fixed Thumb Navigation Bar (<= 15% viewport height, 44px+ hitboxes) */}
      <nav
        aria-label="Mobile navigation"
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 h-16 bg-white/95 dark:bg-[#0B0E11]/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 grid grid-cols-7 items-center px-1"
      >
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => navigate(item.id)}
              className={`min-h-[44px] flex flex-col items-center justify-center gap-0.5 transition-colors ${
                active ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span className="text-[10px] font-medium leading-none truncate max-w-full px-0.5">
                {item.label}
              </span>
            </button>
          );
        })}
      </nav>

      <OfflineBanner />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppShell />
    </AuthProvider>
  );
}
