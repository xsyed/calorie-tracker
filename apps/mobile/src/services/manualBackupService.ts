import { Platform } from 'react-native';
import auth from '@react-native-firebase/auth';

import {
  DEFAULT_MAX_BACKUP_COUNT,
  saveBackupMetadata,
} from '../database';
import type { BackupMetadata } from '../database';
import { checkConnectivity } from './connectivity';
import {
  cleanupDatabaseBackupFile,
  createDatabaseBackupFile,
} from './databaseBackupFileService';
import {
  deleteGoogleDriveBackup,
  GoogleDriveBackupError,
  listGoogleDriveBackups,
  uploadGoogleDriveBackup,
  verifyGoogleDriveBackupAccess,
} from './googleDriveBackupClient';
import type {
  DriveBackupFile,
  UploadBackupProgress,
} from './googleDriveBackupClient';

export type ManualBackupErrorCode =
  | 'no_internet'
  | 'reauth_required'
  | 'quota_exceeded'
  | 'interrupted_upload'
  | 'unsupported_platform'
  | 'backup_failed';

export type ManualBackupStep =
  | 'checking_connectivity'
  | 'checking_identity'
  | 'verifying_drive_access'
  | 'creating_snapshot'
  | 'uploading'
  | 'cleaning_old_backups'
  | 'saving_metadata'
  | 'complete';

export interface ManualBackupProgress {
  step: ManualBackupStep;
  bytesSent?: number;
  totalBytes?: number;
}

export interface ManualBackupSuccess {
  status: 'success';
  metadata: BackupMetadata;
  driveFile: DriveBackupFile;
}

export interface ManualBackupFailure {
  status: 'error';
  code: ManualBackupErrorCode;
  message: string;
}

export type ManualBackupResult = ManualBackupSuccess | ManualBackupFailure;

export interface RunManualBackupOptions {
  onProgress?: (progress: ManualBackupProgress) => void;
}

const RETENTION_COUNT = DEFAULT_MAX_BACKUP_COUNT;

function emitProgress(
  options: RunManualBackupOptions,
  progress: ManualBackupProgress,
): void {
  options.onProgress?.(progress);
}

function mapUploadProgress(progress: UploadBackupProgress): ManualBackupProgress {
  return {
    step: 'uploading',
    bytesSent: progress.bytesSent,
    totalBytes: progress.totalBytes,
  };
}

function toTimestamp(value: string): number {
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function sortNewestFirst(files: DriveBackupFile[]): DriveBackupFile[] {
  return [...files].sort(
    (left, right) => toTimestamp(right.createdTime) - toTimestamp(left.createdTime),
  );
}

async function deleteOldBackups(maxCount: number): Promise<DriveBackupFile[]> {
  const backups = sortNewestFirst(await listGoogleDriveBackups());
  const retainedBackups = backups.slice(0, maxCount);
  const staleBackups = backups.slice(maxCount);

  await Promise.all(staleBackups.map((backup) => deleteGoogleDriveBackup(backup.id)));
  return retainedBackups;
}

async function cleanupForQuotaRetry(): Promise<void> {
  await deleteOldBackups(Math.max(RETENTION_COUNT - 1, 0));
}

function isQuotaError(err: unknown): boolean {
  return err instanceof GoogleDriveBackupError && err.code === 'quota_exceeded';
}

async function verifyFirebaseIdentity(): Promise<ManualBackupFailure | null> {
  const currentUser = auth().currentUser;
  if (!currentUser) {
    return {
      status: 'error',
      code: 'reauth_required',
      message: 'Sign in again before backing up.',
    };
  }

  try {
    await currentUser.getIdToken();
    return null;
  } catch {
    return {
      status: 'error',
      code: 'reauth_required',
      message: 'Sign in again before backing up.',
    };
  }
}

function mapManualBackupError(err: unknown): ManualBackupFailure {
  if (err instanceof GoogleDriveBackupError) {
    if (err.code === 'drive_unavailable') {
      return {
        status: 'error',
        code: 'unsupported_platform',
        message: 'Backup is coming soon on this platform.',
      };
    }
    if (err.code === 'reauth_required') {
      return {
        status: 'error',
        code: 'reauth_required',
        message: 'Google Drive access required. Please sign in again.',
      };
    }
    if (err.code === 'quota_exceeded') {
      return {
        status: 'error',
        code: 'quota_exceeded',
        message: 'Backup storage is full. Delete older backups and try again.',
      };
    }
    if (err.code === 'network_error') {
      return {
        status: 'error',
        code: 'interrupted_upload',
        message: 'Backup upload was interrupted. Try again.',
      };
    }
  }

  return {
    status: 'error',
    code: 'backup_failed',
    message: 'Backup failed. Try again.',
  };
}

async function uploadWithQuotaRetry(
  checksum: string,
  filePath: string,
  fileName: string,
  firebaseUid: string,
  mimeType: string,
  options: RunManualBackupOptions,
): Promise<DriveBackupFile> {
  try {
    return await uploadGoogleDriveBackup({
      checksum,
      fileName,
      filePath,
      firebaseUid,
      mimeType,
      onProgress: (progress) => emitProgress(options, mapUploadProgress(progress)),
    });
  } catch (err) {
    if (!isQuotaError(err)) throw err;
    emitProgress(options, { step: 'cleaning_old_backups' });
    await cleanupForQuotaRetry();
    return uploadGoogleDriveBackup({
      checksum,
      fileName,
      filePath,
      firebaseUid,
      mimeType,
      onProgress: (progress) => emitProgress(options, mapUploadProgress(progress)),
    });
  }
}

export async function runManualBackup(
  options: RunManualBackupOptions = {},
): Promise<ManualBackupResult> {
  if (Platform.OS !== 'android') {
    return {
      status: 'error',
      code: 'unsupported_platform',
      message: 'Backup is coming soon on this platform.',
    };
  }

  emitProgress(options, { step: 'checking_connectivity' });
  if (!await checkConnectivity()) {
    return {
      status: 'error',
      code: 'no_internet',
      message: 'Backup requires internet.',
    };
  }

  emitProgress(options, { step: 'checking_identity' });
  const identityError = await verifyFirebaseIdentity();
  if (identityError !== null) return identityError;
  const firebaseUid = auth().currentUser?.uid;
  if (firebaseUid === undefined) {
    return {
      status: 'error',
      code: 'reauth_required',
      message: 'Sign in again before backing up.',
    };
  }

  try {
    emitProgress(options, { step: 'verifying_drive_access' });
    await verifyGoogleDriveBackupAccess();
    emitProgress(options, { step: 'creating_snapshot' });
    const backupFile = await createDatabaseBackupFile();

    try {
      emitProgress(options, { step: 'uploading' });
      const driveFile = await uploadWithQuotaRetry(
        backupFile.checksum,
        backupFile.filePath,
        backupFile.fileName,
        firebaseUid,
        backupFile.mimeType,
        options,
      );

      emitProgress(options, { step: 'cleaning_old_backups' });
      const retainedBackups = await deleteOldBackups(RETENTION_COUNT);
      const metadata = {
        last_backup_at: new Date().toISOString(),
        last_backup_size_bytes: backupFile.sizeBytes,
        last_backup_checksum: backupFile.checksum,
        backup_count: retainedBackups.length,
      };

      emitProgress(options, { step: 'saving_metadata' });
      await saveBackupMetadata(metadata);
      emitProgress(options, { step: 'complete' });
      return { status: 'success', metadata, driveFile };
    } finally {
      await cleanupDatabaseBackupFile(backupFile);
    }
  } catch (err) {
    return mapManualBackupError(err);
  }
}
