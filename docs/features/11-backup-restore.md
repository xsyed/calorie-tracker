# TDD: Backup & Restore

## Feature Summary
File-level SQLite database backup to Google Drive AppData (Android) and iCloud (iOS, later). Manual trigger from Settings, with optional periodic backup. Restore on new device or reinstall: authenticate with same Firebase account, detect empty database, prompt restore from Drive/iCloud, download and replace local database file. Not structured cross-device sync — no merge logic, no conflict resolution.

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
      Step 1: Get Firebase auth token (for Google Drive auth)
        auth().currentUser.getIdToken()
        │
        ▼
      Step 2: Verify Google Drive scope
        GoogleSignin.hasPlayServices()
        GoogleSignin.getTokens() → accessToken for Drive scope
        (Drive AppData requires: 'https://www.googleapis.com/auth/drive.appdata')
        │
        ▼
      Step 3: Prepare backup file
        1. Close SQLite database connections (or trigger WAL checkpoint + snapshot)
        2. Copy SQLite file to temp directory: cp /data/data/.../databases/app.db → /tmp/backup.db
        3. (Optional) Gzip compress: gzip /tmp/backup.db → /tmp/backup.db.gz
        4. Compute SHA-256 checksum of backup file for integrity verification on restore
        │
        ▼
      Step 4: Upload to Google Drive AppData
        POST https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart
        Headers: Authorization: Bearer <google_access_token>
        Body (multipart):
          - Metadata: { "name": "calories-backup-2026-05-10.db.gz", "parents": ["appDataFolder"] }
          - File: <backup file bytes>
        │
        ▼
      Step 5: List existing backups, delete old ones (keep N most recent)
        GET https://www.googleapis.com/drive/v3/files?q='appDataFolder' in parents
        │
        ▼
      Delete files beyond keep count (default: keep 5 most recent)
        DELETE https://www.googleapis.com/drive/v3/files/{fileId}
        │
        ▼
      Step 6: Save backup metadata locally
        INSERT/UPDATE backup_metadata:
          last_backup_at = now(),
          last_backup_size_bytes = file_size,
          last_backup_checksum = sha256,
          backup_count = number of stored backups
        │
        ▼
      Show success: "Backup complete (2.3 MB)"
        Update "Last backup: Just now"

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
        GET https://www.googleapis.com/drive/v3/files?q='appDataFolder' in parents
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
            Step 3: Download backup file
              GET https://www.googleapis.com/drive/v3/files/{fileId}?alt=media
              │
              ▼
            Step 4: Verify integrity
              Compute SHA-256 of downloaded file
              Compare with stored checksum
              ├── MISMATCH → "Backup file is corrupted. Cannot restore."
              └── MATCH:
                    │
                    ▼
            Step 5: Decompress (if gzipped) and replace database
              - Decompress .db.gz → .db
              - Copy backup .db to app database location
              - Re-open SQLite connection
              │
              ▼
            Step 6: Verify data
              Query User table: SELECT * FROM user WHERE firebase_uid = ?
              ├── Row exists → restore successful
              └── Row missing or UID mismatch → restore failed (wrong user?)
              │
              ▼
            Step 7: Navigate to Home (skip onboarding)
              All data restored: entries, targets, settings, saved meals.
```

---

## APIs Involved

| API | Role | Protocol |
|---|---|---|
| Google Drive REST API v3 | File upload (AppData folder), file list, file download, file delete | HTTPS REST |
| Google Sign-In SDK | Obtain OAuth access token with `drive.appdata` scope | Native SDK |
| Firebase Auth `getIdToken()` | User identity (ensures same Google account for backup) | Native SDK |
| react-native-fs (or equivalent) | Read/write database file from app storage, copy to temp, compute checksum | Native module |

Google Drive AppData scope: `https://www.googleapis.com/auth/drive.appdata`
- Files stored in hidden app folder, scoped to the app's Google API project.
- User cannot see these files in their normal Google Drive.
- Only the app (with same API key + user auth) can read/write.
- Free quota: 1GB per app per user.

---

## State Management

| State | Storage | Lifespan |
|---|---|---|
| Backup metadata (last_backup_at, last_backup_size_bytes, checksum, backup_count) | SQLite table: backup_metadata (single row) | Persistent |
| Backup in-progress state (backup running, progress %, current step) | Component state | Ephemeral (during backup operation) |
| Restore in-progress state | Component state | Ephemeral (during restore) |
| Backup error state | Component state | Ephemeral |
| Periodic backup enabled toggle | SQLite settings or backup_metadata | Persistent |
| Google Drive access token | In-memory (refreshed via GoogleSignin.getTokens()) | Session, auto-refreshed |

---

## Background Jobs

| Job | Trigger | Behavior |
|---|---|---|
| **Periodic backup** (if enabled) | OS-level periodic task (WorkManager on Android, BGTaskScheduler on iOS) or app foreground event | 1. Check last backup date. 2. If > 1 week: attempt backup. 3. Respect WiFi-only setting. 4. Fail silently if conditions not met. |
| **Backup on app background** (optional) | AppState 'background' event | Trigger backup if periodic backup is due. Must complete within OS background time limit (~30s iOS, ~10min Android WorkManager). |
| **Old backup cleanup** | After successful backup upload | List all backups in AppData, delete any beyond `max_backups` (default 5). Runs inline during backup flow, not a separate job. |

