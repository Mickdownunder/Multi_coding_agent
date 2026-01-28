# Control System

A state-machine-driven system for autonomously planning, implementing, and verifying software changes.

## Purpose

This system enables autonomous software development workflows using explicit state transitions. The system operates entirely through files in the `/control` directory, with no chat-based coordination or implicit decisions.

## How It Works

- **State-driven**: The system follows explicit state transitions (PLAN → IMPLEMENT → VERIFY → DONE)
- **File-based control**: All control is managed via files in `/control`:
  - `state.txt` - Current system state
  - `intent.md` - System goals and objectives
  - `rules.md` - System invariants and constraints
  - `plan.md` - Current implementation plan
  - `report.md` - Verification reports
- **Local-first**: Runs entirely on local filesystem (MacBook)
- **Git-tracked**: All changes are observable via Git

## Running Locally

```bash
npm install
npm run dev
```

The dashboard will be available at `http://localhost:3000` (or next available port).

## Control Dashboard

The dashboard provides:
- Current state display
- State transition controls
- Control file viewer (markdown rendering)
- Editing capability for `intent.md` and `rules.md`

## Constraints

- No chat-based coordination
- No silent file creation or deletion
- All actions must be observable via Git or control files
- No background automation without explicit state
