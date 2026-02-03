
/**
 * Shared Intent Arena: Game Kernel (Browser Version)
 * 
 * Provides an isolated, deterministic game engine for both players.
 */
(function () {
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

    class GameKernel {
        constructor(state) {
            this.state = state || this.createInitialState();
        }

        createInitialState() {
            const state = {
                turn: 1, phase: 'planning', status: 'active',
                players: {
                    p1: { id: 'p1', x: 2, y: 2, hp: CONSTANTS.MAX_HP, nrg: CONSTANTS.MAX_ENERGY, action: null, lastAction: null, shield: false, color: 'cyan', recentHarvests: [] },
                    p2: { id: 'p2', x: 13, y: 13, hp: CONSTANTS.MAX_HP, nrg: CONSTANTS.MAX_ENERGY, action: null, lastAction: null, shield: false, color: 'magenta', recentHarvests: [] }
                },
                tiles: {}, abilities: ['blink', 'jam', 'recharge'], log: []
            };

            const seed = (x, y, type) => {
                state.tiles[`${x},${y}`] = { type, cooldown: 0 };
                const mx = (CONSTANTS.GRID_SIZE - 1) - x;
                const my = (CONSTANTS.GRID_SIZE - 1) - y;
                state.tiles[`${mx},${my}`] = { type, cooldown: 0 };
            };

            seed(7, 7, 'special'); seed(7, 8, 'heal'); seed(4, 4, 'energy'); seed(4, 11, 'energy'); seed(11, 4, 'energy'); seed(1, 7, 'energy'); seed(7, 1, 'energy');
            return state;
        }

        getStateSnapshot() {
            return JSON.parse(JSON.stringify(this.state));
        }

        getLegalActions(playerId) {
            const player = this.state.players[playerId];
            const legal = [];
            ACTION_TYPES.forEach(type => {
                if (['move', 'attack'].includes(type)) {
                    Object.keys(DIRECTIONS).forEach(dir => legal.push({ type, dir }));
                } else if (type === 'ability') {
                    this.state.abilities.forEach(id => {
                        if (id === 'blink') Object.keys(DIRECTIONS).forEach(dir => legal.push({ type, id, dir }));
                        else legal.push({ type, id });
                    });
                } else legal.push({ type });
            });
            return legal.filter(a => this.validateSingleAction(playerId, a));
        }

        validateActions(actionsMap) {
            return Object.entries(actionsMap).every(([pid, a]) => this.validateSingleAction(pid, a));
        }

        validateSingleAction(playerId, action) {
            const p = this.state.players[playerId];
            if (!p || !action || !action.type) return false;

            let cost = 0;
            if (action.type === 'move') cost = CONSTANTS.COST.MOVE;
            else if (action.type === 'attack') cost = CONSTANTS.COST.ATTACK;
            else if (action.type === 'defend') cost = CONSTANTS.COST.DEFEND;
            else if (action.type === 'ability') {
                if (!action.id || !ABILITIES[action.id]) return false;
                if (!this.state.abilities.includes(action.id)) return false;
                cost = ABILITIES[action.id].cost;
            }

            if (p.lastAction && p.lastAction.type === action.type && action.type !== 'ability') cost += 1;
            if (p.harvestPenalty) cost += p.harvestPenalty;

            return p.nrg >= cost;
        }

        // Action Cost Helper for UI
        getActionCost(playerId, action) {
            const p = this.state.players[playerId];
            let cost = 0;
            if (action.type === 'move') cost = CONSTANTS.COST.MOVE;
            else if (action.type === 'attack') cost = CONSTANTS.COST.ATTACK;
            else if (action.type === 'defend') cost = CONSTANTS.COST.DEFEND;
            else if (action.type === 'ability') cost = ABILITIES[action.id]?.cost || 0;

            if (p.lastAction && p.lastAction.type === action.type && action.type !== 'ability') cost += 1;
            if (p.harvestPenalty) cost += p.harvestPenalty;
            return cost;
        }
    }

    // Expose as window properties
    window.GameKernel = GameKernel;
    window.KernelConfigs = { CONSTANTS, DIRECTIONS, ABILITIES, ACTION_TYPES };

    // Compatibility Layer for old GameLogic refs
    window.GameLogic = {
        CONSTANTS, DIRECTIONS, ABILITIES,
        createInitialState: () => new GameKernel().createInitialState()
    };
})();
