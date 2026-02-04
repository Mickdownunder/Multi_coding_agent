# Control System - Komplette Anleitung

## 🚀 Schnellstart

### 1. API Keys einrichten

```bash
# Öffne die .env Datei
nano .env

# Füge deine API Keys ein:
OPENAI_API_KEY=sk-dein-openai-key-hier
GEMINI_API_KEY=dein-gemini-key-hier
```

**API Keys erhalten:**
- **OpenAI**: https://platform.openai.com/api-keys
- **Gemini**: https://makersuite.google.com/app/apikey

### 2. System starten

```bash
npm install
npm run dev
```

Öffne: http://localhost:3000

---

## 📋 Wie das System funktioniert

### Die 3-Schichten-Architektur

```
┌─────────────────────────────────────┐
│   USER LAYER (Dashboard)           │
│   - Intent Assistant (Chat)         │
│   - State Controls                 │
│   - File Viewer/Editor              │
└──────────────┬──────────────────────┘
               │
┌──────────────▼──────────────────────┐
│   CONTROL LAYER (Files)             │
│   - state.txt (PLAN/IMPLEMENT/etc)   │
│   - intent.md (Was soll gebaut werden)│
│   - rules.md (Regeln & Constraints) │
│   - plan.md (Wie wird es gebaut)    │
│   - report.md (Verification Report) │
└──────────────┬──────────────────────┘
               │
┌──────────────▼──────────────────────┐
│   EXECUTION LAYER (Agents)          │
│   - PLAN Agent                      │
│   - IMPLEMENT Agent                 │
│   - VERIFY Agent                    │
└─────────────────────────────────────┘
```

---

## 🔄 Der Workflow: Von Intent zu fertigem Code

### Schritt 1: Intent definieren

**Option A: Über Intent Assistant (Chat)**
1. Öffne Dashboard → Tab "Intent Assistant"
2. Chatte mit der KI: "Ich will eine Todo-App bauen"
3. KI hilft dir, den Intent zu verfeinern
4. Klicke "Generate Intent" → `intent.md` wird erstellt

**Option B: Manuell**
1. Öffne Dashboard → Tab "Dashboard"
2. Klicke "Edit" bei `intent.md`
3. Schreibe deinen Intent:
   ```markdown
   # Intent
   
   ## Goal
   Eine Todo-App mit React und Express
   
   ## Requirements
   - Tasks erstellen, löschen, erledigen
   - Frontend: React
   - Backend: Express API
   ```

### Schritt 2: State auf PLAN setzen

1. Im Dashboard: State-Button "PLAN" klicken
2. System wechselt zu `state.txt = PLAN`

### Schritt 3: Execution starten

1. Tab "Monitor" → "Start Execution"
2. **PLAN Agent** wird aktiv:
   - Liest `intent.md` und `rules.md`
   - Analysiert Codebase
   - Generiert `plan.md` mit detailliertem Plan
   - Wechselt automatisch zu `IMPLEMENT`

### Schritt 4: IMPLEMENT Agent arbeitet

**Automatisch:**
- Liest `plan.md`
- Generiert Code für jeden Plan-Step
- Committet in Git
- Aktualisiert `progress.json`
- Wechselt zu `VERIFY` wenn fertig

### Schritt 5: VERIFY Agent prüft

**Automatisch:**
- Prüft ob Plan erfüllt ist
- Validiert gegen `rules.md`
- Erstellt `report.md`
- Wechselt zu `DONE` wenn alles OK
- Oder zu `PLAN` wenn Änderungen nötig

---

## 🎯 Die State Machine

```
PLAN → IMPLEMENT → VERIFY → DONE
  ↑        ↓          ↓
  └────────┴──────────┘
           ↓
         FAIL
```

**States:**
- **PLAN**: Plan wird generiert/überarbeitet
- **IMPLEMENT**: Code wird generiert
- **VERIFY**: Code wird verifiziert
- **DONE**: Alles fertig ✅
- **FAIL**: Fehler aufgetreten ❌

**State Transitions:**
- PLAN → IMPLEMENT (automatisch wenn plan.md fertig)
- IMPLEMENT → VERIFY (automatisch wenn alle Steps done)
- VERIFY → DONE (wenn alles OK)
- VERIFY → PLAN (wenn Änderungen nötig)
- Jeder → FAIL (bei kritischen Fehlern)

---

## 📁 Die Control Files

### `state.txt`
Aktueller State (eine Zeile): `PLAN`, `IMPLEMENT`, `VERIFY`, `DONE`, `FAIL`

### `intent.md`
**Was** soll gebaut werden:
- Goal
- Requirements
- Success Criteria
- Constraints

### `rules.md`
**Regeln** die immer gelten:
- Invariants (was nie passieren darf)
- Forbidden Actions
- Definition of Done

### `plan.md`
**Wie** wird es gebaut:
- Phasen
- Steps mit IDs
- Dependencies
- Files die erstellt/geändert werden

### `report.md`
**Verification Report**:
- Was funktioniert
- Was fehlt
- Empfehlungen

---

## 🤖 Die Agents

### PLAN Agent
**Aufgabe**: `intent.md` → `plan.md`

