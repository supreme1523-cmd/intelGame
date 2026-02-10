
/**
 * Shared Intent Arena: Game Kernel (Browser Version)
 * 
 * Provides an isolated, deterministic game engine for both players.
 */
(function () {
    // --- Constants & Config ---
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

    // --- Helper Functions (Ported from src/core-game/) ---

    function createSnapshot(state) {
        return JSON.parse(JSON.stringify(state));
    }

    function getActionCost(player, action) {
        let cost = 0;
        if (action.type === 'move') cost = CONSTANTS.COST.MOVE;
        else if (action.type === 'attack') cost = CONSTANTS.COST.ATTACK;
        else if (action.type === 'defend') cost = CONSTANTS.COST.DEFEND;
        else if (action.type === 'ability') cost = ABILITIES[action.id]?.cost || CONSTANTS.COST.ABILITY;

        if (player.lastAction && player.lastAction.type === action.type && action.type !== 'ability') {
            cost += 1;
        }
        if (player.harvestPenalty) {
            cost += player.harvestPenalty;
        }
        return Math.max(0, cost);
    }

    function validateSingleAction(state, playerId, action) {
        if (!action || !action.type) return false;
        if (!ACTION_TYPES.includes(action.type)) return false;

        const player = state.players[playerId];
        if (['move', 'attack'].includes(action.type) || (action.type === 'ability' && action.id === 'blink')) {
            if (!action.dir || !DIRECTIONS[action.dir]) return false;
        }
        if (action.type === 'ability') {
            if (!action.id || !ABILITIES[action.id]) return false;
            if (!state.abilities.includes(action.id)) return false;
        }

        const cost = getActionCost(player, action);
        return player.nrg >= cost;
    }

    function resolveTurn(state, p1Action, p2Action) {
        const newState = createSnapshot(state);
        const log = [];
        const events = [];
        const p1 = newState.players.p1;
        const p2 = newState.players.p2;

        // 0. Update Tile Cooldowns
        for (let coord in newState.tiles) {
            if (newState.tiles[coord].cooldown > 0) newState.tiles[coord].cooldown--;
        }

        // Energy Deduction
        const p1Cost = getActionCost(p1, p1Action);
        const p2Cost = getActionCost(p2, p2Action);
        p1.harvestPenalty = 0; p2.harvestPenalty = 0;

        if (p1.nrg < p1Cost) p1Action = { type: 'idle' };
        else { p1.nrg -= p1Cost; events.push({ type: 'energy', player: 'p1', cost: p1Cost, remaining: p1.nrg }); }

        if (p2.nrg < p2Cost) p2Action = { type: 'idle' };
        else { p2.nrg -= p2Cost; events.push({ type: 'energy', player: 'p2', cost: p2Cost, remaining: p2.nrg }); }

        p1.lastAction = p1Action; p2.lastAction = p2Action;
        p1.shield = false; p2.shield = false;
        let p1Jammed = false, p2Jammed = false;

        // 2. Process Jam
        if (p1Action.type === 'ability' && p1Action.id === 'jam') { p2Jammed = true; events.push({ type: 'jam', source: 'p1', target: 'p2' }); consumeAbility(newState, 'jam'); }
        if (p2Action.type === 'ability' && p2Action.id === 'jam') { p1Jammed = true; events.push({ type: 'jam', source: 'p2', target: 'p1' }); consumeAbility(newState, 'jam'); }

        if (p1Action.type === 'ability' && p1Action.id !== 'jam') consumeAbility(newState, p1Action.id);
        if (p2Action.type === 'ability' && p2Action.id !== 'jam') consumeAbility(newState, p2Action.id);

        // 3. Defensives
        if (!p1Jammed) {
            if (p1Action.type === 'defend') p1.shield = true;
            if (p1Action.type === 'ability' && p1Action.id === 'recharge') {
                p1.nrg = Math.min(CONSTANTS.MAX_ENERGY, p1.nrg + 2);
                events.push({ type: 'recharge', player: 'p1', nrg: p1.nrg });
            }
        }
        if (!p2Jammed) {
            if (p2Action.type === 'defend') p2.shield = true;
            if (p2Action.type === 'ability' && p2Action.id === 'recharge') {
                p2.nrg = Math.min(CONSTANTS.MAX_ENERGY, p2.nrg + 2);
                events.push({ type: 'recharge', player: 'p2', nrg: p2.nrg });
            }
        }

        // 4. Movement
        let p1Pos = { x: p1.x, y: p1.y }, p2Pos = { x: p2.x, y: p2.y };
        if (!p1Jammed) {
            if (p1Action.type === 'move') p1Pos = applyMove(p1Pos, p1Action.dir, 1);
            if (p1Action.type === 'ability' && p1Action.id === 'blink') p1Pos = applyMove(p1Pos, p1Action.dir, 2);
        }
        if (!p2Jammed) {
            if (p2Action.type === 'move') p2Pos = applyMove(p2Pos, p2Action.dir, 1);
            if (p2Action.type === 'ability' && p2Action.id === 'blink') p2Pos = applyMove(p2Pos, p2Action.dir, 2);
        }

        const isValid = (pos) => pos.x >= 0 && pos.x < CONSTANTS.GRID_SIZE && pos.y >= 0 && pos.y < CONSTANTS.GRID_SIZE;
        if (!isValid(p1Pos)) p1Pos = { x: p1.x, y: p1.y };
        if (!isValid(p2Pos)) p2Pos = { x: p2.x, y: p2.y };

        if ((p1Pos.x === p2Pos.x && p1Pos.y === p2Pos.y) || (p1Pos.x === p2.x && p1Pos.y === p2.y && p2Pos.x === p1.x && p2Pos.y === p1.y)) {
            events.push({ type: 'collision', at: p1Pos });
            p1Pos = { x: p1.x, y: p1.y }; p2Pos = { x: p2.x, y: p2.y };
        }

        if (p1Pos.x !== p1.x || p1Pos.y !== p1.y) events.push({ type: 'move', player: 'p1', from: { x: p1.x, y: p1.y }, to: p1Pos });
        if (p2Pos.x !== p2.x || p2Pos.y !== p2.y) events.push({ type: 'move', player: 'p2', from: { x: p2.x, y: p2.y }, to: p2Pos });
        p1.x = p1Pos.x; p1.y = p1Pos.y; p2.x = p2Pos.x; p2.y = p2Pos.y;

        // 5. Harvesting
        const p1Key = `${p1.x},${p1.y}`, p2Key = `${p2.x},${p2.y}`;
        if (p1Key === p2Key && newState.tiles[p1Key] && newState.tiles[p1Key].cooldown === 0) {
            events.push({ type: 'contest', pos: { x: p1.x, y: p1.y }, tile: newState.tiles[p1Key].type });
            newState.tiles[p1Key].cooldown = CONSTANTS.RESOURCE_CD[newState.tiles[p1Key].type] || 5;
        } else {
            [p1, p2].forEach(p => {
                const key = `${p.x},${p.y}`, tile = newState.tiles[key];
                if (tile && tile.cooldown === 0) {
                    events.push({ type: 'harvest', player: p.id, tile: tile.type, pos: { x: p.x, y: p.y } });
                    if (tile.type === 'energy') p.nrg = Math.min(CONSTANTS.MAX_ENERGY, p.nrg + 1);
                    else if (tile.type === 'heal') p.hp = Math.min(CONSTANTS.MAX_HP, p.hp + 1);
                    else if (tile.type === 'special') { p.nrg = CONSTANTS.MAX_ENERGY; p.harvestPenalty = -1; }
                    tile.cooldown = CONSTANTS.RESOURCE_CD[tile.type] || 5;
                    p.recentHarvests.push(tile.type);
                    if (p.recentHarvests.length > 5) p.recentHarvests.shift();
                    if (p.recentHarvests.filter(t => t === tile.type).length >= 2) p.harvestPenalty = 1;
                }
            });
        }

        // 6. Combat
        [{ a: p1, v: p2, act: p1Action, j: p1Jammed }, { a: p2, v: p1, act: p2Action, j: p2Jammed }].forEach(pair => {
            if (pair.j || pair.act.type !== 'attack') return;
            const d = DIRECTIONS[pair.act.dir]; if (!d) return;
            const aim = { x: pair.a.x + d.x, y: pair.a.y + d.y };
            events.push({ type: 'attack', player: pair.a.id, target: aim });
            if (pair.v.x === aim.x && pair.v.y === aim.y) {
                if (pair.v.shield) events.push({ type: 'shield', player: pair.v.id });
                else { pair.v.hp -= 1; events.push({ type: 'hit', target: pair.v.id, damage: 1 }); }
            }
        });

        // 7. Regen
        const p1Changed = !state.players.p1.lastAction || state.players.p1.lastAction.type !== p1Action.type;
        const p2Changed = !state.players.p2.lastAction || state.players.p2.lastAction.type !== p2Action.type;
        p1.nrg = Math.min(CONSTANTS.MAX_ENERGY, p1.nrg + (p1Changed ? 2 : 1));
        p2.nrg = Math.min(CONSTANTS.MAX_ENERGY, p2.nrg + (p2Changed ? 2 : 1));
        events.push({ type: 'regen', p1: p1.nrg, p2: p2.nrg });

        newState.turn += 1;
        if (p1.hp <= 0 || p2.hp <= 0) {
            newState.status = 'game_over';
            newState.winner = p1.hp > p2.hp ? 'p1' : (p2.hp > p1.hp ? 'p2' : 'draw');
        }
        return { state: newState, events };
    }

    function applyMove(pos, dir, steps) {
        const d = DIRECTIONS[dir];
        return d ? { x: pos.x + (d.x * steps), y: pos.y + (d.y * steps) } : pos;
    }

    function consumeAbility(state, id) {
        const idx = state.abilities.indexOf(id);
        if (idx > -1) state.abilities.splice(idx, 1);
    }

    // --- Game Kernel Class ---

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
                const mx = (CONSTANTS.GRID_SIZE - 1) - x, my = (CONSTANTS.GRID_SIZE - 1) - y;
                state.tiles[`${mx},${my}`] = { type, cooldown: 0 };
            };
            seed(7, 7, 'special'); seed(7, 8, 'heal'); seed(4, 4, 'energy'); seed(4, 11, 'energy'); seed(11, 4, 'energy'); seed(1, 7, 'energy'); seed(7, 1, 'energy');
            return state;
        }

        getStateSnapshot() {
            return createSnapshot(this.state);
        }

        submitActions(actionsMap) {
            const result = resolveTurn(this.state, actionsMap.p1 || { type: 'idle' }, actionsMap.p2 || { type: 'idle' });
            this.state = result.state;
            return { state: this.getStateSnapshot(), events: result.events };
        }

        getLegalActions(playerId) {
            const legal = [];
            ACTION_TYPES.forEach(type => {
                if (['move', 'attack'].includes(type)) Object.keys(DIRECTIONS).forEach(dir => legal.push({ type, dir }));
                else if (type === 'ability') this.state.abilities.forEach(id => {
                    if (id === 'blink') Object.keys(DIRECTIONS).forEach(dir => legal.push({ type, id, dir }));
                    else legal.push({ type, id });
                });
                else legal.push({ type });
            });
            return legal.filter(a => validateSingleAction(this.state, playerId, a));
        }

        getActionCost(playerId, action) {
            return getActionCost(this.state.players[playerId], action);
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
