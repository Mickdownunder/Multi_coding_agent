# Git Authentifizierung - Erklärung

## Warum funktioniert das Remote-Hinzufügen ohne Passwort?

### 1. **Remote hinzufügen = Nur URL speichern**

Wenn du einen Remote hinzufügst (`git remote add origin https://github.com/...`), passiert folgendes:

- ✅ **Nur die URL wird gespeichert** (in `.git/config`)
- ❌ **Keine Authentifizierung nötig** - es wird nur die Adresse gespeichert
- ❌ **Kein Zugriff auf GitHub** - es wird noch nichts hochgeladen

Das ist wie eine Adresse in dein Adressbuch schreiben - du hast noch nicht die Tür geöffnet.

### 2. **Push = Benötigt Authentifizierung**

Beim **Pushen** (`git push origin main`) wird dann Authentifizierung benötigt:

```
git push origin main
→ Verbindet sich zu GitHub
→ Benötigt: Username + Passwort/Token
```

## Wie funktioniert die Authentifizierung?

Git verwendet verschiedene Methoden (in dieser Reihenfolge):

### **Option 1: Git Credential Helper** (macOS Keychain)

Wenn du auf macOS Git verwendest, speichert Git deine Credentials im **Keychain**:

```bash
# Git fragt beim ersten Push nach Credentials
# Diese werden dann im macOS Keychain gespeichert
# Bei jedem weiteren Push werden sie automatisch verwendet
```

**Prüfen:**
```bash
git config --global credential.helper
# Sollte zeigen: osxkeychain (auf macOS)
```

### **Option 2: SSH Keys**

Wenn du eine **SSH URL** verwendest (`git@github.com:...`):

```bash
# Git verwendet deinen SSH Key aus ~/.ssh/
# Kein Passwort nötig, wenn SSH Key bei GitHub hinterlegt ist
```

**Prüfen:**
```bash
ls -la ~/.ssh/id_*
# Sollte SSH Keys zeigen
```

### **Option 3: Personal Access Token in URL**

Du kannst den Token direkt in der URL speichern (nicht empfohlen für Sicherheit):

```bash
git remote set-url origin https://TOKEN@github.com/user/repo.git
```

### **Option 4: Credential Helper mit Token**

Token kann auch im Credential Helper gespeichert werden:

```bash
# Token wird beim ersten Push eingegeben
# Git speichert es im Credential Helper
```

## Was passiert beim ersten Push?

1. **Git versucht zu pushen**
2. **GitHub fragt nach Authentifizierung**
3. **Git prüft:**
   - Gibt es gespeicherte Credentials? (Keychain/Credential Helper)
   - Gibt es SSH Keys? (bei SSH URL)
   - Sonst: Fehler oder interaktive Eingabe

## In unserem System

### **Aktuelles Verhalten:**

1. **Remote hinzufügen** (UI):
   ```typescript
   git remote add origin https://github.com/user/repo.git
   // ✅ Funktioniert ohne Auth - nur URL speichern
   ```

2. **Push** (UI oder Agent):
   ```typescript
   git push origin main
   // ⚠️ Benötigt Auth - verwendet:
   //    - macOS Keychain (wenn konfiguriert)
   //    - SSH Keys (wenn SSH URL)
   //    - Oder: Fehler "authentication required"
   ```

### **Wenn Push fehlschlägt:**

Du bekommst einen Fehler wie:
```
fatal: could not read Username for 'https://github.com': terminal prompts disabled
```

**Lösungen:**

1. **Token in URL einbetten** (für automatische Auth):
   ```bash
   git remote set-url origin https://TOKEN@github.com/user/repo.git
   ```

2. **SSH verwenden** (empfohlen):
   ```bash
   git remote set-url origin git@github.com:user/repo.git
   # Benötigt SSH Key bei GitHub
   ```

3. **Credential Helper konfigurieren**:
   ```bash
   git config --global credential.helper osxkeychain
   # Dann beim ersten Push Token eingeben
   ```

## Empfehlung für automatische Pushes

Für **automatische Pushes durch die Agents** gibt es zwei Optionen:

### **Option A: SSH Keys** (Empfohlen)

1. SSH Key erstellen:
   ```bash
   ssh-keygen -t ed25519 -C "your_email@example.com"
   ```

2. Public Key zu GitHub hinzufügen:
   ```bash
   cat ~/.ssh/id_ed25519.pub
   # In GitHub: Settings → SSH and GPG keys → New SSH key
   ```

3. Remote auf SSH umstellen:
   ```bash
   git remote set-url origin git@github.com:user/repo.git
   ```

### **Option B: Token in Git Config**

Token in Git Credential Helper speichern:

```bash
# Beim ersten Push Token eingeben
# Git speichert es automatisch im Keychain
```

Oder manuell:
```bash
git config --global credential.helper osxkeychain
echo "https://TOKEN@github.com" | git credential approve
```

## Zusammenfassung

- ✅ **Remote hinzufügen**: Keine Auth nötig (nur URL speichern)
- ⚠️ **Push**: Benötigt Auth (Keychain, SSH, oder Token)
- 🔒 **Sicherheit**: SSH Keys sind am sichersten für automatische Pushes
- 🤖 **Agents**: Verwenden die gleichen Git-Credentials wie dein System

Die App hat also **keinen direkten Zugriff ohne Credentials** - sie nutzt die Git-Credentials, die auf deinem System konfiguriert sind (Keychain, SSH Keys, etc.).
