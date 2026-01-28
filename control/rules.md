PLAN
# Rules

## Invariants
- The system must be driven by explicit state transitions
- No agent may act outside its designated phase
- No silent file creation or deletion
- All actions must be observable via Git or control files

## Forbidden
- Agents communicating via chat
- Implicit decisions not written to disk
- Background automation without explicit state

## Definition of Done (for any run)
- state.txt is set to DONE
- No missing required control files
- Repository is in a clean, runnable state
