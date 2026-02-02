(function () {
    const { ABILITIES, createInitialState } = window.GameLogic;
    const UI = window.GameUI;

    let socket = null;
    let myRole = null; // 'p1' or 'p2'
    let currentState = null;
    let pendingAction = null;
    let committed = false;

    // --- Onboarding Transition ---
    document.getElementById('start-game-btn').addEventListener('click', () => {
        UI.hideOnboarding();
        socket = io();
        setupSocketListeners();
    });

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

        // Local validation
        const myState = currentState.players[myRole];
        if (myState.nrg < cost) {
            UI.appendLog(`Not enough energy! Need ${cost}.`);
            return;
        }

        newAction.cost = cost;
        pendingAction = newAction;
        UI.appendLog(`Selected: ${type.toUpperCase()}`);
    }

    function handleCommit() {
        if (!pendingAction) {
            UI.appendLog("Select an action first.");
            return;
        }

        UI.appendLog("Committing action...");
        socket.emit('submit_action', pendingAction);
    }

    // --- Socket Listeners ---
    function setupSocketListeners() {
        socket.on('connect', () => {
            UI.appendLog("Connected. Finding match...");
            UI.showOverlay("CONNECTING", "FINDING OPPONENT...", () => { });
        });

        socket.on('waiting', (data) => {
            UI.showOverlay("LOBBY", data.msg, () => { });
        });

        socket.on('match_start', (data) => {
            myRole = data.role;
            currentState = data.state;
            committed = false;
            pendingAction = null;

            UI.hideOverlay();
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
            UI.appendLog("Opponent is ready.");
        });

        socket.on('turn_result', (data) => {
            currentState = data.state;
            committed = false;
            pendingAction = null;
            UI.setLocked(false);

            // Visual Resolution Delay
            UI.showOverlay("RESOLVING...", "PLEASE WAIT", () => { });
            setTimeout(() => {
                UI.hideOverlay();
                UI.render(currentState, myRole);
            }, 1800);
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
