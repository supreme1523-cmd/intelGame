# 🎮 Shared Intent Arena - Gameplay & Mechanics

Welcome to **Shared Intent Arena**, a strategic, deterministic, simultaneous-turn grid game. This document explains the core systems, movement rules, energy management, and combat logic.

---

## 🕹️ Core Game Loop
Shared Intent Arena uses a **Simultaneous Turn Resolution** system.
1.  **Planning Phase**: Both players choose their action (Move, Attack, or Defend) in secret.
2.  **Commitment**: Actions are hidden until both players click **Lock Intent**.
3.  **Resolution**: Both actions play out at the exact same time. The game calculates positioning, collisions, and combat results based on the combined logic of both intents.

---

## 🗺️ The Arena (16x16 Grid)
The game is played on a perfectly symmetrical 16x16 board.

### 💎 Resource Tiles
Resources are mirrors of each other, ensuring absolute fairness.
- **ENERGY (⚡)**: Restores **+1 Energy**. (Cooldown: 3 turns)
- **HEAL (🩹)**: Restores **+1 HP**. (Cooldown: 6 turns)
- **SPECIAL (🌟)**: Instantly **Refills Energy** to maximum and grants a **-1 Energy Cost** bonus for your next action. (Cooldown: 10 turns)

### 🚩 Resource Competition
- **Harvesting**: Land on a tile to gain its benefit.
- **Contest**: If both players land on the SAME tile in the same turn, the resource is **Contested**. Both players miss out, and the tile goes on cooldown immediately.

---

## ⚡ Energy & Economy
Everything revolves around Energy. You start with 5 NRG (Max: 5).

### 🔋 Energy Regeneration
Energy generates automatically every turn:
- **Default Regen**: +1 NRG per turn.
- **Variety Bonus**: If your action type is **different** from your previous turn, you gain **+2 NRG** instead.

### 💰 Action Costs
- **Move**: 1 Energy
- **Attack**: 1 Energy
- **Defend**: 1 Energy

### 📉 Penalties & Modifiers
- **Repetition Penalty**: Using the **same action type** (e.g., Move → Move) makes the second action cost **+1 extra Energy**.
- **Fatigue Penalty**: Harvesting the same resource type too frequently (e.g., Energy → Move → Energy) triggers Fatigue, increasing your next action's cost by **+1**.
- **Special Bonus**: Harvesting a Special (🌟) tile reduces your next action's cost by **-1**.

---

## ⚔️ Combat & Health
**Objective**: Reduce the opponent's Health (HP) to 0. Both players start with 5 HP.

### 🔴 Attacking
- Attacks target an adjacent cardinal tile (Up, Down, Left, Right).
- An attack **Hits** if the opponent is occupying that target tile at the end of the movement phase.
- **Simultaneous Combat**: If both players hit each other at the same time, both take damage.

### 🛡️ Defending (Shield)
- Choosing **DEFEND** grants a Shield for that turn.
- A Shield negates **all incoming damage** for the turn.
- Note: Defending also triggers the Repetition Penalty if used back-to-back.

---

## 🚶 Movement & Collisions
### 💥 Collision Rules
Since both players move at once, collisions can occur:
- **Bounces**: If both players attempt to move into the **same tile**, they both bounce back to their starting positions.
- **Swapping**: If players attempt to "pass through" each other by swapping tiles, they collide and bounce back.
- **Obstacles**: You cannot move outside the 16x16 grid.

---

## 🤖 Game Modes
### 1. Multiplayer (Networked)
- Play against other players globally.
- Features private rooms (Room Codes) and public matchmaking.
- **Fallback Timer**: If matchmaking takes longer than 10 seconds, you can choose to **Play vs Bot** immediately.

### 2. Training (AI)
Practice against the computer.
- **Easy**: Uses basic logic and some randomness.
- **Medium**: Balanced play.
- **Hard**: Advanced positioning.
- **Expert**: Uses high-depth Minimax search (Iterative Deepening) to calculate the optimal move within 400ms.

---

## 📖 Summary of Intent
The game is as much about **predicting your opponent** as it is about managing your resources. Do you move to harvest energy, or do you stay put and shield, predicting an attack? Every turn is a mind game.
