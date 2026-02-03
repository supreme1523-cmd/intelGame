
const config = require('../config/serverConfig');

const matches = {}; // roomId -> matchState
const users = {};   // socketId -> roomId
const matchmakingQueue = [];

function generateRoomCode() {
    let code = '';
    const chars = config.game.roomCodeChars;
    for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
}

function createMatch(roomId, p1Id, p2Id, isPrivate = true) {
    matches[roomId] = {
        state: null,
        history: [],
        p1: p1Id,
        p2: p2Id,
        p1Action: null,
        p2Action: null,
        timeout: null,
        isPrivate
    };
    if (p1Id) users[p1Id] = roomId;
    if (p2Id) users[p2Id] = roomId;
    return matches[roomId];
}

function getMatch(roomId) {
    return matches[roomId];
}

function getRoomOfUser(socketId) {
    return users[socketId];
}

function removeUser(socketId) {
    const roomId = users[socketId];
    delete users[socketId];

    // Remove from queue
    const qIndex = matchmakingQueue.indexOf(socketId);
    if (qIndex !== -1) matchmakingQueue.splice(qIndex, 1);

    return roomId;
}

function removeMatch(roomId) {
    const match = matches[roomId];
    if (match) {
        if (match.timeout) clearTimeout(match.timeout);
        if (match.p1) delete users[match.p1];
        if (match.p2) delete users[match.p2];
        delete matches[roomId];
    }
}

module.exports = {
    matches,
    users,
    matchmakingQueue,
    generateRoomCode,
    createMatch,
    getMatch,
    getRoomOfUser,
    removeUser,
    removeMatch
};
