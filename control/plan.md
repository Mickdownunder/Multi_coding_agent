# Autonomous Code Execution System

## Vision: From Plan to Code to DONE - Fully Autonomous

Das System muss von A bis Z selbstständig coden können:
1. **PLAN** → Liest intent.md, generiert plan.md
2. **IMPLEMENT** → Liest plan.md, generiert Code, committet in Git
3. **VERIFY** → Prüft Code gegen rules.md, erstellt report.md
4. **DONE** → Alles verifiziert, System bereit

**Wichtig:** 
- **User ↔ KI**: Chat ist OK (Brainstorming, Ideen entwickeln)
- **KI ↔ Agenten**: Strukturiert über Files (intent.md, plan.md)
- **Agent ↔ Agent**: NICHT erlaubt (nur über State Machine)

## Die Kommunikations-Architektur

### User ↔ Intent Assistant (KI) - CHAT ERLAUBT
```
User: "Ich will eine Todo-App bauen"
KI: "Okay, welche Features brauchst du?"
User: "Tasks erstellen, löschen, erledigen"
KI: "Frontend oder Backend?"
User: "Beides, React + Express"
KI: "Perfekt, ich schreibe das in intent.md"
→ KI schreibt intent.md
```

### Intent Assistant ↔ Agenten - NUR FILES
```
Intent Assistant schreibt intent.md
    ↓
PLAN Agent liest intent.md (kein Chat!)
    ↓
PLAN Agent schreibt plan.md
    ↓
IMPLEMENT Agent liest plan.md (kein Chat!)
```

### Agent ↔ Agent - VERBOTEN
```
❌ IMPLEMENT Agent fragt PLAN Agent per Chat
✅ IMPLEMENT Agent liest plan.md (File)
✅ State Machine koordiniert über state.txt
```

## Phase 1: Intent Assistant (User ↔ KI Chat)
1. Create Intent Assistant UI component
   - Chat interface im Dashboard
   - User kann brainstormen, Fragen stellen
   - KI antwortet und hilft bei Intent-Formulierung
   - KI schreibt automatisch intent.md basierend auf Chat

2. Intent Assistant Backend
   - API endpoint `/api/assistant/chat`
   - Nimmt User-Nachricht, Chat-History
   - KI generiert Antwort
   - KI kann intent.md vorschlagen/aktualisieren
   - Keine direkte Kommunikation mit Agenten

3. Intent Generation from Chat
   - KI analysiert Chat-Conversation
   - Extrahiert: Goals, Requirements, Constraints
   - Generiert strukturiertes intent.md
   - Zeigt Preview vor dem Schreiben
   - User kann anpassen

4. Interactive Intent Refinement
   - KI stellt Fragen: "Brauchst du Authentication?"
   - User antwortet
   - KI aktualisiert intent.md
   - Iterativ bis User zufrieden ist

## Phase 2: Execution Monitoring (KI ↔ User während Execution)
5. Execution Feedback Loop
   - Während IMPLEMENT: KI kann Fragen stellen
   - "Soll ich TypeScript oder JavaScript verwenden?"
   - User antwortet → KI aktualisiert plan.md
   - Agent liest aktualisiertes plan.md

6. Progress Updates
   - KI zeigt User was gerade passiert
   - "Implementiere gerade: User Authentication"
   - "Frage: Welche Auth-Provider?"
   - User antwortet → Weiter

7. Error Handling with User
   - Wenn Agent Fehler hat → KI fragt User
   - "Plan Item 5 fehlgeschlagen. Wie weiter?"
   - User gibt Anweisung → KI aktualisiert plan.md
   - Agent retry

## Phase 3: Intent Parser & Command Interface
8. Create intent parser
   - Parse intent.md structured format
   - Extract: Goal, Requirements, Constraints, Success Criteria
   - Validate intent completeness
   - Generate structured intent object

9. Intent templates system
   - Create `/control/templates/` directory
   - Pre-built templates for common tasks
   - Template variables (e.g., {{projectName}})
   - Template validation

10. Intent editor in dashboard
    - Rich text editor for intent.md
    - Chat-Assistant neben Editor
    - Auto-complete for common patterns
    - Validation as you type
    - Preview generated plan

11. Command syntax
    - Structured markdown format
    - Required sections: Goal, Requirements
    - Optional: Constraints, Success Criteria, Examples
    - Validation rules

## Phase 4: Plan Generator (PLAN Agent)
12. PLAN Agent reads intent.md
    - Parse intent structure
    - Extract requirements
    - Break down into phases
    - Generate numbered steps
    - **KEIN Chat mit User oder anderen Agenten**

13. Plan generation logic
    - For each requirement → create phase
    - For each phase → create steps
    - Add validation steps
    - Add verification steps
    - Ensure plan follows rules.md

