import { PuzzleItem } from '../types/chess';

export const PUZZLES_DB: PuzzleItem[] = [
  {
    id: 'pz-01',
    title: 'Back-Rank Delivery',
    theme: 'Mate in 1',
    rating: 650,
    fen: '6k1/5ppp/8/8/8/8/5PPP/3R2K1 w - - 0 1',
    solutionSan: ['Rd8#'],
    explanation:
      'Black’s king is trapped behind its own f7, g7, and h7 pawns. Rd8 delivers immediate back-rank checkmate.',
  },
  {
    id: 'pz-02',
    title: 'Queen & Bishop Battery',
    theme: 'Mate in 1',
    rating: 780,
    fen: 'r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5Q2/PPPP1PPP/RNB1K1NR w KQkq - 4 4',
    solutionSan: ['Qxf7#'],
    explanation:
      'The bishop on c4 and queen on f3 converge on the undefended f7 pawn for Scholar’s Mate.',
  },
  {
    id: 'pz-03',
    title: 'Arabian Rook & Knight Mate',
    theme: 'Mate in 1',
    rating: 920,
    fen: '7k/6R1/5N2/8/8/8/8/6K1 w - - 0 1',
    solutionSan: ['Rh7#'],
    explanation:
      'The knight on f6 guards g8 and supports h7, allowing Rh7# to deliver the classic Arabian Mate.',
  },
  {
    id: 'pz-04',
    title: 'Royal Knight Fork',
    theme: 'Fork',
    rating: 960,
    fen: '4q1k1/8/8/3N4/8/8/6PP/6K1 w - - 0 1',
    solutionSan: ['Nf6+'],
    explanation:
      'Nf6+ checks the Black king on g8 and simultaneously forks the queen on e8.',
  },
  {
    id: 'pz-05',
    title: 'Family Fork on c7',
    theme: 'Fork',
    rating: 1080,
    fen: 'r3k3/8/8/3N4/8/8/8/4K3 w - - 0 1',
    solutionSan: ['Nc7+'],
    explanation:
      'Nc7+ gives check to the king on e8 while attacking the rook on a8, winning the rook cleanly.',
  },
  {
    id: 'pz-06',
    title: 'Absolute Diagonal Pin',
    theme: 'Pin',
    rating: 1120,
    fen: '6k1/5qpp/8/8/8/1P6/4BPPP/6K1 w - - 0 1',
    solutionSan: ['Bc4'],
    explanation:
      'Protected by the b3 pawn, Bc4 pins the Black queen on f7 directly against the king on g8.',
  },
  {
    id: 'pz-07',
    title: 'Back-Rank Pin & Deflection',
    theme: 'Pin',
    rating: 1210,
    fen: '3rk3/4q3/8/8/8/8/4RPPP/6K1 w - - 0 1',
    solutionSan: ['Rxe7+'],
    explanation:
      'Black’s queen on e7 cannot leave the e-file without exposing the king, and Rxe7+ wins the queen with check.',
  },
  {
    id: 'pz-08',
    title: 'Fifth-Rank Rook Skewer',
    theme: 'Skewer',
    rating: 1160,
    fen: '8/8/8/2k3q1/8/8/8/R6K w - - 0 1',
    solutionSan: ['Ra5+'],
    explanation:
      'Ra5+ checks the king on c5 along the fifth rank and skewers the queen waiting behind it on g5.',
  },
  {
    id: 'pz-09',
    title: 'Long-Diagonal Bishop Skewer',
    theme: 'Skewer',
    rating: 1240,
    fen: '5q2/8/8/2k5/8/P7/8/4B1K1 w - - 0 1',
    solutionSan: ['Bb4+'],
    explanation:
      'Supported by the a3 pawn, Bb4+ forces the king off the a3–f8 diagonal and wins the queen on f8.',
  },
  {
    id: 'pz-10',
    title: 'Discovered Check Windfall',
    theme: 'Discovered Attack',
    rating: 1290,
    fen: '6k1/4q1pp/8/8/4B3/8/6PP/4R1K1 w - - 0 1',
    solutionSan: ['Bxh7+', 'Kxh7', 'Rxe7'],
    explanation:
      'Bxh7+ delivers discovered check while uncovering the e1-rook against Black’s queen on e7.',
  },
  {
    id: 'pz-11',
    title: 'Back-Rank Deflection',
    theme: 'Mate in 2',
    rating: 1380,
    fen: '6k1/2n2ppp/2B5/8/8/8/5PPP/3R2K1 w - - 0 1',
    solutionSan: ['Rd8+', 'Ne8', 'Rxe8#'],
    explanation:
      'Rd8+ forces the knight to interpose on e8, where White captures with checkmate supported by the c6-bishop.',
  },
  {
    id: 'pz-12',
    title: "Philidor's Legacy Smothered Mate",
    theme: 'Sacrifice',
    rating: 1520,
    fen: '5rk1/5Npp/8/8/2Q5/8/6PP/6K1 w - - 0 1',
    solutionSan: ['Nh6+', 'Kh8', 'Qg8+', 'Rxg8', 'Nf7#'],
    explanation:
      'Nh6+ delivers double check, forcing Kh8. Then Qg8+ sacrifices the queen to lure the rook onto g8, sealing the king for Nf7# smothered mate.',
  },
  {
    id: 'pz-13',
    title: 'Greek Gift Bishop Sacrifice',
    theme: 'Sacrifice',
    rating: 1490,
    fen: 'r1bq1rk1/ppp2ppp/2n2n2/3p4/3P4/2NBPN2/PPP2PPP/R2Q1RK1 w - - 0 1',
    solutionSan: ['Bxh7+', 'Kxh7', 'Ng5+'],
    explanation:
      'Bxh7+ shatters Black’s kingside shelter; after Kxh7, Ng5+ pulls the king forward or opens lines for Qh5.',
  },
  {
    id: 'pz-14',
    title: 'Pawn Promotion Breakthrough',
    theme: 'Endgame',
    rating: 1340,
    fen: '8/5P2/8/5K2/8/8/8/6k1 w - - 0 1',
    solutionSan: ['f8=Q'],
    explanation:
      'With the White king guarding f6 and g6, the f7-pawn promotes cleanly to a queen with a decisive endgame.',
  },
];
