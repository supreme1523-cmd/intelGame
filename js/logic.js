
(function () {
    const CONSTANTS = {
        GRID_SIZE: 16,
        MAX_HP: 5, // Increased HP for larger map
        MAX_ENERGY: 5, // Increased Energy for larger map
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

    function createInitialState() {
        const state = {
            turn: 1,
            phase: 'planning',
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
            // Mirror
            const mx = (CONSTANTS.GRID_SIZE - 1) - x;
            const my = (CONSTANTS.GRID_SIZE - 1) - y;
            state.tiles[`${mx},${my}`] = { type, cooldown: 0 };
        };

        // Center High Value
        seedResource(7, 7, 'special');
        seedResource(7, 8, 'heal');

        // Midfield
        seedResource(4, 4, 'energy');
        seedResource(4, 11, 'energy');
        seedResource(11, 4, 'energy');
        seedResource(1, 7, 'energy');
        seedResource(7, 1, 'energy');

        return state;
    }

    // Deterministic Resolution
    function resolveTurn(state, p1Action, p2Action) {
        const newState = JSON.parse(JSON.stringify(state)); // Deep copy-ish
        const log = [];

        const p1 = newState.players.p1;
        const p2 = newState.players.p2;

        // 0. Update Tile Cooldowns
        for (let coord in newState.tiles) {
            if (newState.tiles[coord].cooldown > 0) {
                newState.tiles[coord].cooldown--;
            }
        }

        const getRawCost = (action) => {
            if (action.type === 'move') return CONSTANTS.COST.MOVE;
            if (action.type === 'attack') return CONSTANTS.COST.ATTACK;
            if (action.type === 'defend') return CONSTANTS.COST.DEFEND;
            if (action.type === 'ability' && action.id) {
                return ABILITIES[action.id] ? ABILITIES[action.id].cost : CONSTANTS.COST.ABILITY;
            }
            return 0;
        };

        // 0. Deduct Energy & Apply Penalties
        // Safeguard: Repeating actions costs +1
        const getPenalty = (player, action) => {
            if (!player.lastAction) return 0;
            if (player.lastAction.type === action.type && action.type !== 'ability') return 1;
            return 0;
        };

        const p1Penalty = getPenalty(p1, p1Action) + (p1.harvestPenalty || 0);
        const p2Penalty = getPenalty(p2, p2Action) + (p2.harvestPenalty || 0);

        const p1Cost = getRawCost(p1Action) + p1Penalty;
        const p2Cost = getRawCost(p2Action) + p2Penalty;

        // Reset stateful penalty after applying it
        p1.harvestPenalty = 0;
        p2.harvestPenalty = 0;

        // Server authority: If player doesn't have enough energy, the action fails (becomes 'idle')
        if (p1.nrg < p1Cost) {
            log.push("P1 energy too low! Action failed.");
            p1Action.type = 'idle';
        } else {
            p1.nrg -= p1Cost;
        }

        if (p2.nrg < p2Cost) {
            log.push("P2 energy too low! Action failed.");
            p2Action.type = 'idle';
        } else {
            p2.nrg -= p2Cost;
        }

        p1.nrg = Math.max(0, p1.nrg);
        p2.nrg = Math.max(0, p2.nrg);

        // Update Last Action for next turn
        p1.lastAction = p1Action; // Store full obj or just type? Logic needs type.
        p2.lastAction = p2Action;

        // 1. Reset Turn Flags
        p1.shield = false;
        p2.shield = false;
        let p1Jammed = false;
        let p2Jammed = false;

        // 2. Process Abilities (Priority 0 - Meta)
        // Jam
        if (p1Action.type === 'ability' && p1Action.id === 'jam') {
            p2Jammed = true;
            log.push("P1 used JAM! P2's action cancelled.");
            const idx = newState.abilities.indexOf('jam');
            if (idx > -1) newState.abilities.splice(idx, 1);
        }
        if (p2Action.type === 'ability' && p2Action.id === 'jam') {
            p1Jammed = true;
            log.push("P2 used JAM! P1's action cancelled.");
            const idx = newState.abilities.indexOf('jam');
            if (idx > -1) newState.abilities.splice(idx, 1);
        }

        // Remove other abilities if used
        if (p1Action.type === 'ability' && p1Action.id !== 'jam') {
            const idx = newState.abilities.indexOf(p1Action.id);
            if (idx > -1) newState.abilities.splice(idx, 1);
        }
        if (p2Action.type === 'ability' && p2Action.id !== 'jam') {
            const idx = newState.abilities.indexOf(p2Action.id);
            if (idx > -1) newState.abilities.splice(idx, 1);
        }


        // 3. Process Defensives and Other Abilities
        if (!p1Jammed) {
            if (p1Action.type === 'defend') p1.shield = true;
            if (p1Action.type === 'ability' && p1Action.id === 'recharge') {
                p1.nrg = Math.min(CONSTANTS.MAX_ENERGY, p1.nrg + 2);
                log.push("P1 Recharged.");
            }
        }
        if (!p2Jammed) {
            if (p2Action.type === 'defend') p2.shield = true;
            if (p2Action.type === 'ability' && p2Action.id === 'recharge') {
                p2.nrg = Math.min(CONSTANTS.MAX_ENERGY, p2.nrg + 2);
                log.push("P2 Recharged.");
            }
        }

        // 4. Calculate Intent (Movement)
        let p1Pos = { x: p1.x, y: p1.y };
        let p2Pos = { x: p2.x, y: p2.y };

        const applyMove = (pos, dir, steps = 1) => {
            const d = DIRECTIONS[dir];
            if (!d) return { x: pos.x, y: pos.y }; // Stay if invalid dir
            return { x: pos.x + (d.x * steps), y: pos.y + (d.y * steps) };
        };

        if (!p1Jammed) {
            if (p1Action.type === 'move') p1Pos = applyMove(p1Pos, p1Action.dir, 1);
            if (p1Action.type === 'ability' && p1Action.id === 'blink') p1Pos = applyMove(p1Pos, p1Action.dir, 2);
        }
        if (!p2Jammed) {
            if (p2Action.type === 'move') p2Pos = applyMove(p2Pos, p2Action.dir, 1);
            if (p2Action.type === 'ability' && p2Action.id === 'blink') p2Pos = applyMove(p2Pos, p2Action.dir, 2);
        }

        // 5. Resolve Collision (Deterministic)
        function isValid(pos) {
            return pos.x >= 0 && pos.x < CONSTANTS.GRID_SIZE &&
                pos.y >= 0 && pos.y < CONSTANTS.GRID_SIZE;
        }

        // Rule A: Out of Bounds
        if (!isValid(p1Pos)) p1Pos = { x: p1.x, y: p1.y };
        if (!isValid(p2Pos)) p2Pos = { x: p2.x, y: p2.y };

        // Rule B: Same square
        if (p1Pos.x === p2Pos.x && p1Pos.y === p2Pos.y) {
            log.push("COLLISION! Both players bounced back.");
            p1Pos = { x: p1.x, y: p1.y };
            p2Pos = { x: p2.x, y: p2.y };
        }

        // Rule C: Swapping (Head-on)
        if (p1Pos.x === p2.x && p1Pos.y === p2.y && p2Pos.x === p1.x && p2Pos.y === p1.y) {
            log.push("HEAD-ON COLLISION! Movement cancelled.");
            p1Pos = { x: p1.x, y: p1.y };
            p2Pos = { x: p2.x, y: p2.y };
        }

        // Rule D: Moving into stationary opponent
        if ((p1Action.type === 'move' || (p1Action.type === 'ability' && p1Action.id === 'blink')) && !p1Jammed && p1Pos.x === p2Pos.x && p1Pos.y === p2Pos.y) {
            p1Pos = { x: p1.x, y: p1.y };
            log.push("P1 Blocked by P2.");
        }
        if ((p2Action.type === 'move' || (p2Action.type === 'ability' && p2Action.id === 'blink')) && !p2Jammed && p2Pos.x === p1Pos.x && p2Pos.y === p1Pos.y) {
            p2Pos = { x: p2.x, y: p2.y };
            log.push("P2 Blocked by P1.");
        }

        // Apply Moves
        p1.x = p1Pos.x;
        p1.y = p1Pos.y;
        p2.x = p2Pos.x;
        p2.y = p2Pos.y;

        // 5.5 Harvest Resources
        const p1Key = `${p1.x},${p1.y}`;
        const p2Key = `${p2.x},${p2.y}`;

        const harvest = (player, tile, key) => {
            if (tile.cooldown > 0) return;

            log.push(`PLAYER ${player.id.toUpperCase()} harvested ${tile.type.toUpperCase()}!`);
            if (tile.type === 'energy') {
                player.nrg = Math.min(CONSTANTS.MAX_ENERGY, player.nrg + 1);
            } else if (tile.type === 'heal') {
                player.hp = Math.min(CONSTANTS.MAX_HP, player.hp + 1);
            } else if (tile.type === 'special') {
                player.nrg = CONSTANTS.MAX_ENERGY;
                player.harvestPenalty = -1; // Next action is free (cost reduction)
                log.push(`PLAYER ${player.id.toUpperCase()} receives ENERGY REFILL and next action FREE!`);
            }

            tile.cooldown = CONSTANTS.RESOURCE_CD[tile.type] || 5;

            // Anti-Snowball: Track type overuse
            player.recentHarvests.push(tile.type);
            if (player.recentHarvests.length > 5) player.recentHarvests.shift();

            const count = player.recentHarvests.filter(t => t === tile.type).length;
            if (count >= 2) {
                player.harvestPenalty = 1; // Increase cost if same type used too much
                log.push(`OVERUSE! PLAYER ${player.id.toUpperCase()} feels fatigued. (+1 Energy Cost next turn)`);
            }
        };

        if (p1Key === p2Key && newState.tiles[p1Key]) {
            const tile = newState.tiles[p1Key];
            if (tile.cooldown === 0) {
                log.push(`CONTESTED! Both players fought over the ${tile.type} tile. No one gets it!`);
                tile.cooldown = CONSTANTS.RESOURCE_CD[tile.type] || 5;
            }
        } else {
            if (newState.tiles[p1Key]) harvest(p1, newState.tiles[p1Key], p1Key);
            if (newState.tiles[p2Key]) harvest(p2, newState.tiles[p2Key], p2Key);
        }

        // 6. Resolve Attacks
        if (!p1Jammed && p1Action.type === 'attack') {
            const d = DIRECTIONS[p1Action.dir];
            if (!d) {
                log.push("P1 Attacked wildly (No Direction).");
            } else {
                const targetX = p1.x + d.x; // Attack from new position? No, usually start. 
                // "Actions resolve simultaneously".
                // If I Move and Attack, I attack from NEW pos? 
                // My previous logic was "If type is ATTACK, I didn't Move".
                // So Start Pos == End Pos.

                // Wait, logic says `p1.x = p1Pos.x`.
                // If action was 'attack', p1Pos IS p1's start pos (calculated above, move block skipped).
                // So `p1.x` is already updated to (same) pos.

                const aimX = p1.x + d.x;
                const aimY = p1.y + d.y;

                if (p2.x === aimX && p2.y === aimY) {
                    if (p2.shield) {
                        log.push("P1 Attacked P2, but P2 Defended!");
                    } else {
                        p2.hp -= 1;
                        log.push("P1 HIT P2!");
                    }
                } else {
                    log.push("P1 Attacked empty space.");
                }
            }
        } // Close P1 Attack Block

        if (!p2Jammed && p2Action.type === 'attack') {
            const d = DIRECTIONS[p2Action.dir];
            if (!d) {
                log.push("P2 Attacked wildly (No Direction).");
            } else {
                const aimX = p2.x + d.x;
                const aimY = p2.y + d.y;

                if (p1.x === aimX && p1.y === aimY) {
                    if (p1.shield) {
                        log.push("P2 Attacked P1, but P1 Defended!");
                    } else {
                        p1.hp -= 1;
                        log.push("P2 HIT P1!");
                    }
                } else {
                    log.push("P2 Attacked empty space.");
                }
            }
        } // Close P2 Attack Block

        // 7. Energy Regen & Progression
        // Forced Variation Incentive: +1 Bonus Energy if you change action types
        const calculateRegen = (player, currentAction) => {
            const baseRegen = 1;
            // Note: lastAction here is still from the PREVIOUS state because we haven't updated it on the player object yet, 
            // OR we can use newState.players[id].lastAction if we update it at the very end.
            // Wait, I updated it at line 75. Let's look at the code again.
            return 1; // Placeholder for now, let's be careful.
        };

        // Actually, let's do it simply:
        const p1Changed = !state.players.p1.lastAction || state.players.p1.lastAction.type !== p1Action.type;
        const p2Changed = !state.players.p2.lastAction || state.players.p2.lastAction.type !== p2Action.type;

        p1.nrg = Math.min(CONSTANTS.MAX_ENERGY, p1.nrg + (p1Changed ? 2 : 1));
        p2.nrg = Math.min(CONSTANTS.MAX_ENERGY, p2.nrg + (p2Changed ? 2 : 1));

        // Update Last Action for next turn (moved here)
        p1.lastAction = p1Action;
        p2.lastAction = p2Action;

        newState.turn += 1;
        newState.log = log;

        return newState;
    }

    // Expose
    const gameExports = {
        CONSTANTS, DIRECTIONS, ABILITIES, createInitialState, resolveTurn
    };

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = gameExports;
    } else {
        window.GameLogic = gameExports;
    }
})();
