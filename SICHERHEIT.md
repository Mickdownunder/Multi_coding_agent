# Sicherheits-Dokumentation

## 🔒 Wie kann die App eigenständig Repos erstellen?

### **Antwort: NUR mit deinem expliziten Token**

Die App kann **NICHT** eigenständig Repos erstellen. Sie benötigt:

1. **Deinen GitHub Personal Access Token** (PAT)
   - Du musst ihn **explizit** bereitstellen
   - Entweder als Umgebungsvariable: `GITHUB_TOKEN` oder `GH_TOKEN`
   - Oder in der UI beim "GitHub Repo erstellen" Button

2. **GitHub API mit Token**
   - Die App verwendet die **offizielle GitHub API**
   - Authentifizierung: `Authorization: token YOUR_TOKEN`
   - Endpoint: `POST https://api.github.com/user/repos`

### **Was die App NICHT kann:**

❌ **Keine Repos ohne Token erstellen**
❌ **Keine Repos in anderen Accounts erstellen** (nur in deinem Account)
❌ **Keine bestehenden Repos löschen oder überschreiben**
❌ **Keine Organisation-Repos erstellen** (nur User-Repos)
❌ **Keine unbegrenzten Repos erstellen** (GitHub Limits gelten)

### **Was die App KANN:**

✅ **Neue Repos in DEINEM Account erstellen** (mit Token)
✅ **Nur öffentliche oder private Repos** (wie du es wählst)
✅ **Nur wenn du es explizit erlaubst** (Token muss gesetzt sein)

---

## 🛡️ Sicherheitsmaßnahmen - Was schützt dich?

### **1. Token-basierte Authentifizierung**

```typescript
// Die App prüft IMMER zuerst:
const githubToken = process.env.GITHUB_TOKEN || process.env.GH_TOKEN

if (!githubToken) {
  // ❌ KEINE Repo-Erstellung ohne Token
  return null
}
```

**Bedeutung:**
- Ohne Token = **KEINE Aktion**
- Token muss von **dir** bereitgestellt werden
- Token hat nur die Berechtigungen, die **du** beim Erstellen vergeben hast

### **2. Eingeschränkte Token-Berechtigungen**

Wenn du einen GitHub Token erstellst, kannst du **genau** festlegen:

- ✅ `repo` Scope → Kann Repos erstellen/löschen
- ✅ `public_repo` Scope → Nur öffentliche Repos
- ❌ **KEIN** `delete_repo` → Kann keine Repos löschen
- ❌ **KEIN** `admin:org` → Kann keine Org-Repos erstellen

**Empfehlung:** Verwende `public_repo` für maximale Sicherheit (nur öffentliche Repos).

### **3. Sanitization & Validierung**

#### **Repo-Name Sanitization:**

```typescript
private sanitizeRepoName(appName: string): string {
  return appName
    .toLowerCase()                    // Nur Kleinbuchstaben
    .replace(/[^a-z0-9-]/g, '-')     // Nur alphanumerisch + Bindestriche
    .replace(/-+/g, '-')             // Keine doppelten Bindestriche
    .replace(/^-|-$/g, '')           // Keine führenden/abschließenden Bindestriche
    .substring(0, 100)                // Max 100 Zeichen (GitHub Limit)
}
```

**Schützt vor:**
- ❌ Sonderzeichen, die Probleme verursachen könnten
- ❌ Zu lange Namen
- ❌ Ungültige Zeichen

#### **File Validation (Hard Policy Enforcement):**

```typescript
// Jede Datei wird VOR dem Schreiben validiert:
const validation = await validator.validateAgainstRules(filePath, content)
if (!validation.valid) {
  // ❌ Datei wird NICHT geschrieben
  throw PolicyViolationError
}
```

**Schützt vor:**
- ❌ Verbotene Imports (`next/document` außer in `_document.tsx`)
- ❌ `any` Types
- ❌ Code-Injection (`eval`, `Function()`)
- ❌ Unsichere Patterns

### **4. State Machine Hard Enforcement**

```typescript
// Erlaubte State-Übergänge (HARD CODED):
const ALLOWED_TRANSITIONS = {
  PLAN: ['IMPLEMENT'],           // PLAN → nur IMPLEMENT
  IMPLEMENT: ['VERIFY', 'FAIL'], // IMPLEMENT → nur VERIFY oder FAIL
  VERIFY: ['DONE', 'PLAN', 'FAIL'],
  DONE: ['PLAN'],                // DONE → nur PLAN (Neustart)
  FAIL: ['PLAN']                 // FAIL → nur PLAN (Neustart)
}

// Jeder State-Wechsel wird geprüft:
if (!isTransitionAllowed(currentState, newState)) {
  return 403 Forbidden  // ❌ Blockiert!
}
```

**Schützt vor:**
- ❌ Unerlaubten State-Sprüngen
- ❌ Korrupten State-Maschinen
- ❌ Endlosschleifen

### **5. Atomic File Operations**

```typescript
// Jede Datei-Operation ist atomar:
1. Backup erstellen
2. Validierung durchführen
3. Schreiben (nur wenn valid)
4. Bei Fehler: Rollback zum Backup
```

**Schützt vor:**
- ❌ Korrupten Dateien
- ❌ Teilweise geschriebenen Dateien
- ❌ Datenverlust

### **6. Git Safety**

```typescript
// Git-Operationen sind sicher:
- ❌ KEIN `--force` Push (außer explizit erlaubt)
- ✅ Nur normale Commits
- ✅ Strukturierte Commit-Messages
- ✅ Checkpoints für Rollback
```

**Schützt vor:**
- ❌ Force-Push (überschreibt History)
- ❌ Unerlaubten Git-Operationen
- ❌ Datenverlust

### **7. Token Budget Enforcement**

