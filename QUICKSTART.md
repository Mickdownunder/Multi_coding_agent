# Quick Start - Control System

## 🚀 Server starten

```bash
cd /Users/michaellabitzke/Documents/control-system
npm run dev
```

**Wichtig:** Der Server läuft auf **Port 3001** (weil Port 3000 von einem anderen Projekt belegt ist).

## 🌐 Dashboard öffnen

**Öffne im Browser:**
```
http://localhost:3001
```

**NICHT** `localhost:3000` - das ist ein anderes Projekt!

## ✅ Setup prüfen

```bash
npm run setup-check
```

## 🔑 API Keys

Die API Keys sind bereits in `.env` gesetzt:
- ✅ GEMINI_API_KEY ist gesetzt
- ⚠️ OPENAI_API_KEY ist leer (optional)

## 🎯 Erste Schritte

1. **Dashboard öffnen**: http://localhost:3001
2. **Tab "Intent Assistant"** öffnen
3. **Chat starten**: z.B. "Ich will eine Todo-App bauen"
4. **Intent generieren**: Klicke "Generate Intent"
5. **State auf PLAN setzen**: Im Dashboard Tab
6. **Execution starten**: Im Monitor Tab

## ⚠️ Wichtig

- **Immer Port 3001 verwenden**, nicht 3000!
- Wenn Port 3000 frei wird, kann der Server automatisch auf 3000 wechseln
- Die Config nutzt jetzt **Gemini 1.5** Models (gemini-1.5-pro, gemini-1.5-flash)
