
const { DIRECTIONS, ABILITIES } = require('./Action');
const { CONSTANTS } = require('./GameState');
const { getActionCost } = require('./Validation');
const { createSnapshot } = require('./Snapshot');

function resolveTurn(state, p1Action, p2Action) {
    const newState = createSnapshot(state);
    const log = [];
    const events = [];

    const p1 = newState.players.p1;
    const p2 = newState.players.p2;

    // 0. Update Tile Cooldowns
    for (let coord in newState.tiles) {
        if (newState.tiles[coord].cooldown > 0) {
            newState.tiles[coord].cooldown--;
        }
    }

    // Energy Deduction
    const p1Cost = getActionCost(p1, p1Action);
    const p2Cost = getActionCost(p2, p2Action);

    p1.harvestPenalty = 0;
    p2.harvestPenalty = 0;

    if (p1.nrg < p1Cost) {
        log.push("P1 energy too low! Action failed.");
        p1Action = { type: 'idle' };
    } else {
        p1.nrg -= p1Cost;
        events.push({ type: 'energy', player: 'p1', cost: p1Cost, remaining: p1.nrg });
    }

    if (p2.nrg < p2Cost) {
        log.push("P2 energy too low! Action failed.");
        p2Action = { type: 'idle' };
    } else {
        p2.nrg -= p2Cost;
        events.push({ type: 'energy', player: 'p2', cost: p2Cost, remaining: p2.nrg });
    }

    p1.lastAction = p1Action;
    p2.lastAction = p2Action;

    // 1. Reset Turn Flags
    p1.shield = false;
    p2.shield = false;
    let p1Jammed = false;
    let p2Jammed = false;

    // 2. Process Jam
    if (p1Action.type === 'ability' && p1Action.id === 'jam') {
        p2Jammed = true;
        log.push("P1 used JAM!");
        events.push({ type: 'jam', source: 'p1', target: 'p2' });
        consumeAbility(newState, 'jam');
    }
    if (p2Action.type === 'ability' && p2Action.id === 'jam') {
        p1Jammed = true;
        log.push("P2 used JAM!");
        events.push({ type: 'jam', source: 'p2', target: 'p1' });
        consumeAbility(newState, 'jam');
    }

    // Consume other abilities
    if (p1Action.type === 'ability' && p1Action.id !== 'jam') consumeAbility(newState, p1Action.id);
    if (p2Action.type === 'ability' && p2Action.id !== 'jam') consumeAbility(newState, p2Action.id);

    // 3. Defensives / Recharge
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
    let p1Pos = { x: p1.x, y: p1.y };
    let p2Pos = { x: p2.x, y: p2.y };

    if (!p1Jammed) {
        if (p1Action.type === 'move') p1Pos = applyMove(p1Pos, p1Action.dir, 1);
        if (p1Action.type === 'ability' && p1Action.id === 'blink') p1Pos = applyMove(p1Pos, p1Action.dir, 2);
    }
    if (!p2Jammed) {
        if (p2Action.type === 'move') p2Pos = applyMove(p2Pos, p2Action.dir, 1);
        if (p2Action.type === 'ability' && p2Action.id === 'blink') p2Pos = applyMove(p2Pos, p2Action.dir, 2);
    }

    // Collision Resolution
    const isValid = (pos) => pos.x >= 0 && pos.x < CONSTANTS.GRID_SIZE && pos.y >= 0 && pos.y < CONSTANTS.GRID_SIZE;
    if (!isValid(p1Pos)) p1Pos = { x: p1.x, y: p1.y };
    if (!isValid(p2Pos)) p2Pos = { x: p2.x, y: p2.y };

    if (p1Pos.x === p2Pos.x && p1Pos.y === p2Pos.y) {
        events.push({ type: 'collision', at: p1Pos });
        p1Pos = { x: p1.x, y: p1.y };
        p2Pos = { x: p2.x, y: p2.y };
    } else if (p1Pos.x === p2.x && p1Pos.y === p2.y && p2Pos.x === p1.x && p2Pos.y === p1.y) {
        events.push({ type: 'collision', at: p1Pos });
        p1Pos = { x: p1.x, y: p1.y };
        p2Pos = { x: p2.x, y: p2.y };
    }

    if (p1Pos.x !== p1.x || p1Pos.y !== p1.y) events.push({ type: 'move', player: 'p1', from: { x: p1.x, y: p1.y }, to: p1Pos });
    if (p2Pos.x !== p2.x || p2Pos.y !== p2.y) events.push({ type: 'move', player: 'p2', from: { x: p2.x, y: p2.y }, to: p2Pos });

    p1.x = p1Pos.x; p1.y = p1Pos.y;
    p2.x = p2Pos.x; p2.y = p2Pos.y;

    // 5. Harvesting
    resolveHarvesting(newState, events, log);

    // 6. Combat
    resolveCombat(newState, p1Action, p2Action, p1Jammed, p2Jammed, events, log);

    // 7. Post-Turn
    updateRegen(newState, state, p1Action, p2Action, events);

    newState.turn += 1;
    newState.log = log;

    // Check Win Conditions
    if (p1.hp <= 0 || p2.hp <= 0) {
        newState.status = 'game_over';
        newState.winner = p1.hp > p2.hp ? 'p1' : (p2.hp > p1.hp ? 'p2' : 'draw');
    }

    return { state: newState, events };
}