```typescript
// Token-Budget wird ENFORCED:
if (tokensUsed > maxPerProject) {
  throw BudgetExceededError  // ❌ Stoppt Ausführung
}
```

**Schützt vor:**
- ❌ Unbegrenzten API-Kosten
- ❌ Unerwarteten Rechnungen

### **8. Sandboxed Execution**

```typescript
// Agents arbeiten nur in:
- ✅ `apps/{appName}/` Verzeichnis (isoliert)
- ✅ `control/` Verzeichnis (nur Control Files)
- ❌ KEIN Zugriff auf System-Dateien
- ❌ KEIN Zugriff auf andere Projekte
```

**Schützt vor:**
- ❌ Überschreiben von System-Dateien
- ❌ Zugriff auf andere Projekte
- ❌ Unerlaubten Datei-Operationen

---

## 🚫 Was die App NICHT tun kann

### **GitHub:**

❌ **Keine Repos löschen**
- Die App hat keine `delete_repo` Berechtigung
- Selbst mit Token kann sie nur erstellen, nicht löschen

❌ **Keine bestehenden Repos überschreiben**
- `auto_init: false` → Repo wird leer erstellt
- Nur dein lokaler Code wird gepusht

❌ **Keine Org-Repos erstellen**
- Nur User-Repos (`/user/repos` Endpoint)
- Keine Organisation-Repos

❌ **Keine unbegrenzten Repos**
- GitHub Limits gelten (z.B. 1000 Repos pro Account)
- Die App respektiert diese Limits

### **Dateisystem:**

❌ **Keine System-Dateien ändern**
- Nur im Projekt-Verzeichnis (`process.cwd()`)
- Kein Zugriff auf `/etc`, `/usr`, etc.

❌ **Keine anderen Projekte ändern**
- Nur `apps/{appName}/` Verzeichnis
- Isoliert von anderen Projekten

❌ **Keine Control Files überschreiben**
- `rules.md` ist geschützt
- `state.txt` hat Validierung

### **Code:**

❌ **Keine unsicheren Patterns**
- `eval()`, `Function()` → Blockiert
- `dangerouslySetInnerHTML` → Blockiert
- `any` Types → Blockiert

❌ **Keine unerlaubten Imports**
- `next/document` → Nur in `_document.tsx`
- Andere verbotene Imports → Blockiert

---

## ✅ Was die App SICHER tun kann

### **GitHub:**

✅ **Neue Repos in deinem Account erstellen** (mit Token)
✅ **Code zu bestehenden Repos pushen** (mit Credentials)
✅ **Strukturierte Commits erstellen**

### **Dateisystem:**

✅ **Dateien in `apps/{appName}/` erstellen**
✅ **Control Files lesen/schreiben** (mit Validierung)
✅ **Atomic Operations** (mit Backup/Rollback)

### **Code:**

✅ **TypeScript-konformen Code generieren**
✅ **Validierte Dateien schreiben**
✅ **Strukturierte State-Übergänge**

---

## 🔐 Best Practices für maximale Sicherheit

### **1. GitHub Token:**

```bash
# Minimaler Scope (nur öffentliche Repos):
Scope: public_repo

# Oder noch sicherer: Nur manuell in UI eingeben
# (nicht als Umgebungsvariable speichern)
```

### **2. Token-Rotation:**

- Token regelmäßig erneuern
- Alte Token löschen
- Nur bei Bedarf verwenden

### **3. Monitoring:**

- GitHub Activity Log prüfen
- Token-Nutzung überwachen
- Unerwartete Repos sofort prüfen

### **4. Sandbox:**

- System in isoliertem Verzeichnis laufen lassen
- Keine Admin-Rechte für den Prozess
- Separate GitHub-Account für Tests

---

## 📊 Sicherheits-Checkliste

### **Vor dem ersten Start:**

- [ ] GitHub Token mit minimalen Berechtigungen erstellt
- [ ] Token nur in `.env` (nicht in Code)
- [ ] `.env` in `.gitignore`
- [ ] `rules.md` definiert (was ist erlaubt/verboten)
- [ ] Token Budget gesetzt

### **Während der Nutzung:**

- [ ] GitHub Activity Log regelmäßig prüfen
- [ ] Erstellte Repos überprüfen
- [ ] Token Budget überwachen
- [ ] Execution Logs lesen

### **Bei Problemen:**

- [ ] Token sofort widerrufen
- [ ] Unerwartete Repos löschen
- [ ] Execution stoppen
- [ ] Logs analysieren

---

## 🎯 Zusammenfassung

### **Die App kann Repos erstellen, weil:**

1. ✅ Du einen **GitHub Token bereitstellst**
2. ✅ Die App die **offizielle GitHub API** verwendet
3. ✅ Der Token **nur die Berechtigungen** hat, die du vergeben hast

### **Die App kann nichts kaputt machen, weil:**

1. ✅ **Hard Policy Enforcement** (Regeln werden erzwungen)
2. ✅ **Validierung vor jedem Write** (keine ungültigen Dateien)
3. ✅ **Atomic Operations** (Backup/Rollback)
4. ✅ **State Machine Protection** (keine unerlaubten Übergänge)
5. ✅ **Sandboxed Execution** (nur isolierte Verzeichnisse)
6. ✅ **Token Budget Limits** (keine unbegrenzten Kosten)
7. ✅ **Keine Lösch-Operationen** (nur Erstellen, nie Löschen)

### **Du hast die Kontrolle:**

- ✅ Token-Berechtigungen festlegen
- ✅ Token jederzeit widerrufen
- ✅ Execution jederzeit stoppen
- ✅ Alle Aktionen in Logs sehen
- ✅ Repos jederzeit löschen

**Die App ist ein Werkzeug - du bist der Meister!** 🛠️
