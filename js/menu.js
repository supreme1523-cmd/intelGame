
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

    const playBtn = document.getElementById('play-btn');
    const modeList = document.getElementById('mode-list');
    const createRoomBtn = document.getElementById('create-room-btn');
    const joinRoomBtn = document.getElementById('join-room-btn');
    const roomInput = document.getElementById('room-input');
    const roomError = document.getElementById('room-error');
    const displayRoomCode = document.getElementById('display-room-code');
    const cancelRoomBtn = document.getElementById('cancel-room-btn');
    const backBtns = document.querySelectorAll('.back-btn');

    let currentScreen = 'landing';

    function init() {
        playBtn.addEventListener('click', () => showScreen('options'));

        // Inject Modes based on Flags
        renderModes();

        createRoomBtn.addEventListener('click', handleCreateRoom);
        joinRoomBtn.addEventListener('click', handleJoinRoom);
        cancelRoomBtn.addEventListener('click', handleCancelRoom);

        backBtns.forEach(btn => {
            btn.addEventListener('click', handleBack);
        });

        // Listen for match start to hide menu
        window.addEventListener('match_started', () => {
            menuSystem.classList.add('hidden');
        });

        // Listen for room created (from server via game.js)
        window.addEventListener('room_created', (e) => {
            displayRoomCode.innerText = e.detail.code;
            showScreen('lobby');
        });

        window.addEventListener('join_failed', (e) => {
            showError(e.detail.message);
        });
    }

    function renderModes() {
        modeList.innerHTML = '';

        if (FLAGS.FRIEND_PLAY) {
            addModeBtn('PLAY WITH A FRIEND', () => showScreen('room'));
        }

        if (FLAGS.MATCHMAKING) {
            addModeBtn('MATCHMAKING', () => console.log('Matchmaking...'));
        }

        if (FLAGS.AI_MODE) {
            addModeBtn('TRAINING (AI)', () => console.log('AI mode...'));
        }
    }

    function addModeBtn(text, onClick) {
        const btn = document.createElement('button');
        btn.className = 'glow-btn large';
        btn.innerText = text;
        btn.onclick = onClick;
        modeList.appendChild(btn);
    }

    function showScreen(name) {
        Object.values(screens).forEach(s => s.classList.add('hidden'));
        screens[name].classList.remove('hidden');
        currentScreen = name;
        hideError();
    }

    function handleBack() {
        if (currentScreen === 'lobby') showScreen('room');
        else if (currentScreen === 'room') showScreen('options');
        else if (currentScreen === 'options') showScreen('landing');
    }

    function handleCreateRoom() {
        window.dispatchEvent(new CustomEvent('request_create_room'));
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
        window.dispatchEvent(new CustomEvent('request_cancel_room'));
        showScreen('room');
    }

    function showError(msg) {
        roomError.innerText = msg;
        roomError.classList.remove('hidden');
    }

    function hideError() {
        roomError.classList.add('hidden');
    }

    init();
})();