14. Plan templates
    - Different plan structures for different intents
    - API projects → API plan template
    - Frontend projects → Frontend plan template
    - Library projects → Library plan template

15. Plan validation
    - Check all requirements covered
    - Check constraints respected
    - Check success criteria measurable
    - Auto-fix common issues

## Phase 5: Execution Engine Core
16. Create `/execution` directory structure
    - `execution/engine.ts` - Main execution loop
    - `execution/agents/` - State-specific agents
    - `execution/utils/` - Helper functions
    - `execution/config.ts` - Configuration

17. State watcher service
    - Watch `/control/state.txt` for changes
    - Trigger appropriate agent when state changes
    - Run continuously in background (Next.js API route or separate process)
    - Log all actions to `/control/execution.log`

18. Agent base class
    - Abstract Agent class with lifecycle hooks
    - `onEnter()` - Called when state entered
    - `execute()` - Main execution logic
    - `onExit()` - Called when state exited
    - `validate()` - Check if agent can run
    - **Agents kommunizieren NUR über Files, NICHT per Chat**

## Phase 6: IMPLEMENT Agent
19. IMPLEMENT Agent core
    - Reads `/control/plan.md`
    - Parses plan items (numbered steps)
    - Executes each step sequentially
    - Marks completed steps in plan.md
    - Commits each change to Git
    - **Wenn Fragen: Schreibt in `/control/questions.md`, wartet auf Antwort**

20. Code generation engine
    - For each plan item:
      a. Parse what needs to be done
      b. Generate code using structured prompt
      c. Write code to filesystem
      d. Validate code syntax
      e. Commit to Git with message: "Implement: {plan item}"
    - Track progress in `/control/progress.json`

21. File operations
    - Create files as specified in plan
    - Edit existing files
    - Delete files if needed
    - All operations logged to execution.log
    - All changes committed to Git immediately

22. Plan item execution
    - Parse plan.md for numbered items
    - Execute items in order
    - Skip already completed items (check Git history)
    - Handle errors gracefully (transition to FAIL state)
    - Update plan.md with checkmarks [x] for completed items

23. Question/Answer mechanism
    - Wenn Agent Frage hat → schreibt in `/control/questions.md`
    - Format: `[AGENT] [TIMESTAMP] Question: ...`
    - Agent pausiert Execution
    - Intent Assistant zeigt Frage User
    - User antwortet → KI schreibt Antwort in questions.md
    - Agent liest Antwort → setzt fort

## Phase 7: VERIFY Agent
24. VERIFY Agent implementation
    - Reads `/control/rules.md`
    - Reads `/control/plan.md`
    - Validates all plan items completed
    - Checks Git repository state
    - Validates code against rules
    - Generates `/control/report.md`
    - **Bei Problemen: Schreibt in questions.md, fragt User**

25. Verification checks
    - All required files exist
    - No syntax errors in code
    - All plan items marked complete
    - Git repository is clean
    - No rule violations
    - Project builds successfully
    - Success criteria from intent.md met

26. Report generation
    - Create report.md with verification results
    - List all completed plan items
    - List any issues found
    - Check success criteria
    - Auto-transition to DONE if all checks pass
    - Auto-transition to PLAN if issues found

## Phase 8: Integration & API
27. LLM integration (structured, not chat between agents)
    - API endpoint `/api/assistant/chat` - User ↔ KI
    - API endpoint `/api/execute/generate` - Agent → Code (structured)
    - No chat between agents
    - All agent communication via files

28. Git integration
    - `/api/execute/git` - Git operations
    - Commit with structured messages
    - Create branches for each state
    - Tag commits with state transitions
    - Show diff in execution.log

29. File system operations
    - `/api/execute/files` - File operations
    - Create, read, write, delete files
    - All operations logged
    - All operations committed to Git
    - Validate file operations against rules

## Phase 9: Execution Loop
30. Main execution loop
    - Watch state.txt continuously
    - When state changes:
      a. Load appropriate agent
      b. Run agent.execute()
      c. Agent updates files/state
      d. Log everything
      e. Commit to Git
    - Handle errors (transition to FAIL)
    - Retry failed operations
    - Check questions.md for user input

31. State transition automation
    - PLAN → IMPLEMENT: When plan.md complete
    - IMPLEMENT → VERIFY: When all plan items done
    - VERIFY → DONE: When verification passes
    - VERIFY → PLAN: When verification fails
    - Any → FAIL: On critical error
    - IMPLEMENT → PAUSE: When question in questions.md

32. Progress tracking
    - `/control/progress.json` tracks:
      - Current phase
      - Completed items
      - Remaining items
      - Errors encountered
      - Time spent in each state
      - Pending questions

## Phase 10: Safety & Recovery
33. Error handling
    - Catch all errors in agents
    - Log errors to execution.log
    - Transition to FAIL state
    - Create recovery plan in plan.md
    - Don't lose work (all in Git)
    - Ask User via questions.md if needed

