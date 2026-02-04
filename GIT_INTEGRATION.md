# Git Integration - Anleitung

## Aktueller Stand

### 1. **Manuelle Git-Verbindung (UI)**
- **Ort**: Dashboard → "Files" Tab → "File Location" Sektion
- **Schritte**:
  1. Klicke auf "Initialize Git" (falls noch nicht initialisiert)
  2. Optional: "GitHub Repo erstellen" Button
     - Repository-Name eingeben (z.B. `password-generator`)
     - GitHub Personal Access Token eingeben
     - Repo wird automatisch erstellt und als `origin` Remote hinzugefügt
  3. Oder: Manuell Remote hinzufügen
     - GitHub/GitLab URL eingeben
     - Remote Name (meist `origin`)
     - Branch (meist `main`)
     - "Add Remote" klicken
  4. "Push" Button zum Pushen verwenden

### 2. **Automatisches Git-Verhalten der Agents**

Die Agents (PlanAgent, ImplementAgent, VerifyAgent) führen automatisch Git-Operationen aus:

#### **PlanAgent** (beim Plan-Generieren):
- Committet `plan.md` mit Message: `"Generate plan from intent"`
- Pusht automatisch zu `origin/main` (falls Remote existiert)

#### **ImplementAgent** (bei jedem Schritt):
- Committet alle erstellten/geänderten Dateien
- Message: `"Implement: {step.description}"`
- Pusht automatisch zu `origin/main` (falls Remote existiert)

#### **VerifyAgent** (bei Verifikation):
- Committet `report.md` mit Message: `"Verification report"`
- Pusht automatisch zu `origin/main` (falls Remote existiert)

### 3. **App-Name Extraktion**

Der `PlanAgent` extrahiert automatisch einen App-Namen aus dem Intent:

```typescript
// Beispiel-Intent:
// "Ich möchte eine Password Generator App erstellen"
// → appName: "password-generator"

// Der PlanAgent sucht nach Mustern wie:
// - "eine {Name} App"
// - "build a {Name}"
// - "create {Name} application"
```

Der extrahierte `appName` wird:
- Im `plan.metadata.appName` gespeichert
- Für die Verzeichnisstruktur verwendet: `apps/{appName}/`
- **Könnte** für Repo-Namen verwendet werden (aktuell noch nicht implementiert)

## Automatische Git-Integration (Vorschlag)

### Option 1: Automatische Repo-Namensgenerierung

Die Agents könnten automatisch einen Repo-Namen aus dem `appName` generieren:

```typescript
// In PlanAgent nach Plan-Generierung:
const repoName = plan.metadata.appName || 'control-system-app'
// → "password-generator" → GitHub Repo: "password-generator"
```

### Option 2: GitHub Token in Config

GitHub Token könnte in `control/config.json` gespeichert werden:

```json
{
  "git": {
    "githubToken": "ghp_...",
    "autoCreateRepo": true,
    "repoPrefix": "my-org"
  }
}
```

### Option 3: Automatische Repo-Erstellung

Wenn `PlanAgent` einen Plan generiert und noch kein Remote existiert:
1. Extrahiere `appName` aus Plan
2. Prüfe, ob GitHub Token in Config vorhanden
3. Erstelle automatisch GitHub Repo: `{repoPrefix}/{appName}`
4. Füge als `origin` Remote hinzu
5. Pushe automatisch

## Aktuelle Implementierung

### Git-Service (`execution/services/git-service.ts`)

```typescript
// Methoden:
- isInitialized(): Prüft ob Git Repo existiert
- initialize(): Initialisiert Git Repo
- commit(message, files): Committet Dateien
- push(remote, branch): Pusht zu Remote
- addRemote(name, url): Fügt Remote hinzu
- getRemoteUrl(name): Holt Remote URL
- listRemotes(): Listet alle Remotes
```

### Agent-Integration

Alle Agents erben von `Agent` Base-Klasse und haben Zugriff auf `gitService`:

```typescript
// Beispiel aus ImplementAgent:
await this.gitService.commit(`Implement: ${step.description}`, files)
const remoteUrl = await this.gitService.getRemoteUrl('origin')
if (remoteUrl) {
  await this.gitService.push('origin', 'main', false)
}
```

## Nächste Schritte

1. **GitHub Token in Config speichern** (optional, für automatische Erstellung)
2. **Automatische Repo-Namensgenerierung** aus `appName`
3. **Automatische Repo-Erstellung** beim ersten Commit (falls kein Remote existiert)
4. **Bessere Fehlerbehandlung** für Git-Operationen

## Manuelle Schritte (aktuell notwendig)

1. **Git initialisieren**: Dashboard → Files → "Initialize Git"
2. **Remote hinzufügen**: 
   - Option A: "GitHub Repo erstellen" (mit Token)
   - Option B: Manuell URL eingeben
3. **Pushen**: "Push" Button oder automatisch durch Agents

## GitHub Token erstellen

1. Gehe zu: https://github.com/settings/tokens
2. "Generate new token (classic)"
3. Scopes: `repo` (für private Repos) oder `public_repo` (für öffentliche)
4. Token kopieren und in UI eingeben
