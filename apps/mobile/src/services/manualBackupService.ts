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
  deleteCloudBackup,
  CloudBackupError,
  listCloudBackups,
  uploadCloudBackup,
  verifyCloudBackupAccess,
} from './backendStorageBackupClient';
import { BackupCryptoError, encryptBackupFile } from './backupCrypto';
import type {
  CloudBackupFile,
  UploadBackupProgress,
} from './backendStorageBackupClient';

export type ManualBackupErrorCode =
  | 'no_internet'
  | 'password_required'
  | 'reauth_required'
  | 'storage_permission_required'
  | 'quota_exceeded'
  | 'interrupted_upload'
  | 'unsupported_platform'
  | 'crypto_failed'
  | 'backup_failed';

export type ManualBackupStep =
  | 'checking_connectivity'
  | 'checking_identity'
  | 'verifying_storage_access'
  | 'creating_snapshot'
  | 'encrypting'
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
  cloudFile: CloudBackupFile;
}

export interface ManualBackupFailure {
  status: 'error';
  code: ManualBackupErrorCode;
  message: string;
}

export type ManualBackupResult = ManualBackupSuccess | ManualBackupFailure;

export interface RunManualBackupOptions {
  onProgress?: (progress: ManualBackupProgress) => void;
  password?: string;
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

function sortNewestFirst(files: CloudBackupFile[]): CloudBackupFile[] {
  return [...files].sort(
    (left, right) => toTimestamp(right.createdTime) - toTimestamp(left.createdTime),
  );
}

async function deleteOldBackups(firebaseUid: string, maxCount: number): Promise<CloudBackupFile[]> {
  const backups = sortNewestFirst(await listCloudBackups(firebaseUid));
  const retainedBackups = backups.slice(0, maxCount);
  const staleBackups = backups.slice(maxCount);

  await Promise.all(staleBackups.map((backup) => deleteCloudBackup(firebaseUid, backup.id)));
  return retainedBackups;
}

async function cleanupForQuotaRetry(firebaseUid: string): Promise<void> {
  await deleteOldBackups(firebaseUid, Math.max(RETENTION_COUNT - 1, 0));
}

function isQuotaError(err: unknown): boolean {
  return err instanceof CloudBackupError && err.code === 'quota_exceeded';
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
  if (err instanceof BackupCryptoError) {
    if (err.code === 'password_required') {
      return {
        status: 'error',
        code: 'password_required',
        message: 'Create a backup password before backing up.',
      };
    }
    if (err.code === 'unsupported_platform') {
      return {
        status: 'error',
        code: 'unsupported_platform',
        message: 'Backup is coming soon on this platform.',
      };
    }
    if (err.code === 'crypto_failed') {
      return {
        status: 'error',
        code: 'crypto_failed',
        message: err.message,
      };
    }
  }

  if (err instanceof CloudBackupError) {
    if (err.code === 'backup_too_large') {
      return {
        status: 'error',
        code: 'backup_failed',
        message: 'Backup file is too large to upload.',
      };
    }
    if (err.code === 'permission_denied') {
      return {
        status: 'error',
        code: 'storage_permission_required',
        message: 'Cloud backup permission is missing or misconfigured.',
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
  encryptedFilePath: string,
  manifest: Awaited<ReturnType<typeof encryptBackupFile>>,
  options: RunManualBackupOptions,
): Promise<CloudBackupFile> {
  try {
    return await uploadCloudBackup({
      encryptedFilePath,
      manifest,
      onProgress: (progress) => emitProgress(options, mapUploadProgress(progress)),
    });
  } catch (err) {
    if (!isQuotaError(err)) throw err;
    emitProgress(options, { step: 'cleaning_old_backups' });
    await cleanupForQuotaRetry(manifest.firebaseUid);
    return uploadCloudBackup({
      encryptedFilePath,
      manifest,
      onProgress: (progress) => emitProgress(options, mapUploadProgress(progress)),
    });
  }
}

function createBackupId(): string {
  return `backup-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function createEncryptedBackupPath(filePath: string): string {
  return `${filePath}.enc`;
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
    emitProgress(options, { step: 'verifying_storage_access' });
    await verifyCloudBackupAccess(firebaseUid);
    emitProgress(options, { step: 'creating_snapshot' });
    const backupFile = await createDatabaseBackupFile();
    const encryptedFilePath = createEncryptedBackupPath(backupFile.filePath);

    try {
      const createdTime = new Date().toISOString();
      emitProgress(options, { step: 'encrypting' });
      const manifest = await encryptBackupFile({
        backupId: createBackupId(),
        createdTime,
        firebaseUid,
        inputPath: backupFile.filePath,
        originalChecksum: backupFile.checksum,
        originalFileName: backupFile.fileName,
        originalSizeBytes: backupFile.sizeBytes,
        outputPath: encryptedFilePath,
        ...(options.password === undefined ? {} : { password: options.password }),
      });

      emitProgress(options, { step: 'uploading' });
      const cloudFile = await uploadWithQuotaRetry(encryptedFilePath, manifest, options);

      emitProgress(options, { step: 'cleaning_old_backups' });
      const retainedBackups = await deleteOldBackups(firebaseUid, RETENTION_COUNT);
      const metadata = {
        last_backup_at: createdTime,
        last_backup_size_bytes: backupFile.sizeBytes,
        last_backup_checksum: backupFile.checksum,
        backup_count: retainedBackups.length,
      };

      emitProgress(options, { step: 'saving_metadata' });
      await saveBackupMetadata(metadata);
      emitProgress(options, { step: 'complete' });
      return { status: 'success', metadata, cloudFile };
    } finally {
      await Promise.all([
        cleanupDatabaseBackupFile(backupFile),
        cleanupDatabaseBackupFile(encryptedFilePath),
      ]);
    }
  } catch (err) {
    return mapManualBackupError(err);
  }
}
