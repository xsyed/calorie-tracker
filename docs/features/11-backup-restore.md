# TDD: Backup & Restore

## Feature Summary
File-level SQLite database backup to backend API on Fly.io volume (Android). Encrypted with AES-256-GCM (Android Keystore + user password). Manual trigger from Settings, with optional periodic backup. Restore on new device or reinstall: authenticate with same Firebase account, detect empty database, prompt restore from backend, download and replace local database file. Not structured cross-device sync.

---

## Data Flow

```
═══ Backup Flow ═══

User navigates to Settings
  │
  ▼
Sees Backup section:
  ┌─ Backup ───────────────────────────────────┐
  │  Last backup: May 8, 2026 (3 days ago)      │
  │  Backup size: ~2.3 MB                       │
  │  [Create Backup Now]                        │
  │  [Enable weekly backup]  (toggle)           │
  └──────────────────────────────────────────────┘
  │
  ▼
User taps "Create Backup Now"
  │
  ▼
Check connectivity:
  ├── NO INTERNET → show "Backup requires internet connection."
  │
  └── CONNECTED:
        │
        ▼
      Step 1: Verify Firebase identity
        auth().currentUser.getIdToken()
        │
        ▼
      Step 2: Verify backup storage access
        GET /api/backup/list
        │
        ▼
      Step 3: Prepare backup file
        1. Run PRAGMA wal_checkpoint(TRUNCATE)
        2. Copy SQLite file to temp directory
        3. Compute SHA-256 checksum
        │
        ▼
      Step 4: Encrypt (Android native)
        - Generate random AES-256 data key (first backup only)
        - Encrypt backup file with AES-256-GCM
        - Wrap data key with user password (PBKDF2, 210k iterations)
        - Wrap data key with Android Keystore (local reuse)
        - Produce manifest with salt, wrapped key, IVs
        │
        ▼
      Step 5: Upload to backend
        POST /api/backup/upload (multipart: file + manifest)
        Authorization: Bearer <firebase-id-token>
        │
        ▼
      Step 6: Backend enforces retention (keep newest 5)
        │
        ▼
      Step 7: Save backup metadata locally
        INSERT/UPDATE backup_metadata:
          last_backup_at = now(),
          last_backup_size_bytes = file_size,
          last_backup_checksum = sha256,
          backup_count = number of stored backups
        │
        ▼
      Show success: "Backup complete (2.3 MB)"

═══ Restore Flow ═══

App launched on new device or after reinstall
  │
  ▼
User authenticates with Firebase (same Google/Apple account)
  │
  ▼
Onboarding check: query User table
  ├── User row exists → returning user, proceed to Home
  │
  └── User row missing (empty DB or no onboarding):
        │
        ▼
      Step 1: Detect if backup exists
        GET /api/backup/list
        │
        ├── No backups found → normal onboarding flow
        │
        └── Backup(s) found:
              │
              ▼
            Step 2: Show restore prompt
              "Backup found from May 10, 2026 (2.3 MB).
               Restore your data?"
              [Restore] [Start Fresh]
              │
              ▼
            User taps "Restore":
              │
              ▼
            Step 3: Prompt for backup password
              │
              ▼
            Step 4: Download backup file
              GET /api/backup/download/:backupId
              │
              ▼
            Step 5: Decrypt with password
              - Extract salt, wrap data from manifest
              - Derive key from password via PBKDF2
              - Decrypt data key, then decrypt backup file
              │
              ▼
            Step 6: Verify integrity
              Compute SHA-256 of decrypted file
              Compare with manifest.originalChecksum
              ├── MISMATCH → "Backup file is corrupted."
              └── MATCH:
                    │
                    ▼
            Step 7: Verify ownership
              Open candidate SQLite, SELECT 1 FROM User WHERE firebase_uid = ?
              ├── No match → "Backup belongs to a different account."
              └── Match:
                    │
                    ▼
            Step 8: Replace database (atomic rollback)
              - Close current DB
              - Move current → rollback path
              - Move candidate → active DB path
              - Validate (init DB, verify user exists)
              - On success: delete rollback
              - On failure: restore rollback
              │
              ▼
            Step 9: Recover meal reminders
              │
              ▼
            Navigate to Home (skip onboarding)
```

---

## APIs Involved

| API | Role | Protocol |
|---|---|---|
| Backend `/api/backup/upload` | Upload encrypted backup file + manifest | HTTPS multipart |
| Backend `/api/backup/list` | List backups for authenticated user | HTTPS GET |
| Backend `/api/backup/download/:id` | Download encrypted backup file | HTTPS GET |
| Backend `/api/backup/:id` | Delete backup | HTTPS DELETE |
| Firebase Auth `getIdToken()` | User identity (Bearer token for all backup calls) | Native SDK |
| react-native-fs | Read/write database file, upload/download files, compute checksums | Native module |

Storage location: Fly.io volume at `/data/backups/{firebaseUid}/{backupId}/backup.enc` + `manifest.json`.
Storage quota: 1GB volume, 5 backups per user max.

---

## State Management

| State | Storage | Lifespan |
|---|---|---|
| Backup metadata (last_backup_at, size, checksum, count) | SQLite table: backup_metadata (single row) | Persistent |
| Backup in-progress state (steps, progress %, current step) | Component state | Ephemeral |
| Restore in-progress state | Component state | Ephemeral |
| Backup error state | Component state | Ephemeral |
| Periodic backup preferences (enabled, wifi-only) | SQLite app_settings table | Persistent |
| Local encrypted data key | Android SharedPreferences (Keystore-wrapped) | Persistent |

---

## Failure Scenarios

| Failure | Handling |
|---|---|
| **No internet during backup** | Check connectivity first. Show "Backup requires internet." |
| **Auth token expired** | Refresh via getIdToken(true). If fails: "Sign in again." |
| **Backend unavailable (503)** | Show "Backup storage is temporarily unavailable. Try again." |
| **Upload interrupted** | Delete partial server files; retry. |
| **Checksum mismatch on restore** | "Backup file is corrupted. Try a different backup." |
| **Incorrect password on restore** | "Incorrect backup password." Do not replace database. |
| **Backup from different user** | Verify firebaseUid in manifest; reject if mismatch. |
| **Database version mismatch** | Run migrations on restored DB; reject if too old. |
| **Disk full on server** | Server enforces 5-backup retention; oldest deleted first. |

## Constraints
- Backup is file-level, not structured sync. No merge, no conflict resolution.
- Android only for initial release.
- Manual trigger from Settings. Optional periodic backup with WiFi-only constraint.
- Keep maximum 5 backup files. Delete oldest beyond that (server-side).
- Verify checksum on both backup (store it) and restore (validate it).
- Do NOT include Firebase Auth session data in backup. Only app data.
- Restore must verify firebase_uid matches current user before restoring.
