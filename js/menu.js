
(function () {
    const { FLAGS } = window.GameConfig;

    // Elements
    const menuSystem = document.getElementById('menu-system');
    const screens = {
        landing: document.getElementById('landing-screen'),
        options: document.getElementById('options-screen'),
        room: document.getElementById('room-screen'),
        lobby: document.getElementById('lobby-screen')
    };

    const playFriendBtn = document.getElementById('play-friend-btn');
    const playAiBtn = document.getElementById('play-ai-btn');
    const playRandomBtn = document.getElementById('play-random-btn');
    const lobbyTitle = document.getElementById('lobby-title');
    const roomCodeGroup = document.getElementById('room-code-group');
    const modeList = document.getElementById('mode-list');
    const createRoomBtn = document.getElementById('create-room-btn');
    const joinRoomBtn = document.getElementById('join-room-btn');
    const roomInput = document.getElementById('room-input');
    const roomError = document.getElementById('room-error');
    const displayRoomCode = document.getElementById('display-room-code');
    const cancelRoomBtn = document.getElementById('cancel-room-btn');
    const fallbackArea = document.getElementById('lobby-fallback-area');
    const fallbackBotBtn = document.getElementById('fallback-bot-btn');
    const backBtns = document.querySelectorAll('.back-btn');

    let currentScreen = 'landing';
    let isMatchmaking = false;
    let fallbackTimer = null;

    function init() {
        if (playFriendBtn) {
            playFriendBtn.addEventListener('click', () => showScreen('room'));
        }
        if (playAiBtn) {
            playAiBtn.addEventListener('click', () => {
                showDifficultySelection(); // Trigger difficulty selection
                showScreen('options');
            });
        }
        if (playRandomBtn) {
            playRandomBtn.addEventListener('click', handleStartMatchmaking);
        }



        createRoomBtn.addEventListener('click', handleCreateRoom);
        joinRoomBtn.addEventListener('click', handleJoinRoom);
        cancelRoomBtn.addEventListener('click', handleCancelRoom);

        if (fallbackBotBtn) {
            fallbackBotBtn.addEventListener('click', () => {
                handleCancelRoom(); // Stop socket matchmaking
                window.dispatchEvent(clonedEvent('request_ai_match', { difficulty: 'Medium' }));
            });
        }

        backBtns.forEach(btn => {
            btn.addEventListener('click', handleBack);
        });

        // Listen for match matchmaking status (from server via game.js)
        window.addEventListener('matchmaking_queued', () => {
            isMatchmaking = true;
            lobbyTitle.innerText = "MATCHMAKING";
            if (roomCodeGroup) roomCodeGroup.classList.add('hidden');
            showScreen('lobby');
        });

        // Listen for match start to hide menu
        window.addEventListener('match_started', () => {
            menuSystem.classList.add('hidden');
            const app = document.getElementById('app');
            if (app) app.classList.remove('hidden');
            isMatchmaking = false; // Reset
        });

        // Listen for room created (from server via game.js)
        window.addEventListener('room_created', (e) => {
            isMatchmaking = false;
            lobbyTitle.innerText = "ROOM LOBBY";
            if (roomCodeGroup) roomCodeGroup.classList.remove('hidden');
            displayRoomCode.innerText = e.detail.code;
            showScreen('lobby');
        });

        window.addEventListener('join_failed', (e) => {
            showError(e.detail.message);
        });
    }

    // renderModes removed as it is now redundant.

    function addModeBtn(text, onClick) {
        const btn = document.createElement('button');
        btn.className = 'glow-btn large';
        btn.innerText = text;
        btn.onclick = onClick;
        modeList.appendChild(btn);
    }

    function showDifficultySelection() {
        modeList.innerHTML = '';
        const title = document.querySelector('#options-screen h2');
        const originalTitle = title.innerText;
        title.innerText = 'SELECT DIFFICULTY';

        ['Easy', 'Medium', 'Hard', 'Expert'].forEach(level => {
            addModeBtn(level.toUpperCase(), () => {
                title.innerText = originalTitle;
                window.dispatchEvent(clonedEvent('request_ai_match', { difficulty: level }));
            });
        });

        const back = document.createElement('button');
        back.className = 'back-btn';
        back.innerText = '← BACK TO MODES';
        back.onclick = () => {
            title.innerText = originalTitle;
            showScreen('landing');
        };
        modeList.appendChild(back);
    }

    function showScreen(name) {
        Object.values(screens).forEach(s => s.classList.add('hidden'));
        screens[name].classList.remove('hidden');
        currentScreen = name;
        hideError();

        // Fallback Logic
        if (name === 'lobby' && isMatchmaking) {
            if (fallbackArea) fallbackArea.classList.add('hidden');
            if (fallbackTimer) clearTimeout(fallbackTimer);
            fallbackTimer = setTimeout(() => {
                if (isMatchmaking && currentScreen === 'lobby' && fallbackArea) {
                    fallbackArea.classList.remove('hidden');
                }
            }, 10000); // 10 seconds
        } else {
            if (fallbackTimer) clearTimeout(fallbackTimer);
        }
    }

    function handleBack() {
        if (currentScreen === 'lobby') showScreen('room');
        else if (currentScreen === 'room') showScreen('landing');
        else if (currentScreen === 'options') showScreen('landing');
    }

    function handleCreateRoom() {
        window.dispatchEvent(new CustomEvent('request_create_room'));
    }

    function handleStartMatchmaking() {
        window.dispatchEvent(new CustomEvent('request_start_matchmaking'));
    }

    function handleJoinRoom() {
        const code = roomInput.value.trim().toUpperCase();
        if (code.length !== 6) {
            showError("INVALID CODE (6 DIGITS)");
            return;
        }
        window.dispatchEvent(new CustomEvent('request_join_room', { detail: { code } }));
    }

    function handleCancelRoom() {
        if (isMatchmaking) {
            window.dispatchEvent(new CustomEvent('request_cancel_matchmaking'));
            showScreen('landing');
        } else {
            window.dispatchEvent(new CustomEvent('request_cancel_room'));
            showScreen('room');
        }
        isMatchmaking = false;
    }

    function showError(msg) {
        roomError.innerText = msg;
        roomError.classList.remove('hidden');
    }

    function hideError() {
        roomError.classList.add('hidden');
    }

    function clonedEvent(name, detail) {
        return new CustomEvent(name, { detail });
    }

    init();
})();
