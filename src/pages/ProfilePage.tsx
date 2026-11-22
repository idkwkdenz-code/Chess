import React, { useEffect, useState } from 'react';
import { Award, Crown, LogOut, Shield, Trophy, UserPlus, Users } from 'lucide-react';
import { ACHIEVEMENTS_CATALOG } from '../data/themes';
import { useAuth } from '../context/AuthContext';
import { TitleLegendHint, UserAvatar, UserTitleBadge } from '../components/PlayerBadges';
import { OwnerDashboard } from './OwnerDashboard';
import { getAllOfflineGames } from '../utils/offlineDb';
import type { PublicUser, SavedGameRecord } from '../types/chess';

export const ProfilePage: React.FC<{ onReviewGame: (g: SavedGameRecord) => void }> = ({ onReviewGame }) => {
  const { user, ownerSetup, apiFetch, setSession, refreshAuth, logout } = useAuth();
  const [showOwnerPanel, setShowOwnerPanel] = useState(false);

  // Auth form state
  const [authMode, setAuthMode] = useState<'login' | 'register' | 'claim'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const [needs2FA, setNeeds2FA] = useState(false);
  const [authError, setAuthError] = useState('');

  // Leaderboard & Friends
  const [lbCategory, setLbCategory] = useState<'bullet' | 'blitz' | 'rapid' | 'classical' | 'puzzle'>('blitz');
  const [leaderboard, setLeaderboard] = useState<PublicUser[]>([]);
  const [distribution, setDistribution] = useState<{ label: string; count: number }[]>([]);
  const [friendUsername, setFriendUsername] = useState('');
  const [friendMsg, setFriendMsg] = useState('');
  const [localGames, setLocalGames] = useState<SavedGameRecord[]>([]);
  const [bioDraft, setBioDraft] = useState('');

  useEffect(() => {
    if (!ownerSetup.claimed && !ownerSetup.envConfigured && !user) {
      setAuthMode('claim');
    }
  }, [ownerSetup.claimed, ownerSetup.envConfigured, user]);

  useEffect(() => {
    if (user) setBioDraft(user.bio);
  }, [user?.bio]);

  useEffect(() => {
    fetch(`/api/leaderboard?category=${lbCategory}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.leaderboard) setLeaderboard(d.leaderboard);
        if (d.distribution) setDistribution(d.distribution);
      })
      .catch(() => {});
    getAllOfflineGames().then(setLocalGames);
  }, [lbCategory, user?.id]);

  if (showOwnerPanel && user?.role === 'OWNER') {
    return <OwnerDashboard onClose={() => setShowOwnerPanel(false)} />;
  }

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    try {
      if (authMode === 'claim') {
        const res = await apiFetch<{ token: string; user: PublicUser }>('/api/auth/claim-owner', {
          method: 'POST',
          body: JSON.stringify({ password }),
        });
        setSession(res.user, res.token);
        await refreshAuth();
        return;
      }

      if (authMode === 'register') {
        const res = await apiFetch<{ token: string; user: PublicUser }>('/api/auth/register', {
          method: 'POST',
          body: JSON.stringify({ username, password }),
        });
        setSession(res.user, res.token);
        return;
      }

      const res = await apiFetch<{ token?: string; user?: PublicUser; requires2FA?: boolean }>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username, password, totpCode }),
      });
      if (res.requires2FA) {
        setNeeds2FA(true);
        return;
      }
      if (res.user && res.token) {
        setSession(res.user, res.token);
        setNeeds2FA(false);
        setTotpCode('');
      }
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Authentication failed.');
    }
  };

  return (
    <div className="space-y-8">
      {/* Authentication or Player Identity Header */}
      {!user ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-5">
            <div className="flex items-center justify-between gap-2">
              <h1 className="text-xl font-display font-bold text-slate-900 dark:text-white">
                {authMode === 'claim'
                  ? 'Initialize @lmxynnn Owner Account'
                  : authMode === 'register'
                    ? 'Create Player Account'
                    : 'Sign In to CART3R Chess'}
              </h1>
            </div>

            <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-800">
              <button
                type="button"
                onClick={() => { setAuthMode('login'); setAuthError(''); }}
                className={`flex-1 py-1.5 rounded-lg text-xs font-semibold ${
                  authMode === 'login' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs' : 'text-slate-500'
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => { setAuthMode('register'); setAuthError(''); }}
                className={`flex-1 py-1.5 rounded-lg text-xs font-semibold ${
                  authMode === 'register' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs' : 'text-slate-500'
                }`}
              >
                Register
              </button>
              {!ownerSetup.claimed && !ownerSetup.envConfigured && (
                <button
                  type="button"
                  onClick={() => { setAuthMode('claim'); setAuthError(''); }}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-semibold ${
                    authMode === 'claim' ? 'bg-amber-500 text-slate-950 shadow-xs' : 'text-amber-600 dark:text-amber-400'
                  }`}
                >
                  Claim Owner
                </button>
              )}
            </div>

            <form onSubmit={handleAuthSubmit} className="space-y-4">
              {authMode === 'claim' ? (
                <div className="rounded-xl bg-amber-500/10 border border-amber-500/30 p-3 text-xs text-amber-800 dark:text-amber-300">
                  One-time setup for <strong>@lmxynnn (Role: OWNER)</strong>. Choose a strong password (8+ chars, upper/lowercase, number or symbol). This route permanently locks once claimed.
                </div>
              ) : (
                <label className="block space-y-1">
                  <span className="text-xs font-medium text-slate-600 dark:text-slate-300">Username</span>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                    placeholder="e.g. lmxynnn or chessmaster"
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3.5 py-2.5 text-sm text-slate-900 dark:text-white"
                  />
                </label>
              )}

              <label className="block space-y-1">
                <span className="text-xs font-medium text-slate-600 dark:text-slate-300">Password</span>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="••••••••"
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3.5 py-2.5 text-sm text-slate-900 dark:text-white"
                />
              </label>

              {needs2FA && authMode === 'login' && (
                <label className="block space-y-1">
                  <span className="text-xs font-medium text-amber-600 dark:text-amber-400">
                    Two-Factor Authentication Code
                  </span>
                  <input
                    type="text"
                    value={totpCode}
                    onChange={(e) => setTotpCode(e.target.value)}
                    required
                    placeholder="6-digit authenticator code"
                    className="w-full rounded-xl border border-amber-500/50 bg-slate-50 dark:bg-slate-800 px-3.5 py-2.5 text-sm font-mono-tabular"
                  />
                </label>
              )}

              {authError && (
                <p className="text-xs font-medium text-rose-600 dark:text-rose-400">{authError}</p>
              )}

              <button
                type="submit"
                className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold"
              >
                {authMode === 'claim'
                  ? 'Set Owner Password & Enter Dashboard'
                  : authMode === 'register'
                    ? 'Create Account (Start Rating 400)'
                    : 'Sign In'}
              </button>
            </form>
          </div>

          <div className="lg:col-span-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-4">
            <h2 className="text-base font-display font-bold text-slate-900 dark:text-white">
              Official Ratings, Titles & Profiles
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              Every player starts at 400 Elo across Bullet, Blitz, Rapid, Classical, Daily, Chess960, and Puzzle ratings. Offline Stockfish and Legendary AI matches track a separate Practice rating so official online standings stay fair.
            </p>
            <TitleLegendHint />
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <UserAvatar user={user} size="lg" />
              <div>
                <UserTitleBadge
                  username={user.username}
                  role={user.role}
                  officialFideTitle={user.officialFideTitle}
                  fideVerified={user.fideVerified}
                  platformTitle={user.platformTitle}
                  customTitle={user.customTitle}
                  verified={user.verified}
                />
                {user.role === 'OWNER' && (
                  <p className="text-xs font-medium text-amber-600 dark:text-amber-400 mt-0.5">
                    Role: OWNER · Developer: CART3R Chess Academy
                  </p>
                )}
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  {user.stats.gamesPlayed} Online Games · {user.stats.wins}W / {user.stats.draws}D / {user.stats.losses}L · {user.stats.gamesPlayed > 0 ? Math.round((user.stats.wins / user.stats.gamesPlayed) * 100) : 0}% Win Rate
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {user.role === 'OWNER' && (
                <button
                  type="button"
                  onClick={() => setShowOwnerPanel(true)}
                  className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-bold inline-flex items-center gap-1.5"
                >
                  <Crown className="w-4 h-4 fill-current" />
                  Super Admin Dashboard
                </button>
              )}
              <button
                type="button"
                onClick={logout}
                className="px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold inline-flex items-center gap-1.5 text-slate-700 dark:text-slate-200"
              >
                <LogOut className="w-3.5 h-3.5" />
                Sign Out
              </button>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              value={bioDraft}
              onChange={(e) => setBioDraft(e.target.value)}
              placeholder="Player biography..."
              className="flex-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs text-slate-900 dark:text-white"
            />
            <button
              type="button"
              onClick={async () => {
                const res = await apiFetch<{ user: PublicUser }>('/api/profile', {
                  method: 'PATCH',
                  body: JSON.stringify({ bio: bioDraft }),
                });
                setSession(res.user, null);
              }}
              className="px-4 py-2 rounded-xl bg-slate-900 dark:bg-slate-700 text-white text-xs font-semibold whitespace-nowrap shrink-0"
            >
              Save Bio
            </button>
          </div>

          {/* All Ratings Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
            {(
              [
                { k: 'bullet', label: 'Bullet' },
                { k: 'blitz', label: 'Blitz' },
                { k: 'rapid', label: 'Rapid' },
                { k: 'classical', label: 'Classical' },
                { k: 'daily', label: 'Daily' },
                { k: 'chess960', label: 'Chess960' },
                { k: 'puzzle', label: 'Puzzle' },
                { k: 'practice', label: 'AI Practice' },
              ] as const
            ).map((item) => (
              <div key={item.k} className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 p-3">
                <p className="text-[11px] text-slate-500 dark:text-slate-400">{item.label}</p>
                <p className="text-lg font-mono-tabular font-bold text-slate-900 dark:text-white mt-0.5">
                  {user.ratings[item.k]}
                  {user.stats.gamesPlayed < 20 && item.k !== 'practice' && (
                    <span className="text-xs text-amber-500 ml-0.5" title="Provisional rating">?</span>
                  )}
                </p>
                <p className="text-[10px] font-mono-tabular text-slate-400">
                  Peak {user.peakRatings[item.k]}
                </p>
              </div>
            ))}
          </div>

          <TitleLegendHint />
        </div>
      )}

      {/* Achievements & Friends */}
      {user && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-7 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
            <h2 className="text-base font-display font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Award className="w-4 h-4 text-amber-500" />
              Achievements ({user.achievements.length}/{ACHIEVEMENTS_CATALOG.length})
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {ACHIEVEMENTS_CATALOG.map((ach) => {
                const unlocked = user.achievements.includes(ach.id);
                return (
                  <div
                    key={ach.id}
                    className={`rounded-xl border p-3 transition-colors ${
                      unlocked
                        ? 'border-amber-500/40 bg-amber-500/10'
                        : 'border-slate-200 dark:border-slate-800 opacity-55'
                    }`}
                  >
                    <p className="text-xs font-bold text-slate-900 dark:text-white">{ach.name}</p>
                    <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5">{ach.description}</p>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="lg:col-span-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
            <h2 className="text-base font-display font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Users className="w-4 h-4 text-emerald-500" />
              Friends & Invitations
            </h2>
            <div className="flex gap-2">
              <input
                type="text"
                value={friendUsername}
                onChange={(e) => setFriendUsername(e.target.value)}
                placeholder="Add friend by username..."
                className="flex-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs"
              />
              <button
                type="button"
                onClick={async () => {
                  try {
                    await apiFetch('/api/friends/request', {
                      method: 'POST',
                      body: JSON.stringify({ username: friendUsername }),
                    });
                    setFriendMsg(`Friend request sent to @${friendUsername}`);
                    setFriendUsername('');
                  } catch (e) {
                    setFriendMsg(e instanceof Error ? e.message : 'Unable to send request');
                  }
                }}
                className="px-3 py-2 rounded-xl bg-emerald-600 text-white text-xs font-semibold inline-flex items-center gap-1"
              >
                <UserPlus className="w-3.5 h-3.5" />
                Add
              </button>
            </div>
            {friendMsg && <p className="text-xs text-emerald-600 dark:text-emerald-400">{friendMsg}</p>}

            {user.friendRequests.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-slate-500">Pending Requests</p>
                {user.friendRequests.map((reqId) => (
                  <div key={reqId} className="flex items-center justify-between text-xs bg-slate-50 dark:bg-slate-800 p-2 rounded-lg">
                    <span className="font-mono-tabular">{reqId}</span>
                    <div className="flex gap-1.5">
                      <button
                        type="button"
                        onClick={async () => {
                          const r = await apiFetch<{ user: PublicUser }>('/api/friends/respond', {
                            method: 'POST',
                            body: JSON.stringify({ userId: reqId, accept: true }),
                          });
                          setSession(r.user, null);
                        }}
                        className="px-2 py-1 rounded bg-emerald-600 text-white font-semibold"
                      >
                        Accept
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          const r = await apiFetch<{ user: PublicUser }>('/api/friends/respond', {
                            method: 'POST',
                            body: JSON.stringify({ userId: reqId, accept: false }),
                          });
                          setSession(r.user, null);
                        }}
                        className="px-2 py-1 rounded bg-slate-200 dark:bg-slate-700 font-semibold"
                      >
                        Decline
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <p className="text-xs text-slate-500 dark:text-slate-400">
              {user.friends.length === 0 ? 'No friends added yet.' : `${user.friends.length} connected friend(s).`}
            </p>
          </div>
        </div>
      )}

      {/* Global Leaderboards & Rating Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-base font-display font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Trophy className="w-4 h-4 text-amber-500" />
              Global Leaderboards
            </h2>
            <div className="flex items-center gap-1 p-1 rounded-lg bg-slate-100 dark:bg-slate-800">
              {(['bullet', 'blitz', 'rapid', 'classical', 'puzzle'] as const).map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setLbCategory(cat)}
                  className={`px-2.5 py-1 rounded text-xs font-semibold capitalize ${
                    lbCategory === cat ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs' : 'text-slate-500'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {leaderboard.map((player, idx) => (
              <div key={player.id} className="py-2.5 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="w-6 text-xs font-mono-tabular font-bold text-slate-400">
                    #{idx + 1}
                  </span>
                  <UserTitleBadge
                    username={player.username}
                    role={player.role}
                    officialFideTitle={player.officialFideTitle}
                    fideVerified={player.fideVerified}
                    platformTitle={player.platformTitle}
                    verified={player.verified}
                    compact
                  />
                </div>
                <span className="font-mono-tabular text-sm font-bold text-emerald-600 dark:text-emerald-400">
                  {player.ratings[lbCategory]}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="lg:col-span-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
          <h2 className="text-base font-display font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Shield className="w-4 h-4 text-emerald-500" />
            Rating Distribution
          </h2>
          <div className="space-y-2.5">
            {distribution.map((b) => {
              const max = Math.max(1, ...distribution.map((x) => x.count));
              return (
                <div key={b.label} className="space-y-1">
                  <div className="flex justify-between text-xs font-mono-tabular">
                    <span className="text-slate-600 dark:text-slate-300">{b.label}</span>
                    <span className="font-semibold text-slate-900 dark:text-white">{b.count}</span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                    <div
                      className="h-full bg-emerald-600 rounded-full"
                      style={{ width: `${(b.count / max) * 100}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {localGames.length > 0 && (
            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2">
              <p className="text-xs font-semibold text-slate-900 dark:text-white">Saved Local Archive</p>
              {localGames.slice(0, 4).map((g) => (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => onReviewGame(g)}
                  className="w-full text-left text-xs py-1.5 px-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/70 hover:bg-emerald-500/10 flex items-center justify-between"
                >
                  <span className="truncate">{g.whiteName} vs {g.blackName}</span>
                  <span className="font-mono-tabular text-emerald-600 font-semibold">{g.result}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
