
const DIRECTIONS = {
    up: { x: 0, y: -1 },
    down: { x: 0, y: 1 },
    left: { x: -1, y: 0 },
    right: { x: 1, y: 0 }
};

const ABILITIES = {
    blink: { id: 'blink', name: 'BLINK', desc: 'Jump 2 tiles directly', cost: 2 },
    jam: { id: 'jam', name: 'JAM', desc: 'Cancel enemy action', cost: 3 },
    recharge: { id: 'recharge', name: 'RECHARGE', desc: '+2 Energy', cost: 0 }
};

const ACTION_TYPES = ['move', 'attack', 'defend', 'ability', 'idle'];

module.exports = {
    DIRECTIONS,
    ABILITIES,
    ACTION_TYPES
};
