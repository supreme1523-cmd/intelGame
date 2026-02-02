
(function () {
    const { CONSTANTS, DIRECTIONS, ABILITIES } = window.GameLogic;

    const gridEl = document.getElementById('game-grid');
    const overlayEl = document.getElementById('overlay-message');
    const overlayText = document.getElementById('overlay-text');
    let nextBtn = document.getElementById('next-phase-btn');
    const logEl = document.getElementById('log-content');
    const commitBtn = document.getElementById('commit-btn');
    const dPad = document.getElementById('direction-pad');
    const actionBtns = document.querySelectorAll('.action-btn');
    const abilityTrack = document.getElementById('ability-track');
    const dBtns = document.querySelectorAll('.d-btn');

    const actionDock = document.querySelector('.controls-area');
    const onboardingOverlay = document.getElementById('onboarding-overlay');

    let onInputCallback = null;
    let onCommitCallback = null;
    let selectedActionType = null;

    function init(onInput, onCommit) {
        onInputCallback = onInput;
        onCommitCallback = onCommit;

        // Action Buttons
        actionBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                // UI Toggle
                actionBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');

                // Also clear ability btns
                document.querySelectorAll('.ability-btn').forEach(b => b.classList.remove('active'));

                const type = btn.dataset.type;
                selectedActionType = type;

                if (type === 'move' || type === 'attack') {
                    dPad.classList.remove('hidden');
                    disableCommit(); // Force checking direction
                } else {
                    dPad.classList.add('hidden');
                    onInputCallback(type, {}); // No direction needed for defend
                    enableCommit();
                }
            });
        });

        // Direction Buttons
        dBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                if (!selectedActionType) return; // Should be handled by ability too logic? 
                // Wait, if ability is selected, selectedActionType is 'ability' (my hack).
                const dir = btn.dataset.dir;
                onInputCallback(selectedActionType, { dir });
                enableCommit();
            });
        });

        // Commit
        commitBtn.addEventListener('click', () => {
            if (!commitBtn.classList.contains('disabled')) {
                disableCommit();
                selectedActionType = null;
                actionBtns.forEach(b => b.classList.remove('active'));
                document.querySelectorAll('.ability-btn').forEach(b => b.classList.remove('active'));
                dPad.classList.add('hidden');
                onCommitCallback();
            }
        });
    }

    function enableCommit() {
        commitBtn.classList.remove('disabled');
    }

    function disableCommit() {
        commitBtn.classList.add('disabled');
    }

    function hideOnboarding() {
        onboardingOverlay.classList.add('hidden');
    }

    function setLocked(isLocked) {
        if (isLocked) {
            actionDock.classList.add('locked');
        } else {
            actionDock.classList.remove('locked');
        }
    }

    function render(state, perspective, events) {
        // 0. Render Abilities
        abilityTrack.innerHTML = '';
        state.abilities.forEach(id => {
            const btn = document.createElement('button');
            const info = ABILITIES[id];
            btn.classList.add('action-btn', 'ability-btn');
            btn.innerText = `${info.name} (${info.cost})`;
            btn.title = info.desc;
            btn.dataset.id = id;

            btn.addEventListener('click', () => {
                actionBtns.forEach(b => b.classList.remove('active'));
                document.querySelectorAll('.ability-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');

                onInputCallback('ability', { id: id });

                selectedActionType = 'ability'; // Allow d-pad

                if (id === 'blink') {
                    dPad.classList.remove('hidden');
                    disableCommit();
                } else {
                    dPad.classList.add('hidden');
                    enableCommit();
                }
            });

            abilityTrack.appendChild(btn);
        });

        // 1. Grid
        gridEl.innerHTML = '';

        for (let y = 0; y < CONSTANTS.GRID_SIZE; y++) {
            for (let x = 0; x < CONSTANTS.GRID_SIZE; x++) {
                const cell = document.createElement('div');
                cell.classList.add('cell');
                cell.dataset.x = x;
                cell.dataset.y = y;

                const tileKey = `${x},${y}`;
                const tile = state.tiles[tileKey];
                if (tile) {
                    cell.classList.add(tile.type);
                    if (tile.cooldown > 0) {
                        cell.classList.add('cooldown');
                        cell.innerText = tile.cooldown;
                    } else {
                        const icon = document.createElement('span');
                        icon.classList.add('tile-icon');
                        icon.innerText = tile.type === 'energy' ? '⚡' :
                            tile.type === 'heal' ? '🩹' : '🌟';
                        cell.appendChild(icon);
                    }

                    // Check if contested (if we want to show it after turn resolution)
                    // Currently, log handles it, but we could add a flag to state.
                }

                // Render Units
                if (state.players.p1.x === x && state.players.p1.y === y) {
                    const p1 = document.createElement('div');
                    p1.classList.add('unit', 'p1');
                    if (state.players.p1.shield) p1.style.border = '3px solid white';
                    cell.appendChild(p1);
                }
                if (state.players.p2.x === x && state.players.p2.y === y) {
                    const p2 = document.createElement('div');
                    p2.classList.add('unit', 'p2');
                    if (state.players.p2.shield) p2.style.border = '3px solid white';
                    cell.appendChild(p2);
                }

                gridEl.appendChild(cell);
            }
        }

        // 2. HUDs
        updateHud('p1', state.players.p1);
        updateHud('p2', state.players.p2);

        // 3. Phase Indicator
        document.getElementById('phase-indicator').innerText = `TURN ${state.turn}: ${perspective.toUpperCase()}`;

        // 4. Action Log
        if (state.log && state.log.length > 0) {
            const logContent = document.getElementById('log-content');
            logContent.innerHTML = state.log.map(l => `<div class="log-line">${l}</div>`).join('');
            logContent.scrollTop = logContent.scrollHeight;
        }
    }

    function updateHud(id, pState) {
        const hpBar = document.getElementById(`${id}-hp-bar`);
        const nrgBar = document.getElementById(`${id}-nrg-bar`);
        const hpVal = document.getElementById(`${id}-hp-val`);
        const nrgVal = document.getElementById(`${id}-nrg-val`);

        const hpPct = (pState.hp / CONSTANTS.MAX_HP) * 100;
        const nrgPct = (pState.nrg / CONSTANTS.MAX_ENERGY) * 100;

        hpBar.style.width = `${hpPct}%`;
        nrgBar.style.width = `${nrgPct}%`;

        hpVal.innerText = `${pState.hp}/${CONSTANTS.MAX_HP}`;
        nrgVal.innerText = `${pState.nrg}/${CONSTANTS.MAX_ENERGY}`;
    }

    function appendLog(msg) {
        const d = document.createElement('div');
        d.innerText = `> ${msg}`;
        d.style.borderBottom = "1px solid #333";
        d.style.padding = "4px";
        logEl.prepend(d);
    }

    function showOverlay(title, btnText, onNext) {
        overlayText.innerText = title;
        nextBtn.innerText = btnText;
        overlayEl.classList.remove('hidden');

        const newBtn = nextBtn.cloneNode(true);
        nextBtn.parentNode.replaceChild(newBtn, nextBtn);
        newBtn.addEventListener('click', onNext);
        // CRITICAL FIX: Update the global reference so next call works
        nextBtn = newBtn; // This requires nextBtn to be 'let' not 'const'
    }

    function hideOverlay() {
        overlayEl.classList.add('hidden');
    }

    function updatePreview(player, action) {
        // Placeholder
    }

    // Expose
    window.GameUI = {
        init, render, showOverlay, hideOverlay, updatePreview, appendLog,
        hideOnboarding, setLocked
    };
})();
