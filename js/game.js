
(function () {
    const UI = window.GameUI;
    const { ABILITIES } = window.KernelConfigs;

    let socket = null;
    let myRole = null; // 'p1' or 'p2'
    let currentState = null;
    let pendingAction = null;
    let committed = false;
    let kernel = null;

    // --- Menu Integration ---
    window.addEventListener('request_create_room', () => {
        ensureSocket();
        socket.emit('create_room');
    });

    window.addEventListener('request_join_room', (e) => {
        ensureSocket();
        socket.emit('join_room', { code: e.detail.code });
    });

    window.addEventListener('request_start_matchmaking', () => {
        ensureSocket();
        socket.emit('start_matchmaking');
    });

    window.addEventListener('request_cancel_matchmaking', () => {
        if (socket) socket.emit('cancel_matchmaking');
    });

    window.addEventListener('request_cancel_room', () => {
        if (socket) socket.emit('cancel_room');
    });

    function ensureSocket() {
        if (!socket) {
            socket = io();
            setupSocketListeners();
        }
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
        socket.emit('submit_action', pendingAction);
    }

    // --- Socket Listeners ---
    function setupSocketListeners() {
        socket.on('connect', () => {
            UI.appendLog("Connected to server.");
        });

        socket.on('room_created', (data) => {
            window.dispatchEvent(new CustomEvent('room_created', { detail: data }));
        });

        socket.on('join_failed', (data) => {
            window.dispatchEvent(new CustomEvent('join_failed', { detail: data }));
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
})();
