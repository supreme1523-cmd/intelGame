# Shared Intent Arena

Deterministic. Hidden. Strategic.

## Technical Architecture

### 🧠 Feature Flag System
The game uses a future-proof menu system controlled by feature flags in `js/config.js`. This allows the UI to feel finished while hiding features that are currently in development.

**How to enable future modes:**
1. Open `js/config.js`.
2. Toggle the desired flag in the `FLAGS` object:
   ```javascript
   FLAGS: {
       FRIEND_PLAY: true,    // Currently Active
       MATCHMAKING: false,   // Set to true to show in UI
       AI_MODE: false,       // Set to true to show in UI
       RANKED: false         // Set to true to show in UI
   }
   ```
3. The Menu System will automatically render the new buttons on the Select Mode screen.

### 🔑 Room System
The **Friend Play** mode uses a 6-digit alphanumeric room code system.
- **Create Room**: Generates a unique code and enters a lobby.
- **Join Room**: Requires an exact match of the 6-digit code.
- **Lobby**: Automated transition to match start once both players are present.

### UI/UX Flow
- **Landing**: Minimalist [ PLAY ] entrance.
- **Options**: Context-aware mode selection.
- **Friend Play**: Dedicated zone for code generation and entry.
- **Match**: The classic 3-column strategic grid.

## Development
Run the server locally:
```bash
npm start
```
Default port is 3000.

## 🎮 How to Play
**Objective**: Reduce opponent's Health to 0 OR checkmate them (remove all legal moves).

### Map: Strategic Arena
- **Grid Size**: 16x16 Symmetrical.
- **Resource Tiles**: Interactive zones that provide benefits.
    - **ENERGY (⚡)**: +1 Energy.
    - **HEAL (🩹)**: +1 HP.
    - **SPECIAL (🌟)**: Energy Refill + Next Action Free!
- **Rules**:
    - **Contest**: If both players land on the same tile simultaneously, the resource is lost for that cycle.
    - **Symmetry**: Resources are perfectly mirrored for absolute fairness.
    - **Cooldowns**: Tiles deactivate for several turns after harvesting.

### Turn Structure
The game is played in **Hotseat Mode** on a single device.
1.  **Player 1 Planning**: Secretly choose your action. Click **COMMIT**.
2.  **Pass Device**: Screen shows an overlay.
3.  **Player 2 Planning**: Secretly choose your action. Click **COMMIT**.
4.  **Resolution**: Watch the turn play out simultaneously.

### Actions
- **MOVE (1 Energy)**: Move 1 tile in a cardinal direction.
- **ATTACK (1 Energy)**: Attack adjacent tile in a direction. Hits if enemy is there at the end of the move phase.
- **DEFEND (1 Energy)**: Gain a Shield. Negates incoming damage.
- **ABILITIES (Varies)**: Shared pool. Once picked, it's gone!
    - **BLINK (2 NRG)**: Teleport 2 tiles (ignore obstacles).
    - **JAM (3 NRG)**: Cancel opponent's action.
    - **RECHARGE (0 NRG)**: Restore +2 EXTRA Energy.

### Rules of Engagement
- **Collision**: If both move to the same tile, they **BOUNCE** (stay put).
- **Head-on**: If players swap tiles, they **BOUNCE**.
- **Determinism**: No RNG. Resolution order is:
    1.  Deduct Energy.
    2.  Apply Defenses/Jam.
    3.  Calculate Movement Intent.
    4.  Resolve Collisions (Bounces).
    5.  Resolves Attacks/Damage.

## 🛠 Extension & Modding
- **`js/logic.js`**: Contains the "Truth". Edit `RESOLVE TURN` to add new interactions.
- **`js/ui.js`**: Pure rendering.
- **`js/game.js`**: Control loop.

## 🚀 Running (Multiplayer)
This version uses a Node.js server.
1.  Install dependencies: `npm install`
2.  Start server: `node server/index.js`
3.  Open `http://localhost:3000` in **two separate tabs**.
4.  Tab 1 will be Player 1. Tab 2 will be Player 2.

## 🏗 Architecture
- **Server**: Authoritative Node.js + Socket.io. Manages `matches` and resolves turns using `GameLogic.resolveTurn`.
- **Client**: Minimal "Dumb" terminal. Sends intent (`submit_action`), receives state updates (`turn_result`).
- **Shared Logic**: `js/logic.js` is a Universal Module used by both to ensure rules are identical.

## ⚖️ Fairness & Security
- **Server Authority**: Clients only verify local energy. The Server performs the actual reduction and resolution. Cheating client-side only desyncs the cheater.
- **Hidden Intent**: Actions are not broadcast until **BOTH** players have committed. It is impossible to sniff packets to see the opponent's move before committing yours.

## 🧠 Strategic Depth
- **Repeated Action Penalty**: Repeating the same action (Move/Attack/Defend) consecutively costs **+1 Energy**.
- **Forced Variation Bonus**: Use different action types to gain **+1 Energy Regen** bonus.
- **Resource Competition**: Controlling the center tiles (Special/Heal) is vital, but over-specializing in one type triggers an **Overuse Penalty** (+1 Energy cost).
- **Simultaneous Resolution**: Every turn is a mind game of predicting where tiles will be and where the opponent is moving to contest them.

## 🛠 Local Testing
- Open two browser windows side-by-side.
- Actions are "Hidden" until both commit.
- Server logs will show resolution steps.