34. Rollback mechanism
    - On FAIL: revert to last good commit
    - Restore state.txt to previous state
    - Update plan.md with failure reason
    - Allow manual intervention

35. Checkpoint system
    - Create Git tag before each state transition
    - Allow rollback to any checkpoint
    - Store checkpoint metadata in progress.json

## Phase 11: Dashboard Integration
36. Intent Assistant Chat UI
    - Chat interface im Dashboard
    - Zeigt Conversation mit KI
    - Live Preview von intent.md
    - "Generate Intent" Button
    - "Start Execution" Button

37. Execution monitoring UI
    - Show current agent running
    - Show progress on plan items
    - Show execution.log in real-time
    - Show Git commits
    - Show errors/warnings
    - Show pending questions

38. Question/Answer UI
    - Wenn Agent Frage hat → zeigt in Dashboard
    - User kann direkt antworten
    - Antwort wird in questions.md geschrieben
    - Agent setzt fort

39. Manual controls
    - Start/stop execution
    - Pause at current step
    - Skip current step
    - Retry failed step
    - Force state transition
    - Edit intent.md and restart
    - Answer pending questions

## Workflow Examples

### Beispiel 1: User brainstormt mit KI
```
1. User öffnet Dashboard → Chat Tab
2. User: "Ich will eine Todo-App"
3. KI: "Cool! Frontend oder Backend?"
4. User: "Beides, React + Express"
5. KI: "Brauchst du Authentication?"
6. User: "Ja, mit JWT"
7. KI: "Perfekt! Ich generiere intent.md..."
8. KI zeigt Preview von intent.md
9. User: "Sieht gut aus!"
10. User klickt "Start Execution"
11. State = PLAN → System startet
```

### Beispiel 2: Agent hat Frage
```
1. IMPLEMENT Agent arbeitet an Plan Item 5
2. Agent: "Soll ich TypeScript oder JavaScript verwenden?"
3. Agent schreibt in questions.md
4. Dashboard zeigt Frage
5. User: "TypeScript"
6. KI schreibt Antwort in questions.md
7. Agent liest Antwort → setzt fort
```

### Beispiel 3: Vollständiger Flow
```
User ↔ KI (Chat)
    ↓
KI schreibt intent.md
    ↓
User startet Execution
    ↓
PLAN Agent liest intent.md (kein Chat!)
    ↓
PLAN Agent schreibt plan.md
    ↓
IMPLEMENT Agent liest plan.md (kein Chat!)
    ↓
IMPLEMENT Agent hat Frage → questions.md
    ↓
User antwortet → questions.md
    ↓
IMPLEMENT Agent setzt fort
    ↓
VERIFY Agent prüft alles
    ↓
DONE
```

## Kommunikations-Regeln (Wichtig!)

### ✅ ERLAUBT
- **User ↔ Intent Assistant (KI)**: Chat ist OK
- **KI ↔ Agenten**: Über Files (intent.md, plan.md, questions.md)
- **Agent ↔ Agent**: Über State Machine (state.txt) und Files

### ❌ VERBOTEN
- **Agent ↔ Agent**: Direkter Chat
- **Agent ↔ User**: Direkter Chat (nur über questions.md)
- **Agent ↔ Agent**: Implizite Kommunikation

## Technical Implementation Details

### Intent Assistant API
```typescript
POST /api/assistant/chat
{
  message: string
  history: Message[]
}
→ {
  response: string
  suggestedIntent?: Intent
  questions?: string[]
}
```

### Questions File Format
```markdown
# Questions

[IMPLEMENT] [2024-01-15 10:30:00] 
Question: Soll ich TypeScript oder JavaScript verwenden?

[USER] [2024-01-15 10:31:00]
Answer: TypeScript

[IMPLEMENT] [2024-01-15 10:31:05]
Acknowledged. Continuing with TypeScript.
```

### Agent Structure
```typescript
abstract class Agent {
  abstract onEnter(): Promise<void>
  abstract execute(): Promise<void>
  abstract onExit(): Promise<void>
  abstract validate(): Promise<boolean>
  
  // Check for questions before executing
  async checkQuestions(): Promise<void> {
    const questions = await readQuestions()
    if (questions.hasPending()) {
      await this.pause()
      // Wait for user answer
    }
  }
}
```

## Exit Criteria
- User kann mit KI brainstormen (Chat)
- KI generiert intent.md aus Chat
- Agenten kommunizieren NUR über Files (kein Chat)
- Agenten können Fragen stellen (über questions.md)
- User kann Fragen beantworten
- Vollständiger Flow: Chat → Intent → Plan → Code → Verify → Done
- Alle Kommunikation nachvollziehbar (in Files/Git)
- System ist verifiable und traceable
