import { BoardThemeId, PieceStyleId, SoundPackId, TimeControl } from '../types/chess';

export interface BoardThemeDefinition {
  id: Exclude<BoardThemeId, 'custom'>;
  name: string;
  light: string;
  dark: string;
  highlight: string;
  coordLight: string;
  coordDark: string;
  border: string;
}

export const BOARD_THEMES: BoardThemeDefinition[] = [
  {
    id: 'wooden',
    name: 'Classic Wood',
    light: '#f0d9b5',
    dark: '#b58863',
    highlight: 'rgba(245, 158, 11, 0.45)',
    coordLight: '#9a6b47',
    coordDark: '#f0d9b5',
    border: '#6b472b',
  },
  {
    id: 'green',
    name: 'Tournament Green',
    light: '#eeeed2',
    dark: '#769656',
    highlight: 'rgba(250, 204, 21, 0.45)',
    coordLight: '#5a7840',
    coordDark: '#eeeed2',
    border: '#3f562b',
  },
  {
    id: 'blue',
    name: 'Ocean Slate',
    light: '#dee3e6',
    dark: '#6c8ea4',
    highlight: 'rgba(56, 189, 248, 0.42)',
    coordLight: '#4b6c82',
    coordDark: '#dee3e6',
    border: '#354f60',
  },
  {
    id: 'marble',
    name: 'Ivory Marble',
    light: '#f1f5f9',
    dark: '#64748b',
    highlight: 'rgba(16, 185, 129, 0.38)',
    coordLight: '#475569',
    coordDark: '#f1f5f9',
    border: '#334155',
  },
  {
    id: 'dark',
    name: 'Obsidian Night',
    light: '#475569',
    dark: '#1e293b',
    highlight: 'rgba(16, 185, 129, 0.42)',
    coordLight: '#cbd5e1',
    coordDark: '#94a3b8',
    border: '#0f172a',
  },
  {
    id: 'gold',
    name: 'Royal Gold',
    light: '#fef3c7',
    dark: '#b45309',
    highlight: 'rgba(251, 191, 36, 0.5)',
    coordLight: '#92400e',
    coordDark: '#fef3c7',
    border: '#78350f',
  },
  {
    id: 'purple',
    name: 'Amethyst Dusk',
    light: '#ede9fe',
    dark: '#6d28d9',
    highlight: 'rgba(217, 70, 239, 0.42)',
    coordLight: '#5b21b6',
    coordDark: '#ede9fe',
    border: '#4c1d95',
  },
  {
    id: 'glass',
    name: 'Frosted Glass',
    light: '#e2e8f0',
    dark: '#94a3b8',
    highlight: 'rgba(14, 165, 233, 0.4)',
    coordLight: '#475569',
    coordDark: '#f8fafc',
    border: '#64748b',
  },
  {
    id: 'galaxy',
    name: 'Deep Galaxy',
    light: '#312e81',
    dark: '#0f172a',
    highlight: 'rgba(167, 139, 250, 0.48)',
    coordLight: '#c7d2fe',
    coordDark: '#818cf8',
    border: '#1e1b4b',
  },
  {
    id: 'neon',
    name: 'Neon Matrix',
    light: '#1e293b',
    dark: '#064e3b',
    highlight: 'rgba(52, 211, 153, 0.5)',
    coordLight: '#34d399',
    coordDark: '#6ee7b7',
    border: '#10b981',
  },
  {
    id: 'cyberpunk',
    name: 'Cyberpunk 2099',
    light: '#2e1065',
    dark: '#090d16',
    highlight: 'rgba(244, 63, 94, 0.5)',
    coordLight: '#f472b6',
    coordDark: '#22d3ee',
    border: '#ec4899',
  },
  {
    id: 'minimalist',
    name: 'Minimalist Mono',
    light: '#fafafa',
    dark: '#a3a3a3',
    highlight: 'rgba(23, 23, 23, 0.25)',
    coordLight: '#525252',
    coordDark: '#fafafa',
    border: '#404040',
  },
];

export interface PieceStyleDefinition {
  id: PieceStyleId;
  name: string;
  description: string;
}

