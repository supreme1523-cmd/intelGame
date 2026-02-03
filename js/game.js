(function () {
    const { ABILITIES, createInitialState } = window.GameLogic;
    const UI = window.GameUI;

    let socket = null;
    let myRole = null; // 'p1' or 'p2'
    let currentState = null;
    let pendingAction = null;
    let committed = false;

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
        if (committed || !currentState) return;

        let cost = 0;
        let newAction = pendingAction ? { ...pendingAction } : {};

        if (type === 'ability') {
            if (data.id) newAction.id = data.id;
            if (data.dir) newAction.dir = data.dir;
            newAction.type = 'ability';
            if (newAction.id) cost = ABILITIES[newAction.id].cost;
        } else {
            newAction = { type, ...data };
            cost = getActionCost(type);
        }

        // Penalty Approximation (Repeating actions cost +1)
        const myState = currentState.players[myRole];
        if (myState.lastAction && myState.lastAction.type === newAction.type && newAction.type !== 'ability') {
            cost += 1;
        }
        if (myState.harvestPenalty) cost += myState.harvestPenalty;

        newAction.cost = cost;
        pendingAction = newAction;

        UI.updatePreview(myRole, newAction, myState.nrg);
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

    // --- Helpers ---
    function getActionCost(type) {
        const { CONSTANTS } = window.GameLogic;
        if (type === 'move') return CONSTANTS.COST.MOVE;
        if (type === 'attack') return CONSTANTS.COST.ATTACK;
        if (type === 'defend') return CONSTANTS.COST.DEFEND;
        return 0;
    }

})();
