import React, { useMemo, useState } from 'react';
import { Chess, Square } from 'chess.js';
import { BOARD_THEMES } from '../data/themes';
import type { UserSettings } from '../types/chess';
import { ChessPieceSvg } from './ChessPieceSvg';

interface ChessBoardProps {
  fen: string;
  onMove: (from: string, to: string, promotion?: string) => boolean | void;
  flipped?: boolean;
  interactive?: boolean;
  allowedColor?: 'w' | 'b' | 'both';
  lastMove?: { from: string; to: string } | null;
  bestMoveArrow?: { from: string; to: string } | null;
  evalCp?: number | null;
  mateIn?: number | null;
  settings: UserSettings;
  sizeClassName?: string;
}

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
const RANKS = ['8', '7', '6', '5', '4', '3', '2', '1'];

export const ChessBoard: React.FC<ChessBoardProps> = ({
  fen,
  onMove,
  flipped = false,
  interactive = true,
  allowedColor = 'both',
  lastMove = null,
  bestMoveArrow = null,
  evalCp = null,
  mateIn = null,
  settings,
  sizeClassName = 'w-full max-w-[520px]',
}) => {
  const [selectedSquare, setSelectedSquare] = useState<Square | null>(null);
  const [pendingPromotion, setPendingPromotion] = useState<{ from: Square; to: Square; color: 'w' | 'b' } | null>(null);
  const [pendingConfirm, setPendingConfirm] = useState<{ from: Square; to: Square; promotion?: string } | null>(null);
  const [dragFrom, setDragFrom] = useState<Square | null>(null);

  const chess = useMemo(() => {
    try {
      return new Chess(fen);
    } catch {
      return new Chess();
    }
  }, [fen]);

  const theme = useMemo(() => {
    if (settings.boardTheme === 'custom') {
      return {
        id: 'custom',
        name: 'Custom',
        light: settings.customLightSquare,
        dark: settings.customDarkSquare,
        highlight: 'rgba(16, 185, 129, 0.4)',
        coordLight: settings.customDarkSquare,
        coordDark: settings.customLightSquare,
        border: '#334155',
      };
    }
    return BOARD_THEMES.find((t) => t.id === settings.boardTheme) || BOARD_THEMES[0];
  }, [settings.boardTheme, settings.customLightSquare, settings.customDarkSquare]);

  const legalTargets = useMemo(() => {
    if (!selectedSquare) return new Map<string, boolean>();
    const map = new Map<string, boolean>();
    const moves = chess.moves({ square: selectedSquare, verbose: true });
    for (const m of moves) {
      map.set(m.to, Boolean(m.captured));
    }
    return map;
  }, [chess, selectedSquare]);

  const inCheckKingSquare = useMemo(() => {
    if (!settings.highlightCheck || !chess.inCheck()) return null;
    const turn = chess.turn();
    const board = chess.board();
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const p = board[r][c];
        if (p && p.type === 'k' && p.color === turn) {
          return `${FILES[c]}${RANKS[r]}`;
        }
      }
    }
    return null;
  }, [chess, settings.highlightCheck]);

  const displayFiles = flipped ? [...FILES].reverse() : FILES;
  const displayRanks = flipped ? [...RANKS].reverse() : RANKS;

  const attemptMove = (from: Square, to: Square) => {
    const piece = chess.get(from);
    if (!piece) return;
    const moves = chess.moves({ square: from, verbose: true });
    const matching = moves.filter((m) => m.to === to);
    if (matching.length === 0) return;

    if (matching.some((m) => m.promotion)) {
      setPendingPromotion({ from, to, color: piece.color });
      setSelectedSquare(null);
      return;
    }

    if (settings.moveConfirmation) {
      setPendingConfirm({ from, to });
      setSelectedSquare(null);
      return;
    }

    onMove(from, to);
    setSelectedSquare(null);
  };

  const handleSquareClick = (sq: Square) => {
    if (!interactive || pendingPromotion || pendingConfirm) return;
    const turn = chess.turn();
    if (allowedColor !== 'both' && turn !== allowedColor) return;

    if (selectedSquare && legalTargets.has(sq)) {
      attemptMove(selectedSquare, sq);
      return;
    }

    const clickedPiece = chess.get(sq);
    if (clickedPiece && clickedPiece.color === turn) {
      setSelectedSquare(sq === selectedSquare ? null : sq);
    } else {
      setSelectedSquare(null);
    }
  };

  const squareCenter = (sq: string) => {
    const f = FILES.indexOf(sq[0]);
    const r = RANKS.indexOf(sq[1]);
    const x = flipped ? 7 - f : f;
    const y = flipped ? 7 - r : r;
    return { x: x * 12.5 + 6.25, y: y * 12.5 + 6.25 };
  };

  const evalWhitePct = useMemo(() => {
    if (mateIn !== null && mateIn !== undefined) {
      return mateIn > 0 ? 96 : 4;
    }
    if (evalCp === null || evalCp === undefined) return 50;
    const clamped = Math.max(-1000, Math.min(1000, evalCp));
    return 50 + (clamped / 1000) * 46;
  }, [evalCp, mateIn]);

  const evalText = useMemo(() => {
    if (mateIn !== null && mateIn !== undefined) return `M${Math.abs(mateIn)}`;
    if (evalCp === null || evalCp === undefined) return '0.0';
    const val = (evalCp / 100).toFixed(1);
    return evalCp > 0 ? `+${val}` : val;
  }, [evalCp, mateIn]);

  return (
    <div className={`flex items-stretch gap-2 select-none ${sizeClassName}`}>
      {settings.showEvalBar && evalCp !== null && (
        <div
          className="w-6 shrink-0 rounded-md overflow-hidden border border-slate-300 dark:border-slate-700 bg-slate-900 flex flex-col relative"
          aria-label={`Engine evaluation ${evalText}`}
        >
          <div
            className="w-full bg-slate-800 transition-all duration-300"
            style={{ height: `${flipped ? evalWhitePct : 100 - evalWhitePct}%` }}
          />
          <div
            className="w-full bg-slate-100 transition-all duration-300 flex-1"
          />
          <span
            className={`absolute left-0 right-0 text-center text-[9px] font-mono-tabular font-bold px-0.5 ${
              (evalCp ?? 0) >= 0 ? 'bottom-1 text-slate-900' : 'top-1 text-slate-100'
            }`}
          >
            {evalText}
          </span>
        </div>
      )}

      <div
        className="relative flex-1 aspect-square rounded-lg overflow-hidden shadow-lg border-2"
        style={{ borderColor: theme.border }}
      >
        <div className="grid grid-cols-8 grid-rows-8 w-full h-full">
          {displayRanks.map((rank, rIdx) =>
            displayFiles.map((file, fIdx) => {
              const sq = `${file}${rank}` as Square;
              const isLight = (FILES.indexOf(file) + RANKS.indexOf(rank)) % 2 === 0;
              const piece = chess.get(sq);
              const isSelected = selectedSquare === sq;
              const isLegalTarget = legalTargets.has(sq);
              const isCapture = legalTargets.get(sq) === true;
              const isLast =
                settings.highlightLastMove &&
                lastMove &&
                (lastMove.from === sq || lastMove.to === sq);
              const isCheck = inCheckKingSquare === sq;

              return (
                <button
                  key={sq}
                  type="button"
                  onClick={() => handleSquareClick(sq)}
                  onDragOver={(e) => {
                    if (interactive) e.preventDefault();
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (!interactive || !dragFrom) return;
                    const turn = chess.turn();
                    if (allowedColor !== 'both' && turn !== allowedColor) return;
                    attemptMove(dragFrom, sq);
                    setDragFrom(null);
                  }}
                  aria-label={`Square ${sq}${piece ? ` ${piece.color === 'w' ? 'white' : 'black'} ${piece.type}` : ''}`}
                  className="relative flex items-center justify-center p-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                  style={{
                    backgroundColor: isLight ? theme.light : theme.dark,
                  }}
                >
                  {(isSelected || isLast) && (
                    <span
                      className="absolute inset-0 pointer-events-none"
                      style={{ backgroundColor: theme.highlight }}
                    />
                  )}
                  {isCheck && (
                    <span
                      className="absolute inset-0 pointer-events-none"
                      style={{
                        background:
                          'radial-gradient(circle, rgba(220,38,38,0.78) 0%, rgba(220,38,38,0) 75%)',
                      }}
                    />
                  )}

                  {settings.showCoordinates && fIdx === 0 && (
                    <span
                      className="absolute top-0.5 left-1 text-[9px] font-mono-tabular font-semibold leading-none pointer-events-none"
                      style={{ color: isLight ? theme.coordLight : theme.coordDark }}
                    >
                      {rank}
                    </span>
                  )}
                  {settings.showCoordinates && rIdx === 7 && (
                    <span
                      className="absolute bottom-0.5 right-1 text-[9px] font-mono-tabular font-semibold leading-none pointer-events-none"
                      style={{ color: isLight ? theme.coordLight : theme.coordDark }}
                    >
                      {file}
                    </span>
                  )}

                  {piece && (
                    <div
                      draggable={interactive && (allowedColor === 'both' || piece.color === allowedColor)}
                      onDragStart={() => {
                        setDragFrom(sq);
                        setSelectedSquare(sq);
                      }}
                      className={`w-[86%] h-[86%] z-10 ${
                        settings.pieceAnimations ? 'transition-transform duration-150' : ''
                      } ${isSelected ? 'scale-110' : ''}`}
                    >
                      <ChessPieceSvg type={piece.type} color={piece.color} styleId={settings.pieceStyle} />
                    </div>
                  )}

                  {settings.showLegalMoves && isLegalTarget && !isCapture && (
                    <span className="w-3 h-3 rounded-full bg-slate-900/25 dark:bg-black/30 z-20 pointer-events-none" />
                  )}
                  {settings.showLegalMoves && isLegalTarget && isCapture && (
                    <span className="absolute inset-1 rounded-full border-[3px] border-slate-900/30 dark:border-black/35 z-20 pointer-events-none" />
                  )}
                </button>
              );
            })
          )}
        </div>

        {/* Best Move Arrow Overlay */}
        {bestMoveArrow && (
          <svg
            viewBox="0 0 100 100"
            className="absolute inset-0 w-full h-full pointer-events-none z-20"
          >
            <defs>
              <marker id="best-arrow" markerWidth="4" markerHeight="4" refX="2.5" refY="2" orient="auto">
                <path d="M0,0 L4,2 L0,4 Z" fill="rgba(16, 185, 129, 0.85)" />
              </marker>
            </defs>
            {(() => {
              const p1 = squareCenter(bestMoveArrow.from);
              const p2 = squareCenter(bestMoveArrow.to);
              return (
                <line
                  x1={p1.x}
                  y1={p1.y}
                  x2={p2.x}
                  y2={p2.y}
                  stroke="rgba(16, 185, 129, 0.85)"
                  strokeWidth="2.1"
                  strokeLinecap="round"
                  markerEnd="url(#best-arrow)"
                />
              );
            })()}
          </svg>
        )}

        {/* Promotion Modal */}
        {pendingPromotion && (
          <div className="absolute inset-0 z-30 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-4 shadow-xl">
              <p className="text-xs font-semibold text-slate-600 dark:text-slate-300 mb-3 text-center">
                Choose Promotion Piece
              </p>
              <div className="grid grid-cols-4 gap-2">
                {(['q', 'r', 'b', 'n'] as const).map((promo) => (
                  <button
                    key={promo}
                    type="button"
                    onClick={() => {
                      onMove(pendingPromotion.from, pendingPromotion.to, promo);
                      setPendingPromotion(null);
                    }}
                    className="w-12 h-12 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-emerald-500/20 flex items-center justify-center border border-slate-200 dark:border-slate-700"
                  >
                    <ChessPieceSvg
                      type={promo}
                      color={pendingPromotion.color}
                      styleId={settings.pieceStyle}
                      className="w-9 h-9"
                    />
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Move Confirmation Bar */}
        {pendingConfirm && (
          <div className="absolute bottom-3 left-3 right-3 z-30 bg-white/95 dark:bg-slate-900/95 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 shadow-lg flex items-center justify-between gap-3">
            <span className="text-xs font-medium text-slate-700 dark:text-slate-200">
              Confirm move {pendingConfirm.from} → {pendingConfirm.to}?
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPendingConfirm(null)}
                className="px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  onMove(pendingConfirm.from, pendingConfirm.to, pendingConfirm.promotion);
                  setPendingConfirm(null);
                }}
                className="px-3 py-1.5 text-xs font-medium rounded-lg bg-emerald-600 text-white"
              >
                Confirm
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
