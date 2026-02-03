
# Arena Architecture (Refactored)

This codebase follows a feature-oriented, modular structure designed for scalability.

## 📁 Directory Structure

- **/core-game**: The **Game Kernel**. A deterministic, framework-agnostic engine that manages rules, simultaneous turn resolution, and state snapshots.
- **/matchmaking**: Manages player pairing, room codes, and the waiting queue.
- **/feedback**: Handles persistent player feedback via PostgreSQL and administrative views.
- **/transport**: The "glue" logic. Manages Socket.io events and Express routing.
- **/config**: Centralized settings and environment variable mapping.

## 🏗️ Design Rules

1. **Dependency Inversion**: Core logic must *never* import from transport or database modules.
2. **Single Responsibility**: `matchService` handles state; `socketController` handles communication.
3. **Immutability**: Game state transitions should remain deterministic and functional.

## 🤖 Next Steps (Future Features)

- **Bot Matchmaking**: Can be injected into `/matchmaking/matchmakingService.js`.
- **Ranked System**: Should live in a new `/ranking` directory, independent of transport.