Background constraints:
- Android: WorkManager with constraints (network connected, battery not low) is ideal for periodic backup.
- iOS: BGAppRefreshTask (limited to ~30s execution, OS-scheduled, not guaranteed). Backup during foreground is more reliable.
- v1: backup is manual only. Periodic backup is a post-launch enhancement.

---

## Battery / Performance Impact

- **Battery**: 
  - Manual backup: one file read (~1-5MB) + one HTTP upload. ~30s of sustained network + disk activity. Moderate impact during the operation.
  - Periodic backup (future): if enabled weekly, ~30s of activity per week. Negligible overall.
- **Performance**:
  - Database file read: copying a 5MB SQLite file takes <50ms on modern devices.
  - Compression (optional): gzipping a 5MB SQLite file (mostly text) reduces to ~1-2MB. Takes ~200-500ms.
  - Upload: depends on network speed. 5MB on 4G: ~10-30s. On WiFi: ~5-10s.
  - Upload should use chunked/resumable upload for large files (>= 1MB). Google Drive supports resumable upload sessions.
  - UI must show progress indicator during upload.
- **Memory**: Streaming file upload, not loading entire file into memory. Use file streams.

---

## Failure Scenarios

| Failure | Cause | User Impact | Handling |
|---|---|---|---|
| **No internet during backup** | Airplane mode, no signal | Backup cannot complete | Before attempting: check connectivity. Show "Backup requires internet." Don't start. |
| **Google Drive access token expired** | Token refresh failed, user revoked Google access | Upload returns 401 | Refresh token via GoogleSignin.getTokens(). If still fails: show "Google Drive access required. Please sign in again." Force re-auth with Google (if using Apple auth + Google backup = mismatch!). |
| **Google Drive quota exceeded** | 1GB AppData limit reached (unlikely: 5MB × 200 backups before hitting limit) | Upload returns 403 "storageQuotaExceeded" | Show: "Backup storage full. Older backups will be deleted to make space." Delete oldest backups first, retry. |
| **App signed with different Google API key** | Reinstall from different source, different signing key | Google Drive AppData inaccessible (tied to app signing key + package name) | This is a fundamental constraint of AppData. If signing key changes, backups are lost. Document this limitation. Show: "Cannot access previous backups. Starting fresh." |
| **Upload interrupted** | Network drops, app killed | Partial upload, no complete backup on Drive | Use Google Drive resumable upload. On retry: resume from last byte. If app killed: backup attempt is lost. On next open: no backup was saved, "Last backup" shows previous date. Retry manually. |
| **Download interrupted (restore)** | Network drops during restore download | Partial file downloaded, database corrupted | Do NOT replace database until full download + checksum verification completes. Download to temp file. On interruption: delete partial temp file, show "Download failed. Try again." |
| **Checksum mismatch on restore** | File corrupted during transfer, bit rot in Google Drive storage | Database file is unusable | If checksum mismatch: delete downloaded temp file. Try downloading again (may have been transient error). If mismatch persists: try next-most-recent backup. Show: "Backup file is corrupted. Trying the previous backup..." |
| **Database version mismatch on restore** | App updated with new schema, backup is from older version | Restored database may not work with new app code | After restore: run SQLite migration chain (same as app startup migrations). If backup is from a version that's too old and migration fails: show "This backup is from an older version. Please contact support." v1: ensure all schema changes are backward-compatible migrations. |
| **Restore to different user** | User signs in with different Google account than backup was created with | Restore pulls another user's data. Data leak + corruption. | Before restore: verify backup file's firebase_uid matches current user's firebase_uid. If mismatch: "This backup belongs to a different account." Do not restore. |
| **Restore fails mid-way** | SQLite file partially written, app crash | Database file corrupted, app may crash on next launch | Atomic restore: 1. Download to temp file. 2. Verify checksum. 3. Copy temp file over current database atomically (rename/replace). 4. On next app launch, SQLite opens the new file. If step 3 fails, original DB remains intact. |
| **Water, Weight entries logged after last backup** | Data not yet backed up if restore is performed | Data loss: entries since last backup are gone | Show "Last backup: X days ago. Entries since then will not be restored." before confirming restore. |
| **User auth method mismatch** | Signed up with Google, backup tied to Google Drive. Later signs in with Apple on new device. | Google Drive backup inaccessible (Apple auth = no Google token) | Detect auth provider at restore time. If user signed in with Apple but backup is on Google Drive: "Your backup is stored on Google Drive. Please sign in with your Google account to restore." This is a product limitation: backup is tied to auth provider. |
| **iOS: iCloud backup not implemented** | Only Google Drive Android backup exists | iOS users have no backup option in v1 | Show "Backup coming soon" section on iOS in v1. iOS backup via iCloud planned for later release (design decision #1). |

---

## Constraints
- Backup is file-level, not structured sync. No merge, no conflict resolution.
- Android only for initial release. iOS iCloud backup is planned but not in v1.
- Backup is tied to auth provider (Google Drive = Google auth; iCloud = Apple auth).
- Manual trigger from Settings. Optional periodic backup with WiFi-only constraint.
- Keep maximum 5 backup files. Delete oldest beyond that.
- Verify checksum on both backup (store it) and restore (validate it).
- Do NOT include Firebase Auth session data in backup (tokens, session state). Only app data (entries, settings, saved meals).
- Restore must verify firebase_uid matches current user before restoring.
