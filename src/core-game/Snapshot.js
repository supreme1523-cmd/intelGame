
/**
 * Snapshot utility for creating immutable state objects.
 */
function createSnapshot(state) {
    if (!state) return null;
    // Deep clone implementation
    return JSON.parse(JSON.stringify(state));
}

function freeze(obj) {
    Object.freeze(obj);
    if (obj.players) Object.freeze(obj.players);
    if (obj.tiles) Object.freeze(obj.tiles);
    return obj;
}

module.exports = {
    createSnapshot,
    freeze
};
