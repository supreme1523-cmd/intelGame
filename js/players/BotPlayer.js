
/**
 * Shared Intent Arena: Bot Player Adapter
 * 
 * Bridges the Game Kernel and the Minimax Search Engine.
 */
class BotPlayer {
    constructor(kernelClass, minimaxClass, evaluateFn, difficultyConfig) {
        this.Kernel = kernelClass;
        this.Search = new minimaxClass(kernelClass, evaluateFn);
        this.difficultyConfig = difficultyConfig;
    }

    /**
     * Interface: decideMove(snapshot, playerID, difficulty)
     * Returns: Action
     */
    decideMove(snapshot, playerId, difficultyLabel = 'Medium') {
        const config = this.difficultyConfig[difficultyLabel] || this.difficultyConfig.Medium;

        console.log(`[BOT] Thinking... Difficulty: ${difficultyLabel}, Depth: ${config.depth}`);

        // 1. Core Minimax Calculation
        const result = this.Search.findBestMove(
            snapshot,
            playerId,
            config.depth,
            config.timeCap,
            !!config.iterativeDeepening
        );

        let finalAction = result.action;

        // 2. Randomness Injector (Human-like suboptimal play)
        if (config.randomness > 0 && Math.random() < config.randomness) {
            console.log(`[BOT] Chaos factor triggered! Picking random move.`);
            const legal = this.getLegal(snapshot, playerId);
            finalAction = legal[Math.floor(Math.random() * legal.length)];
        }

        console.log(`[BOT] Decided: ${finalAction.type}${finalAction.dir ? ' ' + finalAction.dir : ''}. Calculated ${result.nodes} states.`);
        return finalAction;
    }

    getLegal(state, playerId) {
        const tempKernel = new this.Kernel(state);
        return tempKernel.getLegalActions(playerId);
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = BotPlayer;
} else {
    window.BotPlayer = BotPlayer;
}
