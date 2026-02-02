
const io = require('socket.io-client');
const assert = require('assert');

const URL = 'http://localhost:3000';

const client1 = io(URL);
const client2 = io(URL);

let p1Role = null;
let p2Role = null;
let matchState = null;

console.log("Starting Multiplayer Simulation...");

client1.on('connect', () => {
    console.log("Client 1 Connected");
});

client2.on('connect', () => {
    console.log("Client 2 Connected");
});

// Match Start
client1.on('match_start', (data) => {
    console.log(`Client 1 assigned: ${data.role}`);
    p1Role = data.role;
    if (p1Role && p2Role) startTurn();
});

client2.on('match_start', (data) => {
    console.log(`Client 2 assigned: ${data.role}`);
    p2Role = data.role;
    if (p1Role && p2Role) startTurn();
});

function startTurn() {
    console.log("\n--- Starting Turn 1 ---");
    // P1 Moves Right
    // P2 Moves Left
    // They should collide if moving 1 step?
    // P1 (0,0) -> (1,0) (Right)
    // P2 (4,4) -> (3,4) (Left)
    // No collision yet.

    console.log("Submitting P1 Action: MOVE RIGHT");
    client1.emit('submit_action', { type: 'move', dir: 'right', cost: 1 });

    setTimeout(() => {
        console.log("Submitting P2 Action: MOVE LEFT");
        client2.emit('submit_action', { type: 'move', dir: 'left', cost: 1 });
    }, 500);
}

// Listen for updates
let resolved = 0;
const checkDone = () => {
    resolved++;
    if (resolved === 2) {
        console.log("\nSUCCESS: Both clients received Turn Resolution.");
        console.log("Simulation passed.");
        client1.close();
        client2.close();
        process.exit(0);
    }
};

client1.on('turn_result', (data) => {
    console.log("Client 1 received Result.");
    // Verify P1 moved
    // P1 start (0,0) + Right = (1,0)
    const p1 = data.state.players.p1;
    if (p1.x === 1 && p1.y === 0) {
        console.log("  CHECK: P1 Position Verified (1,0)");
    } else {
        console.error("  FAIL: P1 Position is", p1.x, p1.y);
        process.exit(1);
    }
    checkDone();
});

client2.on('turn_result', (data) => {
    console.log("Client 2 received Result.");
    checkDone();
});

// Timeout
setTimeout(() => {
    console.error("TIMEOUT: Simulation failed to complete in 5s");
    process.exit(1);
}, 5000);
