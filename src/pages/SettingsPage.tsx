import React from 'react';
import { ExternalLink, Moon, Palette, Shield, Smartphone, Sun, Volume2, VolumeX } from 'lucide-react';
import { BOARD_THEMES, PIECE_STYLES, SOUND_PACKS } from '../data/themes';
import { ChessBoard } from '../components/ChessBoard';
import { PWAInstallButton } from '../components/PWAInstallButton';
import { useAuth } from '../context/AuthContext';
import { soundEngine } from '../utils/soundEngine';
import type { BoardThemeId, PieceStyleId, SoundPackId, UserSettings } from '../types/chess';

interface SettingsPageProps {
  settings: UserSettings;
  onUpdateSettings: (patch: Partial<UserSettings>) => void;
}

export const SettingsPage: React.FC<SettingsPageProps> = ({ settings, onUpdateSettings }) => {
  const { appConfig } = useAuth();

  const previewFen = 'r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 3 3';

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold text-slate-900 dark:text-white">
            Customization, Sound & About
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            Configure board themes, piece styles, synthesized sound effects, gameplay rules, and device optimization.
          </p>
        </div>
        <PWAInstallButton variant="compact" />
      </div>

      {/* Board & Piece Customization Studio */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-5">
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-3">
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              Live Board Preview
            </p>
            <ChessBoard
              fen={previewFen}
              onMove={() => false}
              interactive={false}
              lastMove={{ from: 'f1', to: 'c4' }}
              settings={{ ...settings, showEvalBar: false }}
            />
          </div>
        </div>

        <div className="lg:col-span-7 space-y-6">
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-display font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Palette className="w-4 h-4 text-emerald-500" />
                Board Themes (12 Presets + Custom)
              </h2>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {BOARD_THEMES.filter((t) => appConfig.enabledBoardThemes.includes(t.id)).map((t) => {
                const active = settings.boardTheme === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => onUpdateSettings({ boardTheme: t.id as BoardThemeId })}
                    className={`flex items-center gap-2.5 p-2.5 rounded-xl border text-left transition-colors ${
                      active
                        ? 'border-emerald-600 bg-emerald-500/10'
                        : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                    }`}
                  >
                    <div className="w-8 h-8 rounded-md overflow-hidden grid grid-cols-2 grid-rows-2 shrink-0 border border-black/15">
                      <span style={{ backgroundColor: t.light }} />
                      <span style={{ backgroundColor: t.dark }} />
                      <span style={{ backgroundColor: t.dark }} />
                      <span style={{ backgroundColor: t.light }} />
                    </div>
                    <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">
                      {t.name}
                    </span>
                  </button>
                );
              })}

              <button
                type="button"
                onClick={() => onUpdateSettings({ boardTheme: 'custom' })}
                className={`flex items-center gap-2.5 p-2.5 rounded-xl border text-left transition-colors ${
                  settings.boardTheme === 'custom'
                    ? 'border-emerald-600 bg-emerald-500/10'
                    : 'border-slate-200 dark:border-slate-800'
                }`}
              >
                <div className="w-8 h-8 rounded-md overflow-hidden grid grid-cols-2 grid-rows-2 shrink-0 border border-black/15">
                  <span style={{ backgroundColor: settings.customLightSquare }} />
                  <span style={{ backgroundColor: settings.customDarkSquare }} />
                  <span style={{ backgroundColor: settings.customDarkSquare }} />
                  <span style={{ backgroundColor: settings.customLightSquare }} />
                </div>
                <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                  Custom Colors
                </span>
              </button>
            </div>

            {settings.boardTheme === 'custom' && (
              <div className="flex flex-wrap items-center gap-4 pt-2">
                <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300">
                  Light Square
                  <input
                    type="color"
                    value={settings.customLightSquare}
                    onChange={(e) => onUpdateSettings({ customLightSquare: e.target.value })}
                    className="w-8 h-8 rounded border border-slate-300 cursor-pointer"
                  />
                </label>
                <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300">
                  Dark Square
                  <input
                    type="color"
                    value={settings.customDarkSquare}
                    onChange={(e) => onUpdateSettings({ customDarkSquare: e.target.value })}
                    className="w-8 h-8 rounded border border-slate-300 cursor-pointer"
                  />
                </label>
              </div>
            )}

            <div className="pt-3 border-t border-slate-100 dark:border-slate-800">
              <h3 className="text-sm font-display font-bold text-slate-900 dark:text-white mb-3">
                Piece Styles (7 Sets)
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                {PIECE_STYLES.map((ps) => (
                  <button
                    key={ps.id}
                    type="button"
                    onClick={() => onUpdateSettings({ pieceStyle: ps.id as PieceStyleId })}
                    className={`p-3 rounded-xl border text-left transition-colors ${
                      settings.pieceStyle === ps.id
                        ? 'border-emerald-600 bg-emerald-500/10'
                        : 'border-slate-200 dark:border-slate-800'
                    }`}
                  >
                    <p className="text-xs font-semibold text-slate-900 dark:text-white">{ps.name}</p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-2">
                      {ps.description}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Sound, Theme, Gameplay, Engine Preferences */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-display font-bold text-slate-900 dark:text-white flex items-center gap-2">
              {settings.muted ? <VolumeX className="w-4 h-4 text-rose-500" /> : <Volume2 className="w-4 h-4 text-emerald-500" />}
              Sound System
            </h2>
            <button
              type="button"
              onClick={() => onUpdateSettings({ muted: !settings.muted })}
              className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold"
            >
              {settings.muted ? 'Unmute' : 'Mute'}
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {SOUND_PACKS.filter((sp) => appConfig.enabledSoundPacks.includes(sp.id)).map((sp) => (
              <button
                key={sp.id}
                type="button"
                onClick={() => {
                  onUpdateSettings({ soundPack: sp.id as SoundPackId });
                  soundEngine.configure(sp.id as SoundPackId, settings.soundVolume, settings.muted);
                  soundEngine.play('move');
                }}
                className={`px-3 py-2 rounded-xl border text-xs font-semibold ${
                  settings.soundPack === sp.id
                    ? 'border-emerald-600 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                    : 'border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300'
                }`}
              >
                {sp.name}
              </button>
            ))}
          </div>

          <label className="block space-y-1.5">
            <div className="flex justify-between text-xs text-slate-600 dark:text-slate-300">
              <span>Master Volume</span>
              <span className="font-mono-tabular">{Math.round(settings.soundVolume * 100)}%</span>
            </div>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={settings.soundVolume}
              onChange={(e) => onUpdateSettings({ soundVolume: Number(e.target.value) })}
              className="w-full accent-emerald-600"
            />
          </label>

          <div className="flex flex-wrap gap-1.5 pt-1">
            {(['move', 'capture', 'castle', 'check', 'promote', 'victory'] as const).map((fx) => (
              <button
                key={fx}
                type="button"
                onClick={() => soundEngine.play(fx)}
                className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-xs font-medium capitalize text-slate-700 dark:text-slate-200 hover:bg-emerald-600 hover:text-white transition-colors"
              >
                Test {fx}
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
          <h2 className="text-base font-display font-bold text-slate-900 dark:text-white flex items-center gap-2">
            {settings.themeMode === 'dark' ? <Moon className="w-4 h-4 text-amber-400" /> : <Sun className="w-4 h-4 text-amber-500" />}
            Interface, Engine & Gameplay
          </h2>

          <div className="flex items-center justify-between py-1">
            <span className="text-xs sm:text-sm text-slate-700 dark:text-slate-300">Appearance Theme</span>
            <div className="flex items-center gap-1 p-1 rounded-lg bg-slate-100 dark:bg-slate-800">
              <button
                type="button"
                onClick={() => onUpdateSettings({ themeMode: 'light' })}
                className={`px-3 py-1 rounded text-xs font-semibold ${
                  settings.themeMode === 'light' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500'
                }`}
              >
                Light
              </button>
              <button
                type="button"
                onClick={() => onUpdateSettings({ themeMode: 'dark' })}
                className={`px-3 py-1 rounded text-xs font-semibold ${
                  settings.themeMode === 'dark' ? 'bg-slate-700 text-white shadow-xs' : 'text-slate-500'
                }`}
              >
                Dark
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {(
              [
                { key: 'showCoordinates', label: 'Board Coordinates' },
                { key: 'showLegalMoves', label: 'Legal Move Dots' },
                { key: 'highlightLastMove', label: 'Last Move Highlight' },
                { key: 'highlightCheck', label: 'King Check Highlight' },
                { key: 'pieceAnimations', label: 'Piece Animations' },
                { key: 'moveConfirmation', label: 'Move Confirmation' },
                { key: 'showEvalBar', label: 'Analysis Eval Bar' },
                { key: 'autoFlipSelfPlay', label: 'Auto-Flip Self-Play' },
              ] as const
            ).map((item) => (
              <label
                key={item.key}
                className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 dark:border-slate-800 px-3 py-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer"
              >
                <span>{item.label}</span>
                <input
                  type="checkbox"
                  checked={Boolean(settings[item.key])}
                  onChange={(e) => onUpdateSettings({ [item.key]: e.target.checked })}
                  className="accent-emerald-600 w-4 h-4"
                />
              </label>
            ))}
          </div>

          <div className="flex items-center justify-between gap-4 pt-1">
            <label className="text-xs text-slate-600 dark:text-slate-300">
              Engine Search Depth (1–{Math.min(5, appConfig.maxEngineDepth)})
            </label>
            <input
              type="number"
              min={1}
              max={Math.min(5, appConfig.maxEngineDepth)}
              value={settings.engineDepth}
              onChange={(e) => onUpdateSettings({ engineDepth: Math.max(1, Math.min(5, Number(e.target.value) || 3)) })}
              className="w-20 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-2.5 py-1 text-xs font-mono-tabular text-center"
            />
          </div>

          <div className="flex items-center justify-between gap-4">
            <label className="text-xs text-slate-600 dark:text-slate-300">Language</label>
            <select
              value={settings.language}
              onChange={(e) => onUpdateSettings({ language: e.target.value as UserSettings['language'] })}
              className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-2.5 py-1.5 text-xs"
            >
              <option value="en">English</option>
              <option value="es">Español</option>
              <option value="fr">Français</option>
              <option value="de">Deutsch</option>
              <option value="tl">Filipino</option>
            </select>
          </div>
        </div>
      </section>

      {/* About & Developer Credit + Android / Termux Guide */}
      <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <img
              src="/src/assets/images/chess_app_emblem_1795364271253.jpg"
              alt="CART3R Chess Academy emblem"
              referrerPolicy="no-referrer"
              className="w-14 h-14 rounded-xl object-cover border border-amber-500/30"
            />
            <div>
              <h2 className="text-lg font-display font-bold text-slate-900 dark:text-white">
                {appConfig.appName}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Created by: <strong className="text-slate-900 dark:text-white">@lmxynnn</strong> · Version {appConfig.version}
              </p>
              <a
                href="https://www.tiktok.com/@lmxynnn"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline mt-1"
              >
                TikTok: https://www.tiktok.com/@lmxynnn
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>

          <PWAInstallButton variant="compact" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-slate-100 dark:border-slate-800">
          <div className="space-y-1.5">
            <p className="text-xs font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
              <Smartphone className="w-3.5 h-3.5 text-emerald-500" />
              Honor X7a · Termux & Native Stockfish Setup
            </p>
            <pre className="rounded-xl bg-slate-950 text-slate-200 p-3 text-[11px] font-mono-tabular overflow-x-auto leading-relaxed">
{`pkg update && pkg upgrade -y
pkg install nodejs-lts git stockfish -y
npm install
npm run build && npm start`}
            </pre>
          </div>

          <div className="space-y-1.5">
            <p className="text-xs font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5 text-amber-500" />
              Android APK Packaging (Capacitor)
            </p>
            <pre className="rounded-xl bg-slate-950 text-slate-200 p-3 text-[11px] font-mono-tabular overflow-x-auto leading-relaxed">
{`npm install @capacitor/core @capacitor/cli @capacitor/android
npx cap init "CART3R Chess" "com.carter.chess" --web-dir=dist
npm run build && npx cap add android && npx cap sync`}
            </pre>
          </div>
        </div>
      </section>
    </div>
  );
};
