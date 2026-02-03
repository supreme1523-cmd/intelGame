
const CONSTANTS = {
    GRID_SIZE: 16,
    MAX_HP: 5,
    MAX_ENERGY: 5,
    COST: {
        MOVE: 1,
        ATTACK: 1,
        DEFEND: 1,
        ABILITY: 2
    },
    RESOURCE_CD: {
        energy: 3,
        heal: 6,
        special: 10
    }
};

function createInitialState() {
    const state = {
        turn: 1,
        phase: 'planning',
        status: 'active',
        players: {
            p1: {
                id: 'p1', x: 2, y: 2, hp: CONSTANTS.MAX_HP, nrg: CONSTANTS.MAX_ENERGY,
                action: null, lastAction: null, shield: false,
                color: 'cyan', recentHarvests: []
            },
            p2: {
                id: 'p2', x: 13, y: 13, hp: CONSTANTS.MAX_HP, nrg: CONSTANTS.MAX_ENERGY,
                action: null, lastAction: null, shield: false,
                color: 'magenta', recentHarvests: []
            }
        },
        tiles: {}, // "x,y" -> { type, cooldown }
        abilities: ['blink', 'jam', 'recharge'],
        log: []
    };

    // Symmetrical Map Seeding
    const seedResource = (x, y, type) => {
        state.tiles[`${x},${y}`] = { type, cooldown: 0 };
        const mx = (CONSTANTS.GRID_SIZE - 1) - x;
        const my = (CONSTANTS.GRID_SIZE - 1) - y;
        state.tiles[`${mx},${my}`] = { type, cooldown: 0 };
    };

    seedResource(7, 7, 'special');
    seedResource(7, 8, 'heal');
    seedResource(4, 4, 'energy');
    seedResource(4, 11, 'energy');
    seedResource(11, 4, 'energy');
    seedResource(1, 7, 'energy');
    seedResource(7, 1, 'energy');

    return state;
}

module.exports = {
    CONSTANTS,
    createInitialState
};
