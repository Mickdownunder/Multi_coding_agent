# 100% Setup Guide

Dieses Dokument beschreibt, wie du das System zu 100% funktionsfähig machst.

## Schnellstart

```bash
# 1. Dependencies installieren
npm install

# 2. Setup-Check ausführen
npm run setup-check

# 3. Falls Fehler: Auto-Fix versuchen
npm run setup-check:fix

# 4. API Key setzen
export OPENAI_API_KEY="sk-..."

# 5. Nochmal prüfen
npm run setup-check

# 6. System starten
npm run dev
```

## Detaillierte Anleitung

### 1. Git Repository

Das System benötigt ein initialisiertes Git-Repository:

```bash
git init
```

### 2. Control-Dateien

Die folgenden Dateien müssen im `/control` Ordner existieren:

- `state.txt` - Aktueller State (PLAN, IMPLEMENT, VERIFY, DONE, FAIL)
- `intent.md` - Projekt-Intent
- `rules.md` - Regeln und Constraints
- `config.json` - Konfiguration (inkl. API Key)

### 3. API Key Konfiguration

**Option A: Environment Variable (Empfohlen)**

```bash
export OPENAI_API_KEY="sk-..."
```

Dann in `control/config.json`:
```json
{
  "llm": {
    "provider": "openai",
    "apiKey": "env:OPENAI_API_KEY",
    ...
  }
}
```

**Option B: Direkt in config.json**

```json
{
  "llm": {
    "provider": "openai",
    "apiKey": "sk-...",
    ...
  }
}
```

⚠️ **Warnung**: Direkte API Keys in config.json sollten nicht committed werden!

### 4. Setup-Check Script

Das Setup-Check Script prüft automatisch alle Voraussetzungen:

```bash
# Prüfen
npm run setup-check

# Prüfen und Auto-Fix
npm run setup-check:fix
```

### 5. System starten

```bash
# Development
npm run dev

# Production Build
npm run build
npm start
```

## Troubleshooting

### "API key validation failed"

- Prüfe ob `OPENAI_API_KEY` gesetzt ist: `echo $OPENAI_API_KEY`
- Prüfe `control/config.json` Format
- Stelle sicher, dass der API Key mit `sk-` beginnt

### "Git repository not initialized"

```bash
git init
```

### "Control directory missing"

```bash
mkdir -p control
npm run setup-check:fix
```

### "State file invalid"

Setze `control/state.txt` auf einen gültigen State:
- `PLAN`
- `IMPLEMENT`
- `VERIFY`
- `DONE`
- `FAIL`

## 100% Funktionsfähigkeit Checkliste

- [ ] Git Repository initialisiert
- [ ] Control-Dateien existieren (state.txt, intent.md, rules.md, config.json)
- [ ] API Key konfiguriert und validiert
- [ ] Node modules installiert (`npm install`)
- [ ] Build erfolgreich (`npm run build`)
- [ ] Tests laufen (`npm test`)
- [ ] Setup-Check bestanden (`npm run setup-check`)

## Nächste Schritte

1. Dashboard öffnen: `http://localhost:3000`
2. Intent Assistant verwenden um `intent.md` zu generieren
3. State auf `PLAN` setzen
4. Execution starten über Dashboard
5. System arbeitet autonom von PLAN → IMPLEMENT → VERIFY → DONE

## Support

Bei Problemen:
1. Führe `npm run setup-check` aus
2. Prüfe die Fehlermeldungen
3. Verwende `npm run setup-check:fix` für Auto-Fixes
4. Prüfe die Logs in `control/execution.log`
