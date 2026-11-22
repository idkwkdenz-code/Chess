import type { Server as HttpServer } from 'http';
import crypto from 'crypto';
import { WebSocket, WebSocketServer } from 'ws';
import { Chess } from 'chess.js';
import { verifyAuthToken } from './auth.js';
import { store, StoredOnlineGame, StoredUser } from './store.js';
import type { TimeControl } from '../src/types/chess.js';

interface ClientSocket extends WebSocket {
  userId?: string;
  username?: string;
  watchingGameId?: string;
}

interface QueueEntry {
  userId: string;
  username: string;
  rating: number;
  timeControl: TimeControl;
  socket: ClientSocket;
  joinedAt: number;
}

const matchmakingQueue: QueueEntry[] = [];
const activeClients = new Set<ClientSocket>();

function sendJson(ws: WebSocket, type: string, payload: unknown) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type, payload }));
  }
}

function getGameViewers(gameId: string): ClientSocket[] {
  const viewers: ClientSocket[] = [];
  for (const client of activeClients) {
    if (client.readyState === WebSocket.OPEN && client.watchingGameId === gameId) {
      viewers.push(client);
    }
  }
  return viewers;
}

function broadcastGameState(game: StoredOnlineGame) {
  const viewers = getGameViewers(game.id);
  const spectatorCount = viewers.filter(
    (c) => c.userId !== game.whiteId && c.userId !== game.blackId
  ).length;
  game.spectatorCount = spectatorCount;
  for (const client of viewers) {
    sendJson(client, 'game:state', game);
  }
}

function broadcastLobbyUpdate() {
  const publicGames = store
    .getDb()
    .games.filter((g) => g.visibility === 'public' && (g.status === 'waiting' || g.status === 'active'))
    .slice(0, 20);
  for (const client of activeClients) {
    sendJson(client, 'lobby:update', {
      onlineCount: store.getOnlineCount(),
      games: publicGames,
      queueSize: matchmakingQueue.length,
    });
  }
}

function formatUserTitle(user: StoredUser): string | null {
  if (user.role === 'OWNER') return 'OWNER';
  if (user.fideVerified && user.officialFideTitle) return user.officialFideTitle;
  if (user.customTitle) return user.customTitle;
  return null;
}

function finishOnlineGame(
  game: StoredOnlineGame,
  result: '1-0' | '0-1' | '1/2-1/2' | '*',
  termination: string,
  status: 'completed' | 'aborted' | 'cancelled' = 'completed'
) {
  game.status = status;
  game.result = result;
  game.termination = termination;
  game.drawOfferFrom = null;

  if (status === 'completed' && result !== '*' && game.rated && game.movesSan.length >= 2) {
    store.applyEloMatchResult(
      game.whiteId,
      game.blackId,
      game.timeControl.category,
      result,
      termination
    );
  } else {
    store.save();
  }
  broadcastGameState(game);
  broadcastLobbyUpdate();
}

