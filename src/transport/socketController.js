
const { GameKernel, DIRECTIONS, ABILITIES } = require('../core-game');
const matchService = require('../matchmaking/matchService');
const config = require('../config/serverConfig');

module.exports = function (io) {
    io.on('connection', (socket) => {
        console.log('User connected:', socket.id);

        socket.on('start_matchmaking', () => {
            if (matchService.matchmakingQueue.includes(socket.id)) return;

            if (matchService.matchmakingQueue.length > 0) {
                const opponentId = matchService.matchmakingQueue.shift();
                const code = `RAND-${matchService.generateRoomCode().slice(0, 4)}`;

                const match = matchService.createMatch(code, opponentId, socket.id, false);
                const kernel = GameKernel.createNewGame();
                match.kernel = kernel;

                const p1Socket = io.sockets.sockets.get(opponentId);
                const p2Socket = io.sockets.sockets.get(socket.id);
                if (p1Socket) p1Socket.join(code);
                if (p2Socket) p2Socket.join(code);

                const state = kernel.getStateSnapshot();
                io.to(opponentId).emit('match_start', { role: 'p1', state });
                io.to(socket.id).emit('match_start', { role: 'p2', state });

                startTurnTimeout(io, code);
            } else {
                matchService.matchmakingQueue.push(socket.id);
                socket.emit('matchmaking_queued');
            }
        });

        socket.on('cancel_matchmaking', () => {
            matchService.removeUser(socket.id);
        });

        socket.on('create_room', () => {
            const code = matchService.generateRoomCode();
            const match = matchService.createMatch(code, socket.id, null, true);
            match.kernel = GameKernel.createNewGame();
            socket.join(code);
            socket.emit('room_created', { code });
        });

        socket.on('join_room', (data) => {
            const code = data.code ? data.code.toUpperCase() : null;
            const match = matchService.getMatch(code);

            if (!match) return socket.emit('join_failed', { message: 'ROOM NOT FOUND' });
            if (match.p2) return socket.emit('join_failed', { message: 'ROOM IS FULL' });

            match.p2 = socket.id;
            matchService.users[socket.id] = code;
            socket.join(code);

            const state = match.kernel.getStateSnapshot();
            io.to(match.p1).emit('match_start', { role: 'p1', state });
            io.to(match.p2).emit('match_start', { role: 'p2', state });

            startTurnTimeout(io, code);
        });

        socket.on('submit_action', (rawAction) => {
            const roomId = matchService.getRoomOfUser(socket.id);
            const match = matchService.getMatch(roomId);
            if (!match?.kernel) return;

            const isP1 = socket.id === match.p1;

            // Basic sanitization/validation check before committing
            if (isP1) {
                if (match.p1Action) return;
                match.p1Action = rawAction;
                socket.emit('action_committed');
                if (match.p2) io.to(match.p2).emit('opponent_committed');
            } else {
                if (match.p2Action) return;
                match.p2Action = rawAction;
                socket.emit('action_committed');
                if (match.p1) io.to(match.p1).emit('opponent_committed');
            }

            if (match.p1Action && match.p2Action) {
                resolveMatchTurn(io, roomId);
            }
        });

        socket.on('disconnect', () => {
            const roomId = matchService.removeUser(socket.id);
            if (roomId) {
                io.to(roomId).emit('game_over', { msg: 'Opponent disconnected' });
                matchService.removeMatch(roomId);
            }
        });
    });
};

function startTurnTimeout(io, roomId) {
    const match = matchService.getMatch(roomId);
    if (!match) return;

    if (match.timeout) clearTimeout(match.timeout);
    match.timeout = setTimeout(() => {
        if (!match.p1Action) match.p1Action = { type: 'idle' };
        if (!match.p2Action) match.p2Action = { type: 'idle' };
        resolveMatchTurn(io, roomId);
    }, config.game.turnTimeoutMs);
}

function resolveMatchTurn(io, roomId) {
    const match = matchService.getMatch(roomId);
    if (!match?.kernel) return;

    if (match.timeout) clearTimeout(match.timeout);

    const actions = {
        p1: match.p1Action,
        p2: match.p2Action
    };

    try {
        const result = match.kernel.submitActions(actions);
        match.p1Action = null;
        match.p2Action = null;

        io.to(roomId).emit('turn_result', {
            state: result.state,
            events: result.events
        });

        if (result.state.status === 'game_over') {
            io.to(roomId).emit('game_over', { msg: `Game Over. Winner: ${result.state.winner}` });
            matchService.removeMatch(roomId);
        } else {
            startTurnTimeout(io, roomId);
        }
    } catch (err) {
        console.error("Kernel Error:", err.message);
        // Fallback or retry logic if needed
    }
}