**Was er macht:**
1. Liest `intent.md` und `rules.md`
2. Analysiert Codebase (welche Files existieren)
3. Generiert strukturierten Plan mit Phasen & Steps
4. Schätzt Token-Budget
5. Schreibt `plan.md`
6. Committet in Git
7. Wechselt State zu `IMPLEMENT`

### IMPLEMENT Agent
**Aufgabe**: `plan.md` → Code

**Was er macht:**
1. Liest `plan.md` und `progress.json`
2. Findet nächste unerledigte Steps
3. Gruppiert Steps für Batch-Processing (spart Tokens)
4. Generiert Code für jeden Step
5. Validiert Code
6. Schreibt Files
7. Committet in Git (strukturierte Commits)
8. Aktualisiert `progress.json`
9. Wechselt zu `VERIFY` wenn alle Steps done

**Token-Optimierung:**
- Batch-Processing (mehrere Steps auf einmal)
- Smart Context (nur relevante Files)
- Model Selection (gpt-3.5 für einfache Tasks)
- Caching

### VERIFY Agent
**Aufgabe**: Prüft ob alles fertig ist

**Was er macht:**
1. Liest `plan.md` und `rules.md`
2. Prüft ob alle Plan-Steps erledigt sind
3. Validiert gegen `rules.md`
4. Prüft Success Criteria aus `intent.md`
5. Erstellt `report.md`
6. Wechselt zu `DONE` oder `PLAN`

---

## 💬 Kommunikation: User ↔ KI ↔ Agents

### User ↔ Intent Assistant (KI)
**ERLAUBT: Chat**
- User chattet mit KI
- KI hilft bei Intent-Formulierung
- KI kann `intent.md` generieren

### Intent Assistant ↔ Agents
**NUR FILES**
- KI schreibt `intent.md`
- Agents lesen `intent.md`
- Kein Chat zwischen KI und Agents!

### Agent ↔ Agent
**VERBOTEN**
- Agents kommunizieren NUR über State Machine
- Agent A schreibt Files → State ändert → Agent B liest Files

---

## 🔧 Konfiguration

### `control/config.json`
```json
{
  "llm": {
    "provider": "gemini",  // oder "openai"
    "apiKey": "env:GEMINI_API_KEY",
    "model": {
      "plan": "gemini-pro",
      "code": "gemini-pro",
      "chat": "gemini-pro"
    }
  },
  "tokenBudget": {
    "maxPerProject": 200000,
    "warningThreshold": 0.8
  }
}
```

**Provider wechseln:**
- `"provider": "gemini"` → nutzt `GEMINI_API_KEY`
- `"provider": "openai"` → nutzt `OPENAI_API_KEY`

### `.env`
```bash
OPENAI_API_KEY=sk-...
GEMINI_API_KEY=...
MAX_TOKEN_BUDGET=200000
EXECUTION_TIMEOUT=300000
```

---

## 🛡️ Safety Features

### Git Integration
- Jede Änderung wird committed
- Strukturierte Commit-Messages
- Checkpoints für Rollback

### Error Handling
- Fehler → State zu `FAIL`
- Recovery Service versucht automatisch
- Fragen an User via `questions.md`

### Token Budget
- Tracking in `control/token-budget.json`
- Warnung bei 80% Budget
- Stopp bei Budget überschritten

### File Validation
- Validierung vor jedem Write
- Atomic Operations
- Backups vor Änderungen

---

## 📊 Monitoring

### Dashboard Tabs

**Dashboard:**
- State Display
- Control Files Viewer/Editor
- State Controls

**Intent Assistant:**
- Chat mit KI
- Intent Generation

**Monitor:**
- Execution Status
- Token Budget Tracker
- State Machine Visualization

---

## 🎓 Best Practices

### 1. Intent schreiben
- **Spezifisch**: Nicht "eine App", sondern "Todo-App mit React"
- **Messbar**: Klare Success Criteria
- **Realistisch**: Nicht zu groß für einen Run

### 2. Rules definieren
- **Invariants**: Was darf NIE passieren
- **Forbidden**: Was ist explizit verboten
- **Done**: Wann ist es fertig

### 3. Plan überprüfen
- Nach PLAN: `plan.md` lesen
- Prüfen ob Steps logisch
- Bei Bedarf manuell anpassen

### 4. Execution überwachen
- Monitor Tab öffnen
- Token Budget im Auge behalten
- Bei Fragen: `questions.md` beantworten

---

## 🐛 Troubleshooting

### "API key validation failed"
→ Prüfe `.env` Datei, ob API Keys gesetzt sind

### "State transition invalid"
→ Prüfe erlaubte Transitions in der State Machine

### "Token budget exceeded"
→ Erhöhe `MAX_TOKEN_BUDGET` in `.env` oder `config.json`

### Execution hängt
→ State zu `FAIL` setzen, dann zu `PLAN` für Neustart

---

## 📚 Nächste Schritte

1. **API Keys setzen** in `.env`
2. **Intent schreiben** (via Chat oder manuell)
3. **State auf PLAN** setzen
4. **Execution starten**
5. **Überwachen** im Monitor Tab
6. **Fertig!** Code ist in Git committed

Viel Erfolg! 🚀