export function attachWebSocketServer(server: HttpServer) {
  const wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws: ClientSocket) => {
    activeClients.add(ws);

    sendJson(ws, 'lobby:update', {
      onlineCount: store.getOnlineCount(),
      games: store
        .getDb()
        .games.filter((g) => g.visibility === 'public' && (g.status === 'waiting' || g.status === 'active'))
        .slice(0, 20),
      queueSize: matchmakingQueue.length,
    });

    ws.on('message', (raw) => {
      let msg: { type: string; payload?: Record<string, unknown> };
      try {
        msg = JSON.parse(raw.toString());
      } catch {
        return;
      }

      const payload = msg.payload || {};

      if (msg.type === 'auth') {
        const token = typeof payload.token === 'string' ? payload.token : '';
        const user = token ? verifyAuthToken(token) : null;
        if (user) {
          ws.userId = user.id;
          ws.username = user.username;
          store.setOnline(user.id, true);
          sendJson(ws, 'auth:ok', { userId: user.id, username: user.username });
          broadcastLobbyUpdate();
        }
        return;
      }

      if (msg.type === 'game:watch') {
        const gameId = typeof payload.gameId === 'string' ? payload.gameId : '';
        const game = store.getDb().games.find((g) => g.id === gameId);
        if (game) {
          ws.watchingGameId = game.id;
          sendJson(ws, 'game:state', game);
          broadcastGameState(game);
        }
        return;
      }

      // Require authenticated user for mutations
      if (!ws.userId) {
        sendJson(ws, 'error', { message: 'Sign in required for online play actions.' });
        return;
      }
      const user = store.findUserById(ws.userId);
      if (!user || user.status !== 'ACTIVE') {
        sendJson(ws, 'error', { message: 'Account is not active.' });
        return;
      }

      if (msg.type === 'queue:join') {
        if (!store.getDb().appConfig.features.onlineEnabled) {
          sendJson(ws, 'error', { message: 'Online matchmaking is temporarily disabled by the Owner.' });
          return;
        }
        const tc = payload.timeControl as TimeControl;
        if (!tc || !tc.id || !tc.initialSeconds) return;

        // Remove existing queue entry for this user
        const existingIdx = matchmakingQueue.findIndex((q) => q.userId === user.id);
        if (existingIdx !== -1) matchmakingQueue.splice(existingIdx, 1);

        const userRating = user.ratings[tc.category] || 400;
        const matchIdx = matchmakingQueue.findIndex(
          (q) => q.timeControl.id === tc.id && q.userId !== user.id
        );

        if (matchIdx !== -1) {
          const opponentEntry = matchmakingQueue.splice(matchIdx, 1)[0];
          const opponent = store.findUserById(opponentEntry.userId);
          if (opponent) {
            const whiteFirst = Math.random() < 0.5;
            const white = whiteFirst ? user : opponent;
            const black = whiteFirst ? opponent : user;
            const initialMs = tc.initialSeconds * 1000;
            const game: StoredOnlineGame = {
              id: `gm-${crypto.randomUUID().slice(0, 10)}`,
              whiteId: white.id,
              blackId: black.id,
              whiteName: white.username,
              blackName: black.username,
              whiteTitle: formatUserTitle(white),
              blackTitle: formatUserTitle(black),
              whiteRole: white.role,
              blackRole: black.role,
              whiteRating: white.ratings[tc.category],
              blackRating: black.ratings[tc.category],
              timeControl: tc,
              visibility: 'public',
              rated: true,
              fen: new Chess().fen(),
              pgn: '',
              movesSan: [],
              lastMove: null,
              whiteTimeMs: initialMs,
              blackTimeMs: initialMs,
              turn: 'w',
              lastTickAt: Date.now(),
              status: 'active',
              result: '*',
              termination: '',
              chat: [],
              spectatorCount: 0,
              createdAt: Date.now(),
              reports: [],
            };
            store.getDb().games.unshift(game);
            store.save();
            ws.watchingGameId = game.id;
            opponentEntry.socket.watchingGameId = game.id;
            sendJson(ws, 'game:matched', game);
            sendJson(opponentEntry.socket, 'game:matched', game);
            broadcastLobbyUpdate();
            return;
          }
        }

        matchmakingQueue.push({
          userId: user.id,
          username: user.username,
          rating: userRating,
          timeControl: tc,
          socket: ws,
          joinedAt: Date.now(),
        });
        sendJson(ws, 'queue:waiting', { timeControl: tc });
        broadcastLobbyUpdate();
        return;
      }

      if (msg.type === 'queue:leave') {
        const idx = matchmakingQueue.findIndex((q) => q.userId === user.id);
        if (idx !== -1) matchmakingQueue.splice(idx, 1);
        sendJson(ws, 'queue:left', {});
        broadcastLobbyUpdate();
        return;
      }

      if (msg.type === 'game:create') {
        const tc = payload.timeControl as TimeControl;
        const visibility = payload.visibility === 'private' ? 'private' : 'public';
        const rated = payload.rated !== false;
        const inviteTarget = typeof payload.targetUsername === 'string' ? payload.targetUsername.trim() : '';
        if (!tc || !tc.initialSeconds) return;

        const inviteCode = Math.random().toString(36).slice(2, 8).toUpperCase();
        const initialMs = tc.initialSeconds * 1000;
        const game: StoredOnlineGame = {
          id: `gm-${crypto.randomUUID().slice(0, 10)}`,
          whiteId: user.id,
          blackId: '',
          whiteName: user.username,
          blackName: 'Waiting for opponent...',
          whiteTitle: formatUserTitle(user),
          blackTitle: null,
          whiteRole: user.role,
          blackRole: 'PLAYER',
          whiteRating: user.ratings[tc.category],
          blackRating: 400,
          timeControl: tc,
          visibility,
          inviteCode,
          rated,
          fen: new Chess().fen(),
          pgn: '',
          movesSan: [],
          lastMove: null,
          whiteTimeMs: initialMs,
          blackTimeMs: initialMs,
          turn: 'w',
          lastTickAt: Date.now(),
          status: 'waiting',
          result: '*',
          termination: '',
          chat: [],
          spectatorCount: 0,
          createdAt: Date.now(),
          reports: [],
        };
        store.getDb().games.unshift(game);
        store.save();
        ws.watchingGameId = game.id;
        sendJson(ws, 'game:created', game);
        broadcastLobbyUpdate();

        if (inviteTarget) {
          const targetUser = store.findUserByUsername(inviteTarget);
          if (targetUser) {
            for (const client of activeClients) {
              if (client.userId === targetUser.id) {
                sendJson(client, 'challenge:received', {
                  gameId: game.id,
                  inviteCode,
                  fromUsername: user.username,
                  timeControl: tc,
                });
              }
            }
          }
        }
        return;
      }

      if (msg.type === 'game:join') {
        const gameId = typeof payload.gameId === 'string' ? payload.gameId : '';
        const inviteCode = typeof payload.inviteCode === 'string' ? payload.inviteCode.trim().toUpperCase() : '';
        const game = store
          .getDb()
          .games.find((g) => (gameId && g.id === gameId) || (inviteCode && g.inviteCode === inviteCode));
        if (!game) {
          sendJson(ws, 'error', { message: 'Game room not found.' });
          return;
        }
        if (game.status === 'waiting' && game.whiteId !== user.id && !game.blackId) {
          game.blackId = user.id;
          game.blackName = user.username;
          game.blackTitle = formatUserTitle(user);
          game.blackRole = user.role;
          game.blackRating = user.ratings[game.timeControl.category];
          game.status = 'active';
          game.lastTickAt = Date.now();
          store.save();
          ws.watchingGameId = game.id;
          broadcastGameState(game);
          broadcastLobbyUpdate();
          return;
        }
        ws.watchingGameId = game.id;
        sendJson(ws, 'game:state', game);
        broadcastGameState(game);
        return;
      }

      if (msg.type === 'game:move') {
        const gameId = typeof payload.gameId === 'string' ? payload.gameId : '';
        const from = typeof payload.from === 'string' ? payload.from : '';
        const to = typeof payload.to === 'string' ? payload.to : '';
        const promotion = typeof payload.promotion === 'string' ? payload.promotion : 'q';

        const game = store.getDb().games.find((g) => g.id === gameId);
        if (!game || game.status !== 'active') return;

        const isWhite = game.whiteId === user.id;
        const isBlack = game.blackId === user.id;
        if ((game.turn === 'w' && !isWhite) || (game.turn === 'b' && !isBlack)) {
          sendJson(ws, 'error', { message: 'Not your turn.' });
          return;
        }

        const now = Date.now();
        const elapsed = game.movesSan.length > 0 ? Math.max(0, now - game.lastTickAt) : 0;
        if (game.turn === 'w') {
          game.whiteTimeMs = Math.max(0, game.whiteTimeMs - elapsed);
          if (game.whiteTimeMs <= 0) {
            finishOnlineGame(game, '0-1', 'Timeout — Black wins on time');
            return;
          }
        } else {
          game.blackTimeMs = Math.max(0, game.blackTimeMs - elapsed);
          if (game.blackTimeMs <= 0) {
            finishOnlineGame(game, '1-0', 'Timeout — White wins on time');
            return;
          }
        }

        const chess = new Chess(game.fen);
        let moveRes;
        try {
          moveRes = chess.move({ from, to, promotion });
        } catch {
          moveRes = null;
        }
        if (!moveRes) {
          sendJson(ws, 'game:state', game);
          return;
        }

        // Add increment after move
        if (game.turn === 'w') {
          game.whiteTimeMs += game.timeControl.incrementSeconds * 1000;
        } else {
          game.blackTimeMs += game.timeControl.incrementSeconds * 1000;
        }

        game.fen = chess.fen();
        game.movesSan.push(moveRes.san);
        game.pgn = chess.pgn();
        game.lastMove = { from: moveRes.from, to: moveRes.to };
        game.turn = chess.turn();
        game.lastTickAt = now;
        game.drawOfferFrom = null;

        if (chess.isCheckmate()) {
          const winnerResult = moveRes.color === 'w' ? '1-0' : '0-1';
          finishOnlineGame(game, winnerResult, `Checkmate by ${moveRes.color === 'w' ? game.whiteName : game.blackName}`);
          return;
        }
        if (chess.isStalemate()) {
          finishOnlineGame(game, '1/2-1/2', 'Draw by stalemate');
          return;
        }
        if (chess.isThreefoldRepetition()) {
          finishOnlineGame(game, '1/2-1/2', 'Draw by threefold repetition');
          return;
        }
        if (chess.isInsufficientMaterial()) {
          finishOnlineGame(game, '1/2-1/2', 'Draw by insufficient material');
          return;
        }
        if (chess.isDraw()) {
          finishOnlineGame(game, '1/2-1/2', 'Draw by 50-move rule');
          return;
        }

        store.save();
        broadcastGameState(game);
        return;
      }

      if (msg.type === 'game:resign') {
        const game = store.getDb().games.find((g) => g.id === payload.gameId);
        if (!game || game.status !== 'active') return;
        if (game.whiteId !== user.id && game.blackId !== user.id) return;
        if (game.movesSan.length < 2) {
          finishOnlineGame(game, '*', 'Game aborted before move 2', 'aborted');
          return;
        }
        const res = game.whiteId === user.id ? '0-1' : '1-0';
        finishOnlineGame(game, res, `${user.username} resigned`);
        return;
      }

      if (msg.type === 'game:draw_offer') {
        const game = store.getDb().games.find((g) => g.id === payload.gameId);
        if (!game || game.status !== 'active') return;
        if (game.whiteId !== user.id && game.blackId !== user.id) return;
        game.drawOfferFrom = user.id;
        store.save();
        broadcastGameState(game);
        return;
      }

      if (msg.type === 'game:draw_accept') {
        const game = store.getDb().games.find((g) => g.id === payload.gameId);
        if (!game || game.status !== 'active') return;
        if (!game.drawOfferFrom || game.drawOfferFrom === user.id) return;
        if (game.whiteId !== user.id && game.blackId !== user.id) return;
        finishOnlineGame(game, '1/2-1/2', 'Draw by mutual agreement');
        return;
      }

      if (msg.type === 'game:chat') {
        const game = store.getDb().games.find((g) => g.id === payload.gameId);
        const text = typeof payload.text === 'string' ? payload.text.trim().slice(0, 240) : '';
        if (!game || !text) return;
        game.chat.push({
          id: crypto.randomUUID(),
          sender: user.username,
          role: user.role,
          text,
          at: Date.now(),
        });
        if (game.chat.length > 80) game.chat = game.chat.slice(-80);
        store.save();
        broadcastGameState(game);
        return;
      }

      if (msg.type === 'game:rematch') {
        const oldGame = store.getDb().games.find((g) => g.id === payload.gameId);
        if (!oldGame || oldGame.status !== 'completed') return;
        if (oldGame.whiteId !== user.id && oldGame.blackId !== user.id) return;
        if (oldGame.rematchFrom && oldGame.rematchFrom !== user.id) {
          const whiteUser = store.findUserById(oldGame.blackId);
          const blackUser = store.findUserById(oldGame.whiteId);
          if (!whiteUser || !blackUser) return;
          const initialMs = oldGame.timeControl.initialSeconds * 1000;
          const newGame: StoredOnlineGame = {
            id: `gm-${crypto.randomUUID().slice(0, 10)}`,
            whiteId: whiteUser.id,
            blackId: blackUser.id,
            whiteName: whiteUser.username,
            blackName: blackUser.username,
            whiteTitle: formatUserTitle(whiteUser),
            blackTitle: formatUserTitle(blackUser),
            whiteRole: whiteUser.role,
            blackRole: blackUser.role,
            whiteRating: whiteUser.ratings[oldGame.timeControl.category],
            blackRating: blackUser.ratings[oldGame.timeControl.category],
            timeControl: oldGame.timeControl,
            visibility: oldGame.visibility,
            rated: oldGame.rated,
            fen: new Chess().fen(),
            pgn: '',
            movesSan: [],
            lastMove: null,
            whiteTimeMs: initialMs,
            blackTimeMs: initialMs,
            turn: 'w',
            lastTickAt: Date.now(),
            status: 'active',
            result: '*',
            termination: '',
            chat: [],
            spectatorCount: 0,
            createdAt: Date.now(),
            reports: [],
          };
          store.getDb().games.unshift(newGame);
          oldGame.rematchFrom = null;
          store.save();
          for (const c of getGameViewers(oldGame.id)) {
            c.watchingGameId = newGame.id;
            sendJson(c, 'game:matched', newGame);
          }
          broadcastLobbyUpdate();
        } else {
          oldGame.rematchFrom = user.id;
          store.save();
          broadcastGameState(oldGame);
        }
      }
    });

    ws.on('close', () => {
      activeClients.delete(ws);
      if (ws.userId) {
        const idx = matchmakingQueue.findIndex((q) => q.userId === ws.userId);
        if (idx !== -1) matchmakingQueue.splice(idx, 1);

        const stillConnected = Array.from(activeClients).some((c) => c.userId === ws.userId);
        if (!stillConnected) {
          store.setOnline(ws.userId, false);
          broadcastLobbyUpdate();
        }
      }
    });
  });

  // Server-authoritative timeout checker
  setInterval(() => {
    const now = Date.now();
    for (const game of store.getDb().games) {
      if (game.status !== 'active' || game.movesSan.length === 0) continue;
      const elapsed = now - game.lastTickAt;
      if (game.turn === 'w' && game.whiteTimeMs - elapsed <= 0) {
        game.whiteTimeMs = 0;
        finishOnlineGame(game, '0-1', 'Timeout — Black wins on time');
      } else if (game.turn === 'b' && game.blackTimeMs - elapsed <= 0) {
        game.blackTimeMs = 0;
        finishOnlineGame(game, '1-0', 'Timeout — White wins on time');
      }
    }
  }, 500);
}