function applyMove(pos, dir, steps) {
    const d = DIRECTIONS[dir];
    if (!d) return pos;
    return { x: pos.x + (d.x * steps), y: pos.y + (d.y * steps) };
}

function consumeAbility(state, id) {
    const idx = state.abilities.indexOf(id);
    if (idx > -1) state.abilities.splice(idx, 1);
}

function resolveHarvesting(state, events, log) {
    const p1 = state.players.p1;
    const p2 = state.players.p2;
    const p1Key = `${p1.x},${p1.y}`;
    const p2Key = `${p2.x},${p2.y}`;

    if (p1Key === p2Key && state.tiles[p1Key]) {
        const tile = state.tiles[p1Key];
        if (tile.cooldown === 0) {
            log.push(`CONTESTED! ${tile.type} contested.`);
            events.push({ type: 'contest', pos: { x: p1.x, y: p1.y }, tile: tile.type });
            tile.cooldown = CONSTANTS.RESOURCE_CD[tile.type] || 5;
        }
    } else {
        [p1, p2].forEach(p => {
            const key = `${p.x},${p.y}`;
            const tile = state.tiles[key];
            if (tile && tile.cooldown === 0) {
                log.push(`${p.id.toUpperCase()} harvested ${tile.type}.`);
                events.push({ type: 'harvest', player: p.id, tile: tile.type, pos: { x: p.x, y: p.y } });

                if (tile.type === 'energy') p.nrg = Math.min(CONSTANTS.MAX_ENERGY, p.nrg + 1);
                else if (tile.type === 'heal') p.hp = Math.min(CONSTANTS.MAX_HP, p.hp + 1);
                else if (tile.type === 'special') {
                    p.nrg = CONSTANTS.MAX_ENERGY;
                    p.harvestPenalty = -1;
                }
                tile.cooldown = CONSTANTS.RESOURCE_CD[tile.type] || 5;
                p.recentHarvests.push(tile.type);
                if (p.recentHarvests.length > 5) p.recentHarvests.shift();
                if (p.recentHarvests.filter(t => t === tile.type).length >= 2) {
                    p.harvestPenalty = 1;
                    log.push(`${p.id.toUpperCase()} fatigued.`);
                }
            }
        });
    }
}

function resolveCombat(state, p1Action, p2Action, p1Jammed, p2Jammed, events, log) {
    const p1 = state.players.p1;
    const p2 = state.players.p2;

    const processAttack = (attacker, victim, action, jammed) => {
        if (jammed || action.type !== 'attack') return;
        const d = DIRECTIONS[action.dir];
        if (!d) return;
        const aim = { x: attacker.x + d.x, y: attacker.y + d.y };
        events.push({ type: 'attack', player: attacker.id, target: aim });

        if (victim.x === aim.x && victim.y === aim.y) {
            if (victim.shield) {
                events.push({ type: 'shield', player: victim.id });
                log.push(`${attacker.id.toUpperCase()} attacked, but ${victim.id.toUpperCase()} defended.`);
            } else {
                victim.hp -= 1;
                events.push({ type: 'hit', target: victim.id, damage: 1 });
                log.push(`${attacker.id.toUpperCase()} HIT ${victim.id.toUpperCase()}!`);
            }
        }
    };

    processAttack(p1, p2, p1Action, p1Jammed);
    processAttack(p2, p1, p2Action, p2Jammed);
}

function updateRegen(newState, oldState, p1Action, p2Action, events) {
    const p1 = newState.players.p1;
    const p2 = newState.players.p2;
    const p1Changed = !oldState.players.p1.lastAction || oldState.players.p1.lastAction.type !== p1Action.type;
    const p2Changed = !oldState.players.p2.lastAction || oldState.players.p2.lastAction.type !== p2Action.type;

    p1.nrg = Math.min(CONSTANTS.MAX_ENERGY, p1.nrg + (p1Changed ? 2 : 1));
    p2.nrg = Math.min(CONSTANTS.MAX_ENERGY, p2.nrg + (p2Changed ? 2 : 1));
    events.push({ type: 'regen', p1: p1.nrg, p2: p2.nrg });
}

module.exports = { resolveTurn };
