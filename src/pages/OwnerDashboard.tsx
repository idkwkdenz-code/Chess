import React, { useEffect, useState } from 'react';
import {
  Activity,
  Award,
  Ban,
  Bot,
  CheckCircle2,
  Crown,
  Gamepad2,
  KeyRound,
  Lock,
  Search,
  Settings2,
  ShieldAlert,
  TrendingUp,
  Users,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { UserTitleBadge } from '../components/PlayerBadges';
import type { AppConfig, AuditLogEntry, FideTitle, OnlineGameState, PlatformTitle, PublicUser, TournamentRecord } from '../types/chess';

type OwnerTab = 'stats' | 'users' | 'ratings' | 'titles' | 'games' | 'ai' | 'app' | 'security';

export const OwnerDashboard: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { user, apiFetch, refreshConfig, setSession } = useAuth();
  const [tab, setTab] = useState<OwnerTab>('stats');
  const [overview, setOverview] = useState<{
    stats: Record<string, number | string>;
    appConfig: AppConfig;
    auditLogs: AuditLogEntry[];
    loginHistory: { at: number; ip: string; userAgent: string; success: boolean }[];
  } | null>(null);
  const [users, setUsers] = useState<PublicUser[]>([]);
  const [userSearch, setUserSearch] = useState('');
  const [games, setGames] = useState<(OnlineGameState & { reports?: { reason: string; reporterUsername: string }[] })[]>([]);
  const [tournaments, setTournaments] = useState<TournamentRecord[]>([]);
  const [configDraft, setConfigDraft] = useState<AppConfig | null>(null);
  const [statusMsg, setStatusMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Rating / Title modal state
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [ratingCategory, setRatingCategory] = useState<'bullet' | 'blitz' | 'rapid' | 'classical' | 'puzzle'>('blitz');
  const [ratingValue, setRatingValue] = useState('1200');
  const [platformTitleVal, setPlatformTitleVal] = useState<PlatformTitle>('Master');
  const [customTitleVal, setCustomTitleVal] = useState('');
  const [fideTitleVal, setFideTitleVal] = useState<FideTitle | ''>('');
  const [fideConfirmed, setFideConfirmed] = useState(false);

  // 2FA setup state
  const [totpSecret, setTotpSecret] = useState('');
  const [totpCode, setTotpCode] = useState('');

  // Confirmation modal for dangerous actions
  const [confirmAction, setConfirmAction] = useState<{ title: string; body: string; run: () => Promise<void> } | null>(null);

  const loadAll = async () => {
    try {
      const [ov, us, gm, tr] = await Promise.all([
        apiFetch<typeof overview>('/api/owner/overview'),
        apiFetch<{ users: PublicUser[] }>(`/api/owner/users?q=${encodeURIComponent(userSearch)}`),
        apiFetch<{ games: typeof games }>('/api/owner/games'),
        apiFetch<{ tournaments: TournamentRecord[] }>('/api/tournaments'),
      ]);
      if (ov) {
        setOverview(ov);
        setConfigDraft(ov.appConfig);
      }
      setUsers(us.users);
      if (!selectedUserId && us.users.length > 0) {
        setSelectedUserId(us.users[0].id);
      }
      setGames(gm.games);
      setTournaments(tr.tournaments);
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : 'Unable to load Owner data.');
    }
  };

  useEffect(() => {
    loadAll();
  }, [tab]);

  if (!user || user.role !== 'OWNER' || user.username.toLowerCase() !== 'lmxynnn') {
    return (
      <div className="rounded-2xl border border-rose-500/40 bg-rose-500/10 p-6 text-center">
        <p className="text-sm font-semibold text-rose-600 dark:text-rose-400">
          Access Restricted: Owner authorization required.
        </p>
      </div>
    );
  }

  const flash = (msg: string) => {
    setStatusMsg(msg);
    setErrorMsg('');
    setTimeout(() => setStatusMsg(''), 3500);
  };

  const moderateUser = async (targetId: string, action: string, extra: Record<string, unknown> = {}) => {
    try {
      await apiFetch(`/api/owner/users/${targetId}/moderate`, {
        method: 'POST',
        body: JSON.stringify({ action, ...extra }),
      });
      flash(`User moderation (${action}) applied.`);
      await loadAll();
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : 'Moderation failed');
    }
  };

  const saveConfig = async () => {
    if (!configDraft) return;
    try {
      await apiFetch('/api/owner/config', {
        method: 'PUT',
        body: JSON.stringify(configDraft),
      });
      await refreshConfig();
      flash('Platform configuration saved.');
      await loadAll();
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : 'Config save failed');
    }
  };

  const selectedTarget = users.find((u) => u.id === selectedUserId) || users[0];

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-amber-500/40 bg-gradient-to-r from-amber-500/10 via-transparent to-transparent p-5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center shadow-sm">
            <Crown className="w-6 h-6 fill-current" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-display font-bold text-slate-900 dark:text-white">
                Owner Super Admin Dashboard
              </h1>
              <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-600 dark:text-amber-400 text-[11px] font-bold">
                OWNER ONLY
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Authenticated as @lmxynnn · Developer: CART3R Chess Academy
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="px-3.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200"
        >
          Back to Profile
        </button>
      </div>

      {statusMsg && (
        <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/30 px-4 py-2.5 text-xs font-medium text-emerald-700 dark:text-emerald-300">
          {statusMsg}
        </div>
      )}
      {errorMsg && (
        <div className="rounded-xl bg-rose-500/10 border border-rose-500/30 px-4 py-2.5 text-xs font-medium text-rose-700 dark:text-rose-300">
          {errorMsg}
        </div>
      )}

      {/* Owner Section Tabs */}
      <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-200/70 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-x-auto">
        {(
          [
            { id: 'stats', label: 'Statistics', icon: Activity },
            { id: 'users', label: 'Users', icon: Users },
            { id: 'ratings', label: 'Ratings', icon: TrendingUp },
            { id: 'titles', label: 'Chess Titles', icon: Award },
            { id: 'games', label: 'Games & Tourneys', icon: Gamepad2 },
            { id: 'ai', label: 'AI Controls', icon: Bot },
            { id: 'app', label: 'App Config', icon: Settings2 },
            { id: 'security', label: 'Security & Audit', icon: Lock },
          ] as const
        ).map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors ${
                tab === item.id
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {item.label}
            </button>
          );
        })}
      </div>

      {/* 1. Statistics */}
      {tab === 'stats' && overview && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Total Registered Users', value: overview.stats.totalUsers },
            { label: 'Online Users Now', value: overview.stats.onlineUsers },
            { label: 'Total Games Recorded', value: overview.stats.totalGames },
            { label: 'Games Played Today', value: overview.stats.gamesToday },
            { label: 'Active Tournaments', value: overview.stats.activeTournaments },
            { label: 'Total Puzzles Solved', value: overview.stats.totalPuzzlesSolved },
            { label: 'New Registrations Today', value: overview.stats.newRegistrationsToday },
            { label: 'Server Status & Uptime', value: `${overview.stats.serverStatus} (${overview.stats.uptimeSeconds}s)` },
          ].map((kpi) => (
            <div key={kpi.label} className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
              <p className="text-xs text-slate-500 dark:text-slate-400">{kpi.label}</p>
              <p className="mt-1.5 text-xl font-mono-tabular font-bold text-slate-900 dark:text-white">
                {kpi.value}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* 2. User Management */}
      {tab === 'users' && (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                placeholder="Search by username or user ID..."
                className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-white"
              />
            </div>
            <button
              type="button"
              onClick={loadAll}
              className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-semibold"
            >
              Search
            </button>
          </div>

          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {users.map((u) => (
              <div key={u.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="min-w-0">
                  <UserTitleBadge
                    username={u.username}
                    role={u.role}
                    officialFideTitle={u.officialFideTitle}
                    fideVerified={u.fideVerified}
                    platformTitle={u.platformTitle}
                    customTitle={u.customTitle}
                    verified={u.verified}
                  />
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-mono-tabular mt-0.5">
                    ID: {u.id} · Status: {u.status} · Joined {new Date(u.createdAt).toLocaleDateString()}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => moderateUser(u.id, 'verify', { verified: !u.verified })}
                    className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium inline-flex items-center gap-1"
                  >
                    <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                    {u.verified ? 'Unverify' : 'Verify'}
                  </button>

                  {u.role !== 'OWNER' && (
                    <>
                      <button
                        type="button"
                        onClick={() => moderateUser(u.id, 'suspend', { hours: 24 })}
                        className="px-2.5 py-1 rounded-lg border border-amber-500/40 text-amber-600 dark:text-amber-400 text-xs font-medium"
                      >
                        Suspend 24h
                      </button>

                      {u.status === 'BANNED' || u.status === 'SUSPENDED' ? (
                        <button
                          type="button"
                          onClick={() => moderateUser(u.id, 'unban')}
                          className="px-2.5 py-1 rounded-lg bg-emerald-600 text-white text-xs font-medium"
                        >
                          Restore
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() =>
                            setConfirmAction({
                              title: `Ban @${u.username}?`,
                              body: 'This will immediately revoke active sessions and prevent login.',
                              run: async () => moderateUser(u.id, 'ban'),
                            })
                          }
                          className="px-2.5 py-1 rounded-lg bg-rose-600 text-white text-xs font-medium inline-flex items-center gap-1"
                        >
                          <Ban className="w-3 h-3" />
                          Ban
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 3. Rating Management */}
      {tab === 'ratings' && (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <select
              value={selectedUserId}
              onChange={(e) => setSelectedUserId(e.target.value)}
              className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs"
            >
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  @{u.username} (Blitz {u.ratings.blitz} / Rapid {u.ratings.rapid})
                </option>
              ))}
            </select>

            <select
              value={ratingCategory}
              onChange={(e) => setRatingCategory(e.target.value as typeof ratingCategory)}
              className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs"
            >
              <option value="bullet">Bullet</option>
              <option value="blitz">Blitz</option>
              <option value="rapid">Rapid</option>
              <option value="classical">Classical</option>
              <option value="puzzle">Puzzle</option>
            </select>

            <input
              type="number"
              min={100}
              max={3500}
              value={ratingValue}
              onChange={(e) => setRatingValue(e.target.value)}
              className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs font-mono-tabular"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={async () => {
                if (!selectedTarget) return;
                try {
                  await apiFetch(`/api/owner/users/${selectedTarget.id}/ratings`, {
                    method: 'POST',
                    body: JSON.stringify({ mode: 'set', category: ratingCategory, value: Number(ratingValue) }),
                  });
                  flash(`Updated @${selectedTarget.username} ${ratingCategory} rating.`);
                  await loadAll();
                } catch (e) {
                  setErrorMsg(e instanceof Error ? e.message : 'Failed to adjust rating');
                }
              }}
              className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-semibold"
            >
              Apply Rating Change
            </button>

            <button
              type="button"
              onClick={() => {
                if (!selectedTarget) return;
                setConfirmAction({
                  title: `Reset all ratings for @${selectedTarget.username}?`,
                  body: 'All Bullet, Blitz, Rapid, Classical, and Puzzle ratings will reset to 400.',
                  run: async () => {
                    await apiFetch(`/api/owner/users/${selectedTarget.id}/ratings`, {
                      method: 'POST',
                      body: JSON.stringify({ mode: 'reset' }),
                    });
                    flash(`Reset ratings for @${selectedTarget.username} to 400.`);
                    await loadAll();
                  },
                });
              }}
              className="px-4 py-2 rounded-xl bg-rose-600 text-white text-xs font-semibold"
            >
              Reset Player Ratings to 400
            </button>
          </div>
        </div>
      )}

      {/* 4. Chess Title Management */}
      {tab === 'titles' && (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-5">
          <div className="rounded-xl bg-amber-500/10 border border-amber-500/30 p-3 text-xs text-amber-800 dark:text-amber-300">
            Official FIDE titles (GM, IM, FM, CM, WGM, WIM, WFM, WCM, NM) must only be verified for authentic titleholders. Platform tiers and custom titles are clearly separated.
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
              Target Player
            </label>
            <select
              value={selectedUserId}
              onChange={(e) => setSelectedUserId(e.target.value)}
              className="w-full sm:w-80 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs"
            >
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  @{u.username} — {u.platformTitle} {u.fideVerified ? `(${u.officialFideTitle})` : ''}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Platform Achievement Title */}
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 space-y-3">
              <h3 className="text-xs font-bold text-slate-900 dark:text-white">Platform Achievement Tier</h3>
              <select
                value={platformTitleVal}
                onChange={(e) => setPlatformTitleVal(e.target.value as PlatformTitle)}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-2.5 py-1.5 text-xs"
              >
                {(['Beginner', 'Intermediate', 'Advanced', 'Expert', 'Master', 'Elite', 'Grandmaster-level'] as const).map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
              <button
                type="button"
                onClick={async () => {
                  if (!selectedTarget) return;
                  await apiFetch(`/api/owner/users/${selectedTarget.id}/titles`, {
                    method: 'POST',
                    body: JSON.stringify({ titleType: 'PLATFORM', titleValue: platformTitleVal }),
                  });
                  flash(`Assigned platform tier ${platformTitleVal}.`);
                  await loadAll();
                }}
                className="w-full py-2 rounded-lg bg-slate-900 dark:bg-slate-700 text-white text-xs font-semibold"
              >
                Assign Platform Tier
              </button>
            </div>

            {/* Custom Title */}
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 space-y-3">
              <h3 className="text-xs font-bold text-slate-900 dark:text-white">Custom Platform Title</h3>
              <input
                type="text"
                value={customTitleVal}
                onChange={(e) => setCustomTitleVal(e.target.value)}
                placeholder="e.g. Club Master, Arena Legend..."
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-2.5 py-1.5 text-xs"
              />
              <button
                type="button"
                onClick={async () => {
                  if (!selectedTarget) return;
                  await apiFetch(`/api/owner/users/${selectedTarget.id}/titles`, {
                    method: 'POST',
                    body: JSON.stringify({ titleType: 'CUSTOM', titleValue: customTitleVal, icon: 'award' }),
                  });
                  flash(`Updated custom title for @${selectedTarget.username}.`);
                  await loadAll();
                }}
                className="w-full py-2 rounded-lg bg-emerald-600 text-white text-xs font-semibold"
              >
                Save Custom Title
              </button>
            </div>

            {/* Official FIDE Verification */}
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 space-y-3">
              <h3 className="text-xs font-bold text-slate-900 dark:text-white">Official FIDE Verification</h3>
              <select
                value={fideTitleVal}
                onChange={(e) => setFideTitleVal(e.target.value as FideTitle | '')}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-2.5 py-1.5 text-xs"
              >
                <option value="">None (Remove FIDE Title)</option>
                {(['GM', 'IM', 'FM', 'CM', 'WGM', 'WIM', 'WFM', 'WCM', 'NM'] as const).map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
              <label className="flex items-start gap-2 text-[11px] text-slate-600 dark:text-slate-300">
                <input
                  type="checkbox"
                  checked={fideConfirmed}
                  onChange={(e) => setFideConfirmed(e.target.checked)}
                  className="mt-0.5 accent-emerald-600"
                />
                I confirm this player holds verified official FIDE credentials.
              </label>
              <button
                type="button"
                onClick={async () => {
                  if (!selectedTarget) return;
                  try {
                    await apiFetch(`/api/owner/users/${selectedTarget.id}/titles`, {
                      method: 'POST',
                      body: JSON.stringify({
                        titleType: 'FIDE',
                        titleValue: fideTitleVal || null,
                        fideConfirmed,
                      }),
                    });
                    flash(`Updated FIDE title verification for @${selectedTarget.username}.`);
                    await loadAll();
                  } catch (e) {
                    setErrorMsg(e instanceof Error ? e.message : 'FIDE update failed');
                  }
                }}
                className="w-full py-2 rounded-lg bg-rose-700 text-white text-xs font-semibold"
              >
                Update FIDE Title
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. Games & Tournaments */}
      {tab === 'games' && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
            <h3 className="text-sm font-display font-bold text-slate-900 dark:text-white mb-3">
              Online Games & Reports ({games.length})
            </h3>
            {games.length === 0 ? (
              <p className="text-xs text-slate-500 dark:text-slate-400">No online games recorded yet.</p>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {games.map((g) => (
                  <div key={g.id} className="py-2.5 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold text-slate-900 dark:text-white">
                        {g.whiteName} vs {g.blackName} · {g.timeControl.label} · {g.status}
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        {g.result} · {g.movesSan.length} plies {g.reports && g.reports.length > 0 ? `· ${g.reports.length} Report(s)` : ''}
                      </p>
                    </div>
                    {g.status === 'active' && (
                      <button
                        type="button"
                        onClick={() =>
                          setConfirmAction({
                            title: 'Cancel active game?',
                            body: `Cancel ${g.whiteName} vs ${g.blackName} immediately.`,
                            run: async () => {
                              await apiFetch(`/api/owner/games/${g.id}/cancel`, { method: 'POST' });
                              flash('Game cancelled.');
                              await loadAll();
                            },
                          })
                        }
                        className="px-3 py-1 rounded-lg bg-rose-600 text-white text-xs font-semibold"
                      >
                        Cancel Game
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
            <h3 className="text-sm font-display font-bold text-slate-900 dark:text-white mb-3">
              Tournaments ({tournaments.length})
            </h3>
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {tournaments.map((t) => (
                <div key={t.id} className="py-2.5 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold text-slate-900 dark:text-white">
                      {t.name} ({t.format} · {t.timeControl.label})
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Status: {t.status} · {t.participants.length}/{t.maxPlayers} players
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {(['upcoming', 'active', 'completed'] as const).map((st) => (
                      <button
                        key={st}
                        type="button"
                        onClick={async () => {
                          await apiFetch(`/api/owner/tournaments/${t.id}/manage`, {
                            method: 'POST',
                            body: JSON.stringify({ action: st }),
                          });
                          flash(`Tournament marked ${st}.`);
                          await loadAll();
                        }}
                        className={`px-2.5 py-1 rounded text-[11px] font-semibold capitalize ${
                          t.status === st ? 'bg-emerald-600 text-white' : 'bg-slate-100 dark:bg-slate-800'
                        }`}
                      >
                        {st}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 6. AI Management & 7. Application Config */}
      {(tab === 'ai' || tab === 'app') && configDraft && (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="block space-y-1">
              <span className="text-xs font-medium text-slate-600 dark:text-slate-300">Application Name</span>
              <input
                type="text"
                value={configDraft.appName}
                onChange={(e) => setConfigDraft({ ...configDraft, appName: e.target.value })}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs"
              />
            </label>
            <label className="block space-y-1">
              <span className="text-xs font-medium text-slate-600 dark:text-slate-300">Max Engine Depth</span>
              <input
                type="number"
                min={2}
                max={18}
                value={configDraft.maxEngineDepth}
                onChange={(e) => setConfigDraft({ ...configDraft, maxEngineDepth: Number(e.target.value) || 10 })}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs font-mono-tabular"
              />
            </label>
          </div>

          <label className="block space-y-1">
            <span className="text-xs font-medium text-slate-600 dark:text-slate-300">Global Announcement Banner</span>
            <input
              type="text"
              value={configDraft.announcement}
              onChange={(e) => setConfigDraft({ ...configDraft, announcement: e.target.value })}
              className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs"
            />
          </label>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            {(
              [
                { key: 'stockfishEnabled', label: 'Stockfish Engine' },
                { key: 'mirrorBotEnabled', label: 'Mirror Bot' },
                { key: 'onlineEnabled', label: 'Online Arena' },
                { key: 'tournamentsEnabled', label: 'Tournaments' },
                { key: 'coachEnabled', label: 'AI Chess Coach' },
                { key: 'puzzlesEnabled', label: 'Puzzles' },
              ] as const
            ).map((f) => (
              <label
                key={f.key}
                className="flex items-center justify-between rounded-xl border border-slate-200 dark:border-slate-800 px-3 py-2 text-xs"
              >
                <span>{f.label}</span>
                <input
                  type="checkbox"
                  checked={configDraft.features[f.key]}
                  onChange={(e) =>
                    setConfigDraft({
                      ...configDraft,
                      features: { ...configDraft.features, [f.key]: e.target.checked },
                    })
                  }
                  className="accent-emerald-600"
                />
              </label>
            ))}
          </div>

          <label className="flex items-center justify-between rounded-xl border border-rose-500/30 bg-rose-500/5 px-3.5 py-2.5 text-xs font-semibold text-rose-700 dark:text-rose-300">
            <span>Maintenance Mode (Restricts non-Owner gameplay)</span>
            <input
              type="checkbox"
              checked={configDraft.maintenanceMode}
              onChange={(e) => setConfigDraft({ ...configDraft, maintenanceMode: e.target.checked })}
              className="accent-rose-600"
            />
          </label>

          <button
            type="button"
            onClick={saveConfig}
            className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold"
          >
            Save Application & AI Settings
          </button>
        </div>
      )}

      {/* 8. Owner Security & Audit Log */}
      {tab === 'security' && overview && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-display font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <KeyRound className="w-4 h-4 text-amber-500" />
                  Two-Factor Authentication (TOTP) & Session Security
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  2FA Status: <strong>{user.twoFactorEnabled ? 'Enabled' : 'Disabled'}</strong>
                </p>
              </div>
              <div className="flex items-center gap-2">
                {!user.twoFactorEnabled ? (
                  <button
                    type="button"
                    onClick={async () => {
                      const res = await apiFetch<{ secret: string }>('/api/auth/2fa/setup', { method: 'POST' });
                      setTotpSecret(res.secret);
                    }}
                    className="px-3.5 py-2 rounded-xl bg-amber-600 text-white text-xs font-semibold"
                  >
                    Configure 2FA
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={async () => {
                      const res = await apiFetch<{ user: PublicUser }>('/api/auth/2fa/disable', { method: 'POST' });
                      setSession(res.user, null);
                      flash('2FA disabled.');
                    }}
                    className="px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold"
                  >
                    Disable 2FA
                  </button>
                )}

                <button
                  type="button"
                  onClick={async () => {
                    const res = await apiFetch<{ token: string; user: PublicUser }>('/api/auth/revoke-sessions', { method: 'POST' });
                    setSession(res.user, res.token);
                    flash('All prior Owner sessions invalidated.');
                  }}
                  className="px-3.5 py-2 rounded-xl border border-rose-500/40 text-rose-600 dark:text-rose-400 text-xs font-semibold"
                >
                  Revoke Other Sessions
                </button>
              </div>
            </div>

            {totpSecret && !user.twoFactorEnabled && (
              <div className="rounded-xl bg-slate-100 dark:bg-slate-800 p-4 space-y-2.5">
                <p className="text-xs text-slate-700 dark:text-slate-200">
                  Enter this TOTP secret into your Authenticator app: <code className="font-mono-tabular font-bold">{totpSecret}</code>
                </p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={totpCode}
                    onChange={(e) => setTotpCode(e.target.value)}
                    placeholder="6-digit code"
                    className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs font-mono-tabular"
                  />
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        const res = await apiFetch<{ user: PublicUser }>('/api/auth/2fa/enable', {
                          method: 'POST',
                          body: JSON.stringify({ code: totpCode }),
                        });
                        setSession(res.user, null);
                        setTotpSecret('');
                        setTotpCode('');
                        flash('2FA successfully activated on @lmxynnn.');
                      } catch (e) {
                        setErrorMsg(e instanceof Error ? e.message : 'Invalid 2FA code');
                      }
                    }}
                    className="px-4 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-semibold"
                  >
                    Verify & Enable
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
              <h3 className="text-sm font-display font-bold text-slate-900 dark:text-white mb-3">
                Owner Login History
              </h3>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {overview.loginHistory.map((lh, i) => (
                  <div key={i} className="text-xs flex items-center justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
                    <span className="font-mono-tabular text-slate-600 dark:text-slate-300">
                      {new Date(lh.at).toLocaleString()}
                    </span>
                    <span className={lh.success ? 'text-emerald-600 font-semibold' : 'text-rose-500 font-semibold'}>
                      {lh.success ? 'Success' : 'Failed'}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
              <h3 className="text-sm font-display font-bold text-slate-900 dark:text-white mb-3">
                Administrative Audit Log
              </h3>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {overview.auditLogs.map((log) => (
                  <div key={log.id} className="text-xs py-1.5 border-b border-slate-100 dark:border-slate-800">
                    <div className="flex items-center justify-between">
                      <span className="font-mono-tabular font-bold text-slate-900 dark:text-white">{log.action}</span>
                      <span className="font-mono-tabular text-slate-400">{new Date(log.createdAt).toLocaleTimeString()}</span>
                    </div>
                    <p className="text-slate-500 dark:text-slate-400">
                      Target: {log.target} — {log.details}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Dangerous Action Confirmation Modal */}
      {confirmAction && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 space-y-4 shadow-xl">
            <div className="flex items-center gap-2 text-rose-600">
              <ShieldAlert className="w-5 h-5" />
              <h3 className="text-base font-display font-bold">{confirmAction.title}</h3>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-300">{confirmAction.body}</p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmAction(null)}
                className="px-3.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  const fn = confirmAction.run;
                  setConfirmAction(null);
                  await fn();
                }}
                className="px-4 py-2 rounded-lg bg-rose-600 text-white text-xs font-semibold"
              >
                Confirm Action
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
