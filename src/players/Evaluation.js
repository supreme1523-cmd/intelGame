
/**
 * Shared Intent Arena: State Evaluation
 * 
 * Provides an abstract score for a given game state.
 * High positive score = P1 advantage.
 * High negative score = P2 advantage.
 */
function evaluateState(state) {
    if (state.status === 'game_over') {
        if (state.winner === 'p1') return 10000;
        if (state.winner === 'p2') return -10000;
        return 0; // Draw
    }

    const p1 = state.players.p1;
    const p2 = state.players.p2;

    let score = 0;

    // 1. HP Difference (Primary Priority)
    score += (p1.hp - p2.hp) * 500;

    // 2. Energy Advantage (Resource Priority)
    score += (p1.nrg - p2.nrg) * 50;

    // 3. Proximity to Resources
    // Score based on distance to nearest un-cooldown tiles
    score += calculatePositionalScore(state, 'p1');
    score -= calculatePositionalScore(state, 'p2');

    // 4. Center Control / Mobility
    // Reward being closer to the center if no resources are immediately needed
    const center = 7.5;
    const p1DistToCenter = Math.abs(p1.x - center) + Math.abs(p1.y - center);
    const p2DistToCenter = Math.abs(p2.x - center) + Math.abs(p2.y - center);
    score -= p1DistToCenter * 2;
    score += p2DistToCenter * 2;

    return score;
}

function calculatePositionalScore(state, playerId) {
    const p = state.players[playerId];
    let posScore = 0;

    // Distance to nearest active tiles
    for (const [coord, tile] of Object.entries(state.tiles)) {
        if (tile.cooldown === 0) {
            const [tx, ty] = coord.split(',').map(Number);
            const dist = Math.abs(p.x - tx) + Math.abs(p.y - ty);

            // Influence decreases with distance
            const weight = tile.type === 'special' ? 100 : (tile.type === 'heal' ? 80 : 40);
            posScore += weight / (dist + 1);
        }
    }

    return posScore;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { evaluateState };
} else {
    window.StateEvaluator = { evaluateState };
}
