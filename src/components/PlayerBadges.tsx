import React from 'react';
import { Award, CheckCircle2, Crown, ShieldCheck } from 'lucide-react';
import type { LegendaryBot, PublicUser, UserRole } from '../types/chess';

interface UserTitleLineProps {
  username: string;
  role?: UserRole;
  officialFideTitle?: string | null;
  fideVerified?: boolean;
  platformTitle?: string;
  customTitle?: string | null;
  verified?: boolean;
  compact?: boolean;
}

export const UserTitleBadge: React.FC<UserTitleLineProps> = ({
  username,
  role,
  officialFideTitle,
  fideVerified,
  platformTitle,
  customTitle,
  verified,
  compact = false,
}) => {
  const isOwner = role === 'OWNER' && username.toLowerCase() === 'lmxynnn';

  return (
    <span className="inline-flex items-center gap-1.5 flex-wrap">
      {isOwner && (
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 text-[11px] font-bold tracking-wide whitespace-nowrap shrink-0">
          <Crown className="w-3 h-3 fill-current" />
          OWNER
        </span>
      )}

      {fideVerified && officialFideTitle && (
        <span
          title="Verified Official FIDE Title"
          className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-rose-700 text-white text-[11px] font-bold whitespace-nowrap shrink-0"
        >
          {officialFideTitle}
        </span>
      )}

      <span className="font-semibold text-slate-900 dark:text-slate-100 truncate">
        @{username}
      </span>

      {verified && (
        <CheckCircle2
          className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0"
          aria-label="Verified profile"
        />
      )}

      {!compact && customTitle && !isOwner && (
        <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 dark:text-amber-400">
          <Award className="w-3 h-3" />
          {customTitle}
        </span>
      )}

      {!compact && platformTitle && (
        <span className="text-xs text-slate-500 dark:text-slate-400">
          · {platformTitle}
        </span>
      )}
    </span>
  );
};

export const UserAvatar: React.FC<{ user: Pick<PublicUser, 'username' | 'avatarColor' | 'role'>; size?: 'sm' | 'md' | 'lg' }> = ({
  user,
  size = 'md',
}) => {
  const isOwner = user.role === 'OWNER' && user.username.toLowerCase() === 'lmxynnn';
  const dim = size === 'sm' ? 'w-8 h-8 text-xs' : size === 'lg' ? 'w-16 h-16 text-xl' : 'w-10 h-10 text-sm';

  return (
    <div
      className={`${dim} rounded-xl flex items-center justify-center font-bold text-white shrink-0 relative`}
      style={{ backgroundColor: isOwner ? '#B45309' : user.avatarColor || '#15803D' }}
    >
      {user.username.slice(0, 2).toUpperCase()}
      {isOwner && (
        <span className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-amber-400 text-slate-950 flex items-center justify-center shadow-sm">
          <Crown className="w-3 h-3 fill-current" />
        </span>
      )}
    </div>
  );
};

export const LegendAvatar: React.FC<{ legend: LegendaryBot; size?: 'sm' | 'md' | 'lg' }> = ({
  legend,
  size = 'md',
}) => {
  const dim = size === 'sm' ? 'w-9 h-9 text-xs' : size === 'lg' ? 'w-14 h-14 text-lg' : 'w-11 h-11 text-sm';
  return (
    <div
      className={`${dim} rounded-xl flex items-center justify-center font-display font-bold text-white shrink-0 border border-white/15 shadow-sm`}
      style={{
        background: `linear-gradient(135deg, ${legend.accentHex}, #0F172A)`,
      }}
    >
      {legend.monogram}
    </div>
  );
};

export const TitleLegendHint: React.FC = () => (
  <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
    <span>Official FIDE titles (GM–NM) are strictly verified; platform tiers reflect academy ratings.</span>
  </div>
);
