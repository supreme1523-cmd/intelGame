
/**
 * Shared Intent Arena: Minimax Algorithm
 * Supports simultaneous turn resolution and Alpha-Beta pruning.
 */
class MinimaxSearch {
    constructor(kernelClass, evaluateFn) {
        this.Kernel = kernelClass;
        this.evaluate = evaluateFn;
        this.nodesVisited = 0;
        this.startTime = 0;
        this.timeLimit = 0;
        this.isAborted = false;
    }

    /**
     * Finds the best action for the specified player.
     * Supports Iterative Deepening if iterativeDeepening is true.
     */
    findBestMove(state, playerId, targetDepth, timeLimitMs = 0, iterativeDeepening = false) {
        this.nodesVisited = 0;
        this.startTime = Date.now();
        this.timeLimit = timeLimitMs;
        this.isAborted = false;

        let bestResult = null;

        if (iterativeDeepening) {
            for (let d = 1; d <= targetDepth; d++) {
                const result = this.performSearch(state, playerId, d);
                if (!this.isAborted) {
                    bestResult = result;
                } else {
                    break;
                }
            }
        } else {
            bestResult = this.performSearch(state, playerId, targetDepth);
        }

        return bestResult;
    }

    performSearch(state, playerId, depth) {
        const opponentId = playerId === 'p1' ? 'p2' : 'p1';
        const legalActions = this.getActions(state, playerId);
        const opponentActions = this.getActions(state, opponentId);

        let bestScore = -Infinity;
        let bestAction = legalActions[0];

        for (const action of legalActions) {
            let minScore = Infinity;
            for (const oppAction of opponentActions) {
                const nextState = this.simulate(state, { [playerId]: action, [opponentId]: oppAction });
                const score = this.minimax(nextState, depth - 1, -Infinity, Infinity, false, playerId);

                if (score < minScore) minScore = score;
                if (this.checkTimeout()) break;
            }

            if (minScore > bestScore) {
                bestScore = minScore;
                bestAction = action;
            }
            if (this.checkTimeout()) break;
        }

        return { action: bestAction, score: bestScore, nodes: this.nodesVisited };
    }

    minimax(state, depth, alpha, beta, isMaximizing, botId) {
        this.nodesVisited++;
        if (depth === 0 || state.status === 'game_over' || this.checkTimeout()) {
            const score = this.evaluate(state);
            return botId === 'p1' ? score : -score;
        }

        const playerId = isMaximizing ? botId : (botId === 'p1' ? 'p2' : 'p1');
        const legalActions = this.getActions(state, playerId);

        if (isMaximizing) {
            let maxEval = -Infinity;
            for (const action of legalActions) {
                const evalVal = this.minimax(state, depth - 1, alpha, beta, false, botId);
                maxEval = Math.max(maxEval, evalVal);
                alpha = Math.max(alpha, evalVal);
                if (beta <= alpha) break;
            }
            return maxEval;
        } else {
            let minEval = Infinity;
            for (const action of legalActions) {
                const evalVal = this.minimax(state, depth - 1, alpha, beta, true, botId);
                minEval = Math.min(minEval, evalVal);
                beta = Math.min(beta, evalVal);
                if (beta <= alpha) break;
            }
            return minEval;
        }
    }

    /**
     * Simulates a turn using the Game Kernel logic.
     */
    simulate(state, actionsMap) {
        // We Use a temporary kernel to simulate
        const tempKernel = new this.Kernel(JSON.parse(JSON.stringify(state)));
        const result = tempKernel.submitActions(actionsMap);
        return result.state;
    }

    getActions(state, playerId) {
        const tempKernel = new this.Kernel(state);
        return tempKernel.getLegalActions(playerId);
    }

    checkTimeout() {
        if (this.timeLimit > 0 && (Date.now() - this.startTime) > this.timeLimit) {
            this.isAborted = true;
            return true;
        }
        return false;
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = MinimaxSearch;
} else {
    window.MinimaxSearch = MinimaxSearch;
}
