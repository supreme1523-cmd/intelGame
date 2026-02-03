
const { createInitialState, CONSTANTS } = require('./GameState');
const { DIRECTIONS, ABILITIES, ACTION_TYPES } = require('./Action');
const { resolveTurn } = require('./TurnResolver');
const { validateActions, getLegalActions } = require('./Validation');
const { createSnapshot, freeze } = require('./Snapshot');

/**
 * Game Kernel API
 * 
 * Provides a clean, isolated bridge between transport/AI layers and game rules.
 */
class GameKernel {
    constructor(state = null) {
        this.state = state || createInitialState();
    }

    /**
     * Accept actions from context (Map<PlayerID, Action>)
     * Resolves turn and returns complete state + event log
     */
    submitActions(actionsMap) {
        if (!this.validateActions(actionsMap)) {
            throw new Error("Invalid actions submitted to Kernel");
        }

        const p1Action = actionsMap.p1 || { type: 'idle' };
        const p2Action = actionsMap.p2 || { type: 'idle' };

        const result = resolveTurn(this.state, p1Action, p2Action);
        this.state = result.state;

        return {
            state: this.getStateSnapshot(),
            events: result.events
        };
    }

    /**
     * Get list of all valid actions for a specific player
     */
    getLegalActions(playerId) {
        return getLegalActions(this.state, playerId);
    }

    /**
     * Returns an immutable snapshot of the current state
     */
    getStateSnapshot() {
        return freeze(createSnapshot(this.state));
    }

    /**
     * Verify if a set of actions is valid given the current state
     */
    validateActions(actionsMap) {
        return validateActions(this.state, actionsMap);
    }

    // Static Helpers
    static createNewGame() {
        return new GameKernel(createInitialState());
    }
}

module.exports = {
    GameKernel,
    CONSTANTS,
    DIRECTIONS,
    ABILITIES,
    ACTION_TYPES
};
