
(function () {
    const UI = window.GameUI;
    const { ABILITIES } = window.KernelConfigs;

    let socket = null;
    let myRole = null; // 'p1' or 'p2'
    let currentState = null;
    let pendingAction = null;
    let committed = false;
    let kernel = null;
    let isLocal = false;
    let botPlayer = null;
    let aiDifficulty = 'Medium';

    // --- Menu Integration ---
    window.addEventListener('request_create_room', () => {
        isLocal = false;
        ensureSocket();
        socket.emit('create_room');
    });

    window.addEventListener('request_join_room', (e) => {
        isLocal = false;
        ensureSocket();
        socket.emit('join_room', { code: e.detail.code });
    });

    window.addEventListener('request_start_matchmaking', () => {
        isLocal = false;
        ensureSocket();
        socket.emit('start_matchmaking');
    });

    window.addEventListener('request_cancel_matchmaking', () => {
        if (socket) socket.emit('cancel_matchmaking');
    });

    window.addEventListener('request_cancel_room', () => {
        if (socket) socket.emit('cancel_room');
    });

    window.addEventListener('request_ai_match', (e) => {
        isLocal = true;
        aiDifficulty = e.detail.difficulty || 'Medium';
        startLocalMatch();
    });

    function ensureSocket() {
        if (!socket) {
            socket = io();
            setupSocketListeners();
        }
    }

    function startLocalMatch() {
        myRole = 'p1';
        kernel = new window.GameKernel();
        botPlayer = new window.BotPlayer(
            window.GameKernel,
            window.MinimaxSearch,
            window.StateEvaluator.evaluateState,
            window.DifficultyConfig
        );

        currentState = kernel.getStateSnapshot();
        window.dispatchEvent(new CustomEvent('match_started'));
        UI.setLocked(false);
        UI.init(handleInput, handleCommit);
        UI.render(currentState, myRole);
        UI.appendLog(`Local Match Started! Difficulty: ${aiDifficulty}`);
    }

    // --- UI Callbacks ---
    function handleInput(type, data) {
        if (committed || !currentState || !kernel) return;

        let newAction = { type, ...data };
        const cost = kernel.getActionCost(myRole, newAction);

        newAction.cost = cost;
        pendingAction = newAction;

        UI.updatePreview(myRole, newAction, currentState.players[myRole].nrg);
    }

    function handleCommit() {
        if (!pendingAction) {
            UI.appendLog("Select an action first.");
            return;
        }

        const myState = currentState.players[myRole];
        if (myState.nrg < pendingAction.cost) {
            UI.appendLog("NOT ENOUGH ENERGY!");
            return;
        }

        UI.appendLog("Locking Intent...");

        if (isLocal) {
            processLocalTurn(pendingAction);
        } else {
            socket.emit('submit_action', pendingAction);
        }
    }

    function processLocalTurn(playerAction) {
        committed = true;
        UI.setLocked(true);
        UI.showOverlay("OPPONENT THINKING", "Calculating optimum strategy...", () => { });
        UI.appendLog("Processing turn...");

        // 1. Bot Decides (with artificial delay for "feel")
        setTimeout(() => {
            const botAction = botPlayer.decideMove(currentState, 'p2', aiDifficulty);

            // 2. Resolve
            const actions = { p1: playerAction, p2: botAction };
            const result = kernel.submitActions(actions);
            const finalState = result.state;
            const events = result.events;

            // 3. Clear local turn state before animation starts
            committed = false;
            pendingAction = null;

            // 4. Animate
            UI.hideOverlay();
            UI.animateResolution(currentState, events, finalState, myRole, () => {
                currentState = finalState;
                UI.setLocked(false);
                UI.render(currentState, myRole);

                if (currentState.status === 'game_over') {
                    UI.showOverlay("GAME OVER", `Winner: ${currentState.winner}`, () => {
                        window.location.reload();
                    }, "RESTART");
                }
            });
        }, 1200); // 1.2s delay for realism
    }

    // --- Socket Listeners ---
    function setupSocketListeners() {
        socket.on('connect', () => {
            UI.appendLog("Connected to server.");
        });

        socket.on('room_created', (data) => {
            window.dispatchEvent(clonedEvent('room_created', data));
        });

        socket.on('join_failed', (data) => {
            window.dispatchEvent(clonedEvent('join_failed', data));
        });

        socket.on('matchmaking_queued', () => {
            window.dispatchEvent(new CustomEvent('matchmaking_queued'));
        });

        socket.on('match_start', (data) => {
            myRole = data.role;
            currentState = data.state;
            kernel = new window.GameKernel(currentState);

            committed = false;
            pendingAction = null;

            window.dispatchEvent(new CustomEvent('match_started'));
            UI.hideOverlay();
            UI.setOpponentStatus(false);
            UI.setLocked(false);
            UI.init(handleInput, handleCommit);
            UI.render(currentState, myRole);
            UI.appendLog(`Match Found! You are ${myRole.toUpperCase()}`);
        });

        socket.on('action_committed', () => {
            committed = true;
            UI.setLocked(true);
            UI.showOverlay("COMMITTED", "WAITING FOR OPPONENT...", () => { });
            UI.appendLog("Action locked.");
        });

        socket.on('opponent_committed', () => {
            UI.appendLog("Opponent has locked intent.");
            UI.setOpponentStatus(true);
        });

        socket.on('turn_result', (data) => {
            const finalState = data.state;
            const events = data.events || [];

            // Sync Kernel state
            kernel.state = finalState;

            committed = false;
            pendingAction = null;

            UI.animateResolution(currentState, events, finalState, myRole, () => {
                currentState = finalState;
                UI.hideOverlay();
                UI.setOpponentStatus(false);
                UI.setLocked(false);
                UI.render(currentState, myRole);
            });
        });

        socket.on('game_over', (data) => {
            UI.showOverlay("GAME OVER", data.msg, () => {
                window.location.reload();
            }, "RESTART");
        });
    }

    function clonedEvent(name, detail) {
        return new CustomEvent(name, { detail });
    }
})();
