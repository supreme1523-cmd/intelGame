
const { ACTION_TYPES, DIRECTIONS, ABILITIES } = require('./Action');
const { CONSTANTS } = require('./GameState');

function validateActions(state, actionsMap) {
    if (!state || !actionsMap) return false;

    for (const [playerId, action] of Object.entries(actionsMap)) {
        if (!state.players[playerId]) return false;
        if (!validateSingleAction(state, playerId, action)) return false;
    }
    return true;
}

function validateSingleAction(state, playerId, action) {
    if (!action || !action.type) return false;
    if (!ACTION_TYPES.includes(action.type)) return false;

    const player = state.players[playerId];

    // Check Direction
    if (['move', 'attack'].includes(action.type) || (action.type === 'ability' && action.id === 'blink')) {
        if (!action.dir || !DIRECTIONS[action.dir]) return false;
    }

    // Check Ability Validity
    if (action.type === 'ability') {
        if (!action.id || !ABILITIES[action.id]) return false;
        if (!state.abilities.includes(action.id)) return false;
    }

    // Cost Calculation
    const cost = getActionCost(player, action);
    if (player.nrg < cost) return false;

    return true;
}

function getActionCost(player, action) {
    let cost = 0;
    if (action.type === 'move') cost = CONSTANTS.COST.MOVE;
    else if (action.type === 'attack') cost = CONSTANTS.COST.ATTACK;
    else if (action.type === 'defend') cost = CONSTANTS.COST.DEFEND;
    else if (action.type === 'ability') cost = ABILITIES[action.id]?.cost || CONSTANTS.COST.ABILITY;

    // Repetition Penalty
    if (player.lastAction && player.lastAction.type === action.type && action.type !== 'ability') {
        cost += 1;
    }

    // Harvest Penalty
    if (player.harvestPenalty) {
        cost += player.harvestPenalty;
    }

    return Math.max(0, cost);
}

function getLegalActions(state, playerId) {
    const player = state.players[playerId];
    const legal = [];

    // Basic Actions
    ['move', 'attack', 'defend', 'idle'].forEach(type => {
        if (['move', 'attack'].includes(type)) {
            Object.keys(DIRECTIONS).forEach(dir => {
                const action = { type, dir };
                if (validateSingleAction(state, playerId, action)) legal.push(action);
            });
        } else {
            const action = { type };
            if (validateSingleAction(state, playerId, action)) legal.push(action);
        }
    });

    // Available Abilities
    state.abilities.forEach(id => {
        const ability = ABILITIES[id];
        if (id === 'blink') {
            Object.keys(DIRECTIONS).forEach(dir => {
                const action = { type: 'ability', id, dir };
                if (validateSingleAction(state, playerId, action)) legal.push(action);
            });
        } else {
            const action = { type: 'ability', id };
            if (validateSingleAction(state, playerId, action)) legal.push(action);
        }
    });

    return legal;
}

module.exports = {
    validateActions,
    validateSingleAction,
    getLegalActions,
    getActionCost
};