export const PIECE_STYLES: PieceStyleDefinition[] = [
  {
    id: 'classic',
    name: 'Staunton Classic',
    description: 'Balanced tournament proportions with crisp high-contrast silhouettes.',
  },
  {
    id: 'modern',
    name: 'Modern Flat',
    description: 'Clean geometric contours optimized for rapid bullet and blitz scanning.',
  },
  {
    id: '3d',
    name: 'Sculpted 3D',
    description: 'Layered depth shading and beveled bases for tactile presence.',
  },
  {
    id: 'neon',
    name: 'Neon Edge',
    description: 'Luminous emerald and cyan accents built for dark arenas.',
  },
  {
    id: 'glass',
    name: 'Crystal Glass',
    description: 'Translucent frosted specular highlights with subtle inner rims.',
  },
  {
    id: 'minimalist',
    name: 'Minimalist',
    description: 'Ultra-clean monochrome geometry with zero visual clutter.',
  },
  {
    id: 'futuristic',
    name: 'Cyber Vanguard',
    description: 'Angular sci-fi crowns and sharp faceted silhouettes.',
  },
];

export interface SoundPackDefinition {
  id: SoundPackId;
  name: string;
}

export const SOUND_PACKS: SoundPackDefinition[] = [
  { id: 'wood', name: 'Tournament Wood' },
  { id: 'glass', name: 'Crystal Tap' },
  { id: 'digital', name: 'Arcade Digital' },
  { id: 'silent', name: 'Silent Mode' },
];

export const TIME_CONTROLS: TimeControl[] = [
  { id: 'bullet-1-0', label: '1+0', category: 'bullet', initialSeconds: 60, incrementSeconds: 0 },
  { id: 'bullet-1-1', label: '1+1', category: 'bullet', initialSeconds: 60, incrementSeconds: 1 },
  { id: 'bullet-2-0', label: '2+0', category: 'bullet', initialSeconds: 120, incrementSeconds: 0 },
  { id: 'bullet-2-1', label: '2+1', category: 'bullet', initialSeconds: 120, incrementSeconds: 1 },
  { id: 'blitz-3-0', label: '3+0', category: 'blitz', initialSeconds: 180, incrementSeconds: 0 },
  { id: 'blitz-3-2', label: '3+2', category: 'blitz', initialSeconds: 180, incrementSeconds: 2 },
  { id: 'blitz-5-0', label: '5+0', category: 'blitz', initialSeconds: 300, incrementSeconds: 0 },
  { id: 'blitz-5-3', label: '5+3', category: 'blitz', initialSeconds: 300, incrementSeconds: 3 },
  { id: 'rapid-10-0', label: '10+0', category: 'rapid', initialSeconds: 600, incrementSeconds: 0 },
  { id: 'rapid-10-5', label: '10+5', category: 'rapid', initialSeconds: 600, incrementSeconds: 5 },
  { id: 'rapid-15-10', label: '15+10', category: 'rapid', initialSeconds: 900, incrementSeconds: 10 },
  { id: 'rapid-30-0', label: '30+0', category: 'rapid', initialSeconds: 1800, incrementSeconds: 0 },
  { id: 'classical-30-20', label: '30+20', category: 'classical', initialSeconds: 1800, incrementSeconds: 20 },
  { id: 'classical-60-0', label: '60+0', category: 'classical', initialSeconds: 3600, incrementSeconds: 0 },
];

export interface AchievementDefinition {
  id: string;
  name: string;
  description: string;
}

export const ACHIEVEMENTS_CATALOG: AchievementDefinition[] = [
  { id: 'first-victory', name: 'First Victory', description: 'Win your very first rated online game.' },
  { id: 'first-checkmate', name: 'Checkmate Artist', description: 'Deliver checkmate in a rated online match.' },
  { id: 'ten-wins', name: 'Rising Contender', description: 'Reach 10 total victories across competitive play.' },
  { id: 'hundred-wins', name: 'Centurion', description: 'Accumulate 100 career wins on the platform.' },
  { id: 'thousand-wins', name: 'Immortal Legend', description: 'Claim 1,000 victories in competitive chess.' },
  { id: 'win-streak-5', name: 'Unstoppable Streak', description: 'Win 5 consecutive rated games without a loss.' },
  { id: 'puzzle-streak-10', name: 'Tactical Razor', description: 'Achieve a 10-puzzle solve streak in Tactics Trainer.' },
  { id: 'legend-slayer', name: 'Legend Slayer', description: 'Defeat a Legendary AI opponent in a full game.' },
  { id: 'mirror-master', name: 'Mirror Duelist', description: 'Complete a training game inside Mirror Bot Studio.' },
  { id: 'opening-scholar', name: 'Opening Scholar', description: 'Explore variations in the Opening Explorer & Coach.' },
];
