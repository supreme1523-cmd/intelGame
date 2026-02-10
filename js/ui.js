
(function () {
    const { CONSTANTS, DIRECTIONS, ABILITIES } = window.GameLogic;

    // Elements
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
    const turnNumEl = document.getElementById('turn-num');
    const phaseEl = document.getElementById('phase-indicator');

    // New Elements
    const pendingCard = document.getElementById('pending-action-card');
    const energyPreview = document.getElementById('energy-preview');
    const mainLayout = document.querySelector('.main-layout');

    let onInputCallback = null;
    let onCommitCallback = null;
    let selectedActionType = null;
    let selectedAbilityId = null;
    let currentPerspective = null;
    let initialized = false;

    function init(onInput, onCommit) {
        if (initialized) return;
        onInputCallback = onInput;
        onCommitCallback = onCommit;

        actionBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                actionBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                document.querySelectorAll('.ability-btn').forEach(b => b.classList.remove('active'));

                const type = btn.dataset.type;
                selectedActionType = type;

                if (type === 'move' || type === 'attack') {
                    dPad.classList.remove('hidden');
                    disableCommit();
                } else {
                    dPad.classList.add('hidden');
                    onInputCallback(type, {});
                    enableCommit();
                }
            });
        });

        dBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                if (!selectedActionType || dPad.classList.contains('hidden')) return;

                const dir = btn.dataset.dir;
                const data = { dir };
                if (selectedActionType === 'ability' && selectedAbilityId) {
                    data.id = selectedAbilityId;
                }

                onInputCallback(selectedActionType, data);
                enableCommit();
            });
        });

        commitBtn.addEventListener('click', () => {
            if (!commitBtn.classList.contains('disabled')) {
                onCommitCallback();
                clearSelection();
            }
        });

        const fbBtn = document.getElementById('feedback-btn');
        if (fbBtn) fbBtn.addEventListener('click', () => alert("Thank you for playtesting! Report bugs to the arena master."));

        initialized = true;
    }

    function clearSelection() {
        selectedActionType = null;
        selectedAbilityId = null;
        actionBtns.forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.ability-btn').forEach(b => b.classList.remove('active'));
        dPad.classList.add('hidden');
        disableCommit();

        pendingCard.innerHTML = '<span>NO ACTION SELECTED</span>';
        pendingCard.classList.add('empty');
    }

    function enableCommit() { commitBtn.classList.remove('disabled'); }
    function disableCommit() { commitBtn.classList.add('disabled'); }
    function hideOnboarding() { document.getElementById('onboarding-overlay').classList.add('hidden'); }

    function setLocked(isLocked) {
        if (isLocked) {
            mainLayout.classList.add('locked');
            document.querySelector('.action-bar-overlay').classList.add('locked');
        } else {
            mainLayout.classList.remove('locked');
            document.querySelector('.action-bar-overlay').classList.remove('locked');
        }
    }

    function render(state, perspective) {
        currentPerspective = perspective;
        turnNumEl.innerText = state.turn;
        phaseEl.innerText = `PHASE: PLANNING`;

        const myLabel = document.getElementById('my-role-label');
        if (myLabel) myLabel.innerText = `YOU (${perspective.toUpperCase()})`;

        // Ability Track
        abilityTrack.innerHTML = '';
        state.abilities.forEach(id => {
            const btn = document.createElement('button');
            const info = ABILITIES[id];
            btn.classList.add('action-btn', 'ability-btn');
            btn.innerText = `${info.name}`;
            btn.dataset.id = id;

            btn.addEventListener('click', () => {
                actionBtns.forEach(b => b.classList.remove('active'));
                document.querySelectorAll('.ability-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');

                onInputCallback('ability', { id: id });
                selectedActionType = 'ability';
                selectedAbilityId = id;

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

        renderGrid(state);
        updateHud('p1', state.players.p1);
        updateHud('p2', state.players.p2);

        if (state.log && state.log.length > 0) {
            state.log.forEach(l => appendLog(l, 'recap'));
        }
    }

    function renderGrid(state) {
        gridEl.innerHTML = '';
        for (let y = 0; y < CONSTANTS.GRID_SIZE; y++) {
            for (let x = 0; x < CONSTANTS.GRID_SIZE; x++) {
                const cell = document.createElement('div');
                cell.classList.add('cell');

                const tile = state.tiles[`${x},${y}`];
                if (tile) {
                    cell.classList.add(tile.type);
                    if (tile.cooldown > 0) {
                        cell.classList.add('cooldown');
                        cell.innerText = tile.cooldown;
                    } else {
                        const icon = tile.type === 'energy' ? '⚡' : tile.type === 'heal' ? '🩹' : '🌟';
                        cell.innerHTML = `<span class="tile-icon">${icon}</span>`;
                    }
                }

                if (state.players.p1.x === x && state.players.p1.y === y) {
                    const p1 = document.createElement('div');
                    p1.classList.add('unit', 'p1');
                    if (state.players.p1.shield) p1.style.boxShadow = '0 0 20px white';
                    cell.appendChild(p1);
                }
                if (state.players.p2.x === x && state.players.p2.y === y) {
                    const p2 = document.createElement('div');
                    p2.classList.add('unit', 'p2');
                    if (state.players.p2.shield) p2.style.boxShadow = '0 0 20px white';
                    cell.appendChild(p2);
                }
                gridEl.appendChild(cell);
            }
        }
    }

    function animateResolution(prevState, events, finalState, perspective, callback) {
        phaseEl.innerText = `PHASE: RESOLUTION`;
        let step = 0;
        let tempState = JSON.parse(JSON.stringify(prevState));

        const processNext = () => {
            if (step >= events.length) {
                render(finalState, perspective);
                setTimeout(callback, 800);
                return;
            }

            const event = events[step];
            updateTempState(tempState, event);
            handleAnimateEvent(event, tempState);
            step++;
            setTimeout(processNext, 500);
        };

        processNext();
    }

    function updateTempState(state, ev) {
        if (ev.type === 'move') {
            state.players[ev.player].x = ev.to.x;
            state.players[ev.player].y = ev.to.y;
        }
        if (ev.type === 'hit') {
            state.players[ev.target].hp -= ev.damage;
        }
        if (ev.type === 'harvest') {
            if (ev.tile === 'energy') state.players[ev.player].nrg += 1;
            if (ev.tile === 'heal') state.players[ev.player].hp += 1;
        }
        if (ev.type === 'regen') {
            state.players.p1.nrg = ev.p1;
            state.players.p2.nrg = ev.p2;
        }
    }

    function handleAnimateEvent(ev, tempState) {
        if (ev.type === 'energy') {
            appendLog(`[${ev.player.toUpperCase()}] Energy used: ${ev.cost}`, 'system');
            updateHud(ev.player, tempState.players[ev.player]);
        }
        if (ev.type === 'move') {
            appendLog(`[${ev.player.toUpperCase()}] Moved to ${ev.to.x},${ev.to.y}`, 'action');
            renderGrid(tempState);
        }
        if (ev.type === 'harvest') {
            appendLog(`[HARVEST] ${ev.player.toUpperCase()} got ${ev.tile.toUpperCase()}!`, 'system');
            updateHud(ev.player, tempState.players[ev.player]);
        }
        if (ev.type === 'hit') {
            appendLog(`[COMBAT] ${ev.target.toUpperCase()} took damage!`, 'combat');
            updateHud(ev.target, tempState.players[ev.target]);
            renderGrid(tempState);
            const target = document.querySelector(`.unit.${ev.target}`);
            if (target) {
                target.classList.add('shake');
                setTimeout(() => target.classList.remove('shake'), 500);
            }
        }
        if (ev.type === 'shield') {
            appendLog(`[COMBAT] Attack blocked by shield!`, 'combat');
        }
        if (ev.type === 'collision') {
            appendLog(`[COLLISION] Players bounced!`, 'combat');
            renderGrid(tempState);
        }
    }

    function updateHud(id, pState) {
        const hpBar = document.getElementById(`${id}-hp-bar`);
        const nrgBar = document.getElementById(`${id}-nrg-bar`);
        const hpVal = document.getElementById(`${id}-hp-val`);
        const nrgVal = document.getElementById(`${id}-nrg-val`);

        hpBar.style.width = `${(pState.hp / CONSTANTS.MAX_HP) * 100}%`;
        nrgBar.style.width = `${(pState.nrg / CONSTANTS.MAX_ENERGY) * 100}%`;
        hpVal.innerText = `${pState.hp}/${CONSTANTS.MAX_HP}`;
        nrgVal.innerText = `${pState.nrg}/${CONSTANTS.MAX_ENERGY}`;
    }

    function updatePreview(player, action, currentEnergy) {
        pendingCard.classList.remove('empty');
        const dirIcon = action.dir ? ` <b>${action.dir.toUpperCase()}</b>` : '';
        const name = action.id ? ABILITIES[action.id].name : action.type.toUpperCase();

        pendingCard.innerHTML = `<h4>${name}${dirIcon}</h4><p>COST: ${action.cost}</p>`;

        const remaining = currentEnergy - action.cost;
        energyPreview.innerText = `NRG: ${currentEnergy} ➔ ${remaining}`;
        energyPreview.style.color = remaining < 0 ? 'red' : 'var(--accent)';
    }

    function appendLog(msg, type = '') {
        const d = document.createElement('div');
        d.classList.add('log-line');
        if (type) d.classList.add(type);
        d.innerHTML = `<span class="time">[${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}]</span> ${msg}`;
        logEl.prepend(d);
        logEl.scrollTop = 0;
    }

    function showOverlay(title, btnText, onNext) {
        overlayText.innerText = title;
        nextBtn.innerText = btnText;
        overlayEl.classList.remove('hidden');
        const newBtn = nextBtn.cloneNode(true);
        nextBtn.parentNode.replaceChild(newBtn, nextBtn);
        newBtn.addEventListener('click', onNext);
        nextBtn = newBtn;
    }

    function hideOverlay() { overlayEl.classList.add('hidden'); }

    // Expose
    window.GameUI = {
        init, render, showOverlay, hideOverlay, updatePreview, appendLog,
        hideOnboarding, setLocked, animateResolution
    };
})();
