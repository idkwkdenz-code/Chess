import { OpeningEntry } from '../types/chess';

export const OPENINGS_DB: OpeningEntry[] = [
  {
    id: 'ruy-lopez',
    eco: 'C60',
    name: 'Ruy Lopez (Spanish Opening)',
    moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bb5'],
    fen: 'r1bqkbnr/pppp1ppp/2n5/1B2p3/4P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 3 3',
    whiteWinPct: 39,
    drawPct: 34,
    blackWinPct: 27,
    summary:
      'One of the oldest and deepest classical openings in chess. White pressures Black’s e5 defender while preparing rapid kingside castling and central expansion with c3 and d4.',
    keyIdeas: [
      'Maintain tension on e5 rather than prematurely capturing on c6.',
      'Build a strong pawn center with c3 and d4.',
      'Maneuver the b1-knight via d2-f1-g3 toward the kingside.',
    ],
    variations: [
      {
        name: 'Morphy Defense',
        moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bb5', 'a6', 'Ba4', 'Nf6', 'O-O'],
        note: 'Mainline battle testing White’s bishop retreat and central control.',
      },
      {
        name: 'Berlin Defense',
        moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bb5', 'Nf6', 'O-O', 'Nxe4'],
        note: 'Ultra-solid Grandmaster choice leading to complex queenless endgames.',
      },
    ],
  },
  {
    id: 'italian-game',
    eco: 'C50',
    name: 'Italian Game',
    moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4'],
    fen: 'r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 3 3',
    whiteWinPct: 38,
    drawPct: 32,
    blackWinPct: 30,
    summary:
      'Direct development targeting the sensitive f7 square while keeping flexible options between quiet Giuoco Piano maneuvering and sharp Evans Gambit attacks.',
    keyIdeas: [
      'Control d5 and pressure f7 along the a2-g8 diagonal.',
      'Support d4 with c3 in classical Giuoco Piano structures.',
      'Watch out for central ...d5 counterstrikes.',
    ],
    variations: [
      {
        name: 'Giuoco Piano',
        moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5', 'c3', 'Nf6', 'd3'],
        note: 'Slow strategic buildup favored by modern World Champions.',
      },
      {
        name: 'Two Knights Defense',
        moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Nf6', 'Ng5', 'd5'],
        note: 'Sharp tactical struggle where Black sacrifices a pawn for initiative.',
      },
    ],
  },
  {
    id: 'sicilian-najdorf',
    eco: 'B90',
    name: 'Sicilian Defense: Najdorf',
    moves: ['e4', 'c5', 'Nf3', 'd6', 'd4', 'cxd4', 'Nxd4', 'Nf6', 'Nc3', 'a6'],
    fen: 'rnbqkb1r/1p2pppp/p2p1n2/8/3NP3/2N5/PPP2PPP/R1BQKB1R w KQkq - 0 6',
    whiteWinPct: 36,
    drawPct: 31,
    blackWinPct: 33,
    summary:
      'The flagship asymmetric battleground of chess legends. Black prevents pieces from landing on b5 and prepares dynamic queenside counterplay with ...b5 and ...e5 or ...e6.',
    keyIdeas: [
      'Use the semi-open c-file and ...b5 expansion for queenside counterplay.',
      'White often attacks on the kingside with Bg5, Be3, f3, and g4.',
      'Timing the central ...d5 break often equalizes immediately.',
    ],
    variations: [
      {
        name: 'English Attack',
        moves: ['e4', 'c5', 'Nf3', 'd6', 'd4', 'cxd4', 'Nxd4', 'Nf6', 'Nc3', 'a6', 'Be3', 'e5'],
        note: 'White prepares f3, Qd2, and O-O-O for opposite-side castling fireworks.',
      },
      {
        name: '6.Bg5 Mainline',
        moves: ['e4', 'c5', 'Nf3', 'd6', 'd4', 'cxd4', 'Nxd4', 'Nf6', 'Nc3', 'a6', 'Bg5', 'e6'],
        note: 'Razor-sharp theoretical duel with concrete tactical calculations.',
      },
    ],
  },
  {
    id: 'french-defense',
    eco: 'C00',
    name: 'French Defense',
    moves: ['e4', 'e6', 'd4', 'd5'],
    fen: 'rnbqkbnr/ppp2ppp/4p3/3p4/3PP3/8/PPP2PPP/RNBQKBNR w KQkq - 0 3',
    whiteWinPct: 37,
    drawPct: 33,
    blackWinPct: 30,
    summary:
      'A resilient counterattacking defense that challenges White’s e4 pawn right away, leading to locked pawn chains and strategic battles around the d4 and e5 squares.',
    keyIdeas: [
      'Attack the base of White’s pawn chain with ...c5 and ...f6.',
      'Find active roles for the light-squared bishop on c8.',
      'White seeks kingside space and attacks against Black’s castled king.',
    ],
    variations: [
      {
        name: 'Advance Variation',
        moves: ['e4', 'e6', 'd4', 'd5', 'e5', 'c5', 'c3', 'Nc6', 'Nf3'],
        note: 'White gains space while Black immediately undermines d4.',
      },
      {
        name: 'Winawer Variation',
        moves: ['e4', 'e6', 'd4', 'd5', 'Nc3', 'Bb4', 'e5', 'c5'],
        note: 'Imbalanced fighting line trading dark-squared control for doubled pawns.',
      },
    ],
  },
  {
    id: 'caro-kann',
    eco: 'B12',
    name: 'Caro-Kann Defense',
    moves: ['e4', 'c6', 'd4', 'd5'],
    fen: 'rnbqkbnr/pp2pppp/2p5/3p4/3PP3/8/PPP2PPP/RNBQKBNR w KQkq - 0 3',
    whiteWinPct: 36,
    drawPct: 36,
    blackWinPct: 28,
    summary:
      'Solid, structurally sound defense supporting ...d5 without blocking the c8-bishop, prized by Karpov and modern elite players for rock-solid endgames.',
    keyIdeas: [
      'Develop the light-squared bishop to f5 or g4 before playing ...e6.',
      'Maintain a healthy pawn structure for endgame superiority.',
      'Use ...c5 to challenge White’s central d4 stronghold.',
    ],
    variations: [
      {
        name: 'Advance Variation',
        moves: ['e4', 'c6', 'd4', 'd5', 'e5', 'Bf5', 'Nf3', 'e6'],
        note: 'Black develops the bishop outside the pawn chain before locking the center.',
      },
      {
        name: 'Classical Variation',
        moves: ['e4', 'c6', 'd4', 'd5', 'Nc3', 'dxe4', 'Nxe4', 'Bf5'],
        note: 'Clean piece play where Black targets minor-piece exchanges.',
      },
    ],
  },
  {
    id: 'queens-gambit',
    eco: 'D06',
    name: "Queen's Gambit",
    moves: ['d4', 'd5', 'c4'],
    fen: 'rnbqkbnr/ppp1pppp/8/3p4/2PP4/8/PP2PPPP/RNBQKBNR b KQkq - 0 2',
    whiteWinPct: 40,
    drawPct: 35,
    blackWinPct: 25,
    summary:
      'The cornerstone of 1.d4 play. White offers a flank pawn to deflect Black’s central d5 pawn, aiming for central dominance and pressure along the c-file.',
    keyIdeas: [
      'Pressure d5 and fight for the central e4 square.',
      'Develop queenside pieces harmoniously before pushing e4.',
      'In QGD structures, White often executes a queenside minority attack.',
    ],
    variations: [
      {
        name: "Queen's Gambit Declined",
        moves: ['d4', 'd5', 'c4', 'e6', 'Nc3', 'Nf6', 'Bg5', 'Be7'],
        note: 'Classical bedrock holding the d5 stronghold.',
      },
      {
        name: 'Slav Defense',
        moves: ['d4', 'd5', 'c4', 'c6', 'Nf3', 'Nf6', 'Nc3', 'dxc4'],
        note: 'Reinforces d5 with c6 while keeping the c8-bishop open.',
      },
    ],
  },
  {
    id: 'kings-indian',
    eco: 'E60',
    name: "King's Indian Defense",
    moves: ['d4', 'Nf6', 'c4', 'g6', 'Nc3', 'Bg7'],
    fen: 'rnbqk2r/ppppppbp/5np1/8/2PP4/2N5/PP2PPPP/R1BQKBNR w KQkq - 2 4',
    whiteWinPct: 38,
    drawPct: 28,
    blackWinPct: 34,
    summary:
      'A hypermodern counterattacking weapon championed by Fischer and Kasparov. Black concedes central space early in order to strike back with ...e5 and launch a fierce kingside pawn storm.',
    keyIdeas: [
      'Fianchetto the dark-squared bishop on g7 to slice across the long diagonal.',
      'Break in the center with ...e5 or ...c5.',
      'When the center closes with d5, attack on the kingside with ...f5, ...g5, ...f4.',
    ],
    variations: [
      {
        name: 'Classical Mar del Plata',
        moves: ['d4', 'Nf6', 'c4', 'g6', 'Nc3', 'Bg7', 'e4', 'd6', 'Nf3', 'O-O', 'Be2', 'e5'],
        note: 'Opposite-wing pawn storms in one of chess’s richest races.',
      },
      {
        name: 'Sämisch Variation',
        moves: ['d4', 'Nf6', 'c4', 'g6', 'Nc3', 'Bg7', 'e4', 'd6', 'f3'],
        note: 'White fortifies e4 and prepares Be3 and Qd2 for kingside expansion.',
      },
    ],
  },
  {
    id: 'nimzo-indian',
    eco: 'E20',
    name: 'Nimzo-Indian Defense',
    moves: ['d4', 'Nf6', 'c4', 'e6', 'Nc3', 'Bb4'],
    fen: 'rnbqk2r/pppp1ppp/4pn2/8/1bPP4/2N5/PP2PPPP/R1BQKBNR w KQkq - 2 4',
    whiteWinPct: 35,
    drawPct: 37,
    blackWinPct: 28,
    summary:
      'Nimzowitsch’s masterpiece of indirect central control. By pinning the c3-knight, Black fights for e4 and invites structural imbalances.',
    keyIdeas: [
      'Control the dark squares e4 and c4 rather than occupying the center with pawns.',
      'Be ready to double White’s c-pawns and blockade c4.',
      'Counterplay with ...d5 or ...c5 depending on White’s setup.',
    ],
    variations: [
      {
        name: 'Rubinstein System',
        moves: ['d4', 'Nf6', 'c4', 'e6', 'Nc3', 'Bb4', 'e3', 'O-O', 'Bd3', 'd5'],
        note: 'Solid classical development contesting central squares.',
      },
      {
        name: 'Sämisch Variation',
        moves: ['d4', 'Nf6', 'c4', 'e6', 'Nc3', 'Bb4', 'a3', 'Bxc3+', 'bxc3'],
        note: 'White accepts doubled c-pawns in exchange for the bishop pair and strong center.',
      },
    ],
  },
  {
    id: 'london-system',
    eco: 'D02',
    name: 'London System',
    moves: ['d4', 'd5', 'Nf3', 'Nf6', 'Bf4'],
    fen: 'rnbqkb1r/ppp1pppp/5n2/3p4/3P1B2/5N2/PPP1PPPP/RN1QKB1R b KQkq - 3 3',
    whiteWinPct: 38,
    drawPct: 34,
    blackWinPct: 28,
    summary:
      'A reliable, low-theory system establishing a sturdy pyramid of d4, e3, and c3 with the dark-squared bishop actively placed on f4 outside the pawn chain.',
    keyIdeas: [
      'Anchor a knight on e5 supported by d4 and f4.',
      'Preserve the f4-bishop by dropping back to g3 if challenged by ...Bd6.',
      'Launch kingside attacks once development is complete.',
    ],
    variations: [
      {
        name: 'Classical Pyramid',
        moves: ['d4', 'd5', 'Nf3', 'Nf6', 'Bf4', 'e6', 'e3', 'c5', 'c3'],
        note: 'Rock-solid triangle protecting d4 against central challenges.',
      },
      {
        name: 'Jobava London',
        moves: ['d4', 'd5', 'Nc3', 'Nf6', 'Bf4', 'e6', 'Nb5'],
        note: 'Aggressive tactical twist targeting c7 early.',
      },
    ],
  },
  {
    id: 'english-opening',
    eco: 'A10',
    name: 'English Opening',
    moves: ['c4'],
    fen: 'rnbqkbnr/pppppppp/8/8/2P5/8/PP1PPPPP/RNBQKBNR b KQkq - 0 1',
    whiteWinPct: 39,
    drawPct: 34,
    blackWinPct: 27,
    summary:
      'A flexible flank opening controlling d5 from the side. Often transposes into reversed Sicilian positions, Catalan structures, or symmetrical battles.',
    keyIdeas: [
      'Fianchetto the light-squared bishop on g2 to dominate the h1-a8 diagonal.',
      'Expand on the queenside with a3 and b4.',
      'Keep central pawn moves d3 or d4 flexible.',
    ],
    variations: [
      {
        name: 'Reversed Sicilian',
        moves: ['c4', 'e5', 'Nc3', 'Nf6', 'g3', 'd5', 'cxd5', 'Nxd5'],
        note: 'White plays a Sicilian structure with an extra tempo.',
      },
      {
        name: 'Symmetrical English',
        moves: ['c4', 'c5', 'Nc3', 'Nc6', 'g3', 'g6', 'Bg2', 'Bg7'],
        note: 'Rich positional maneuvering around central breaks.',
      },
    ],
  },
  {
    id: 'catalan-opening',
    eco: 'E01',
    name: 'Catalan Opening',
    moves: ['d4', 'Nf6', 'c4', 'e6', 'g3', 'd5', 'Bg2'],
    fen: 'rnbqkb1r/ppp2ppp/4pn2/3p4/2PP4/6P1/PP2PPBP/RNBQK1NR b KQkq - 1 4',
    whiteWinPct: 41,
    drawPct: 36,
    blackWinPct: 23,
    summary:
      'Combining Queen’s Gambit central pressure with a kingside fianchetto. The g2-bishop exerts long-term positional pressure across Black’s queenside.',
    keyIdeas: [
      'Use the g2-bishop to target d5, b7, and the a8-rook.',
      'Sacrifice the c4-pawn temporarily for open lines and initiative.',
      'Dominate light squares in the middlegame and endgame.',
    ],
    variations: [
      {
        name: 'Open Catalan',
        moves: ['d4', 'Nf6', 'c4', 'e6', 'g3', 'd5', 'Bg2', 'dxc4', 'Nf3'],
        note: 'Black grabs the pawn and fights to neutralize the g2-bishop.',
      },
      {
        name: 'Closed Catalan',
        moves: ['d4', 'Nf6', 'c4', 'e6', 'g3', 'd5', 'Bg2', 'Be7', 'Nf3', 'O-O'],
        note: 'Tense positional maneuvering around c4 and e4.',
      },
    ],
  },
  {
    id: 'scotch-game',
    eco: 'C45',
    name: 'Scotch Game',
    moves: ['e4', 'e5', 'Nf3', 'Nc6', 'd4', 'exd4', 'Nxd4'],
    fen: 'r1bqkbnr/pppp1ppp/2n5/8/3NP3/8/PPP2PPP/RNBQKB1R b KQkq - 0 4',
    whiteWinPct: 39,
    drawPct: 31,
    blackWinPct: 30,
    summary:
      'Revived at the highest level by Garry Kasparov, the Scotch opens the center early to seize space and open lines for rapid piece play.',
    keyIdeas: [
      'Open central files immediately and avoid closed Ruy Lopez maneuvers.',
      'Create queenside pawn majorities or quick kingside attacks.',
      'Respond energetically to ...Bc5 or ...Nf6.',
    ],
    variations: [
      {
        name: 'Classical 4...Bc5',
        moves: ['e4', 'e5', 'Nf3', 'Nc6', 'd4', 'exd4', 'Nxd4', 'Bc5', 'Be3', 'Qf6'],
        note: 'Direct fight over the d4-knight and central squares.',
      },
      {
        name: 'Schmidt Variation',
        moves: ['e4', 'e5', 'Nf3', 'Nc6', 'd4', 'exd4', 'Nxd4', 'Nf6', 'Nxc6', 'bxc6'],
        note: 'Sharp asymmetric pawn structure where White seeks e5 expansion.',
      },
    ],
  },
];
