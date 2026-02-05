# Agent Workspace Setup

## Automatisches Setup

Das System richtet den Workspace **automatisch** beim ersten Agent-Start ein:

1. **Workspace-Verzeichnis**: `/Users/michaellabitzke/agent-workspace`
2. **Git-Initialisierung**: Automatisch, falls nicht vorhanden
3. **Remote-Konfiguration**: Automatisch auf `https://github.com/Mickdownunder/Passwort-App.git`

## Manuelles Setup (Optional)

Falls du das Remote manuell einrichten möchtest:

```bash
# Option 1: Mit npm script
npm run setup-workspace

# Option 2: Manuell im Terminal
cd /Users/michaellabitzke/agent-workspace
git remote add origin https://github.com/Mickdownunder/Passwort-App.git
# oder falls bereits vorhanden:
git remote set-url origin https://github.com/Mickdownunder/Passwort-App.git
```

## Verifikation

Prüfe, ob alles korrekt eingerichtet ist:

```bash
cd /Users/michaellabitzke/agent-workspace
git remote -v
```

Sollte zeigen:
```
origin  https://github.com/Mickdownunder/Passwort-App.git (fetch)
origin  https://github.com/Mickdownunder/Passwort-App.git (push)
```

## Wichtige Hinweise

✅ **Agent-Repo**: Alle Agent-Commits gehen nach `Passwort-App`  
✅ **Haupt-Repo**: Dein `control-system` Repo bleibt unberührt  
✅ **Automatisch**: Beim ersten Agent-Start wird alles eingerichtet  
✅ **Isoliert**: Agent kann niemals dein Haupt-Repo manipulieren

## Troubleshooting

### "Operation not permitted"
- Das System richtet das Remote automatisch beim ersten Agent-Start ein
- Du musst nichts manuell machen

### "Remote already exists"
- Das ist OK - das System aktualisiert es automatisch, falls nötig

### "No such file or directory"
- Der Workspace wird beim ersten Agent-Start automatisch erstellt
