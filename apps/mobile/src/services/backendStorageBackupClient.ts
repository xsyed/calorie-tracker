import auth from '@react-native-firebase/auth';
import RNFS from 'react-native-fs';

import type { EncryptedBackupManifest } from './backupCrypto';

const API_BASE_URL = 'https://calories-api.fly.dev';

export type CloudBackupErrorCode =
  | 'storage_unavailable'
  | 'permission_denied'
  | 'quota_exceeded'
  | 'network_error'
  | 'invalid_response'
  | 'api_error';

export interface CloudBackupFile {
  checksum: string | null;
  createdTime: string;
  encryptedSizeBytes: number;
  firebaseUid: string | null;
  id: string;
  manifest: EncryptedBackupManifest;
  modifiedTime: string;
  name: string;
  sizeBytes: number | null;
}

export interface UploadBackupProgress {
  bytesSent: number;
  totalBytes: number;
}

export interface UploadCloudBackupOptions {
  encryptedFilePath: string;
  manifest: EncryptedBackupManifest;
  onProgress?: (progress: UploadBackupProgress) => void;
}

export class CloudBackupError extends Error {
  constructor(
    public readonly code: CloudBackupErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'CloudBackupError';
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isManifest(value: unknown): value is EncryptedBackupManifest {
  return (
    isRecord(value) &&
    value.version === 1 &&
    typeof value.backupId === 'string' &&
    typeof value.createdTime === 'string' &&
    typeof value.encryptedSizeBytes === 'number' &&
    typeof value.firebaseUid === 'string' &&
    typeof value.originalChecksum === 'string' &&
    typeof value.originalFileName === 'string' &&
    typeof value.originalSizeBytes === 'number' &&
    typeof value.salt === 'string' &&
    typeof value.wrappedDataKey === 'string' &&
    typeof value.wrapIv === 'string' &&
    typeof value.contentIv === 'string'
  );
}

function toCloudBackupFile(manifest: EncryptedBackupManifest): CloudBackupFile {
  return {
    checksum: manifest.originalChecksum,
    createdTime: manifest.createdTime,
    encryptedSizeBytes: manifest.encryptedSizeBytes,
    firebaseUid: manifest.firebaseUid,
    id: manifest.backupId,
    manifest,
    modifiedTime: manifest.createdTime,
    name: manifest.originalFileName,
    sizeBytes: manifest.originalSizeBytes,
  };
}

async function getAuthHeader(forceRefresh = false): Promise<Record<string, string>> {
  const user = auth().currentUser;
  if (!user) throw new CloudBackupError('permission_denied', 'Not authenticated.');
  const token = await user.getIdToken(forceRefresh);
  return { Authorization: `Bearer ${token}` };
}

function mapHttpError(statusCode: number, body: string): CloudBackupError {
  let errorCode: CloudBackupErrorCode = 'api_error';
  let message = 'Cloud backup API error.';

  try {
    const parsed = JSON.parse(body) as { error?: string; details?: string };
    if (parsed.error === 'invalid_token' || parsed.error === 'missing_token') {
      errorCode = 'permission_denied';
    } else if (parsed.error === 'not_found') {
      errorCode = 'storage_unavailable';
    } else if (
      parsed.error === 'invalid_backup_id' ||
      parsed.error === 'missing_fields' ||
      parsed.error === 'invalid_manifest' ||
      parsed.error === 'invalid_content_type'
    ) {
      errorCode = 'invalid_response';
    }
    if (parsed.details) message = parsed.details;
  } catch {
    // use defaults
  }

  if (statusCode === 401 || statusCode === 403) errorCode = 'permission_denied';
  if (statusCode === 404) errorCode = 'storage_unavailable';
  if (statusCode === 413 || statusCode === 429) errorCode = 'quota_exceeded';
  if (statusCode >= 500) errorCode = 'api_error';

  return new CloudBackupError(errorCode, message);
}

function mapFetchError(err: unknown): CloudBackupError {
  if (err instanceof CloudBackupError) return err;
  if (err instanceof Error) {
    if (
      err.message.includes('network') ||
      err.message.includes('Network') ||
      err.message.includes('abort')
    ) {
      return new CloudBackupError('network_error', 'Network error during backup operation.');
    }
    return new CloudBackupError('api_error', err.message);
  }
  return new CloudBackupError('api_error', 'Cloud backup storage failed.');
}

async function fetchWithAuth(
  url: string,
  options: RequestInit = {},
): Promise<Response> {
  let headers = await getAuthHeader();
  let response = await fetch(url, { ...options, headers: { ...options.headers, ...headers } });

  if (response.status === 401 || response.status === 403) {
    headers = await getAuthHeader(true);
    response = await fetch(url, { ...options, headers: { ...options.headers, ...headers } });
  }

  return response;
}

export async function uploadCloudBackup({
  encryptedFilePath,
  manifest,
  onProgress,
}: UploadCloudBackupOptions): Promise<CloudBackupFile> {
  try {
    const formData = new FormData();
    formData.append('file', {
      uri: `file://${encryptedFilePath}`,
      name: 'backup.enc',
      type: 'application/octet-stream',
    } as unknown as Blob);
    formData.append('manifest', JSON.stringify(manifest));

    if (onProgress) {
      onProgress({ bytesSent: 0, totalBytes: 1 });
    }

    const response = await fetchWithAuth(`${API_BASE_URL}/api/backup/upload`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const body = await response.text();
      throw mapHttpError(response.status, body);
    }

    if (onProgress) {
      onProgress({ bytesSent: 1, totalBytes: 1 });
    }

    return toCloudBackupFile(manifest);
  } catch (err) {
    throw mapFetchError(err);
  }
}

export async function listCloudBackups(_firebaseUid: string): Promise<CloudBackupFile[]> {
  try {
    const response = await fetchWithAuth(`${API_BASE_URL}/api/backup/list`);

    if (!response.ok) {
      const body = await response.text();
      throw mapHttpError(response.status, body);
    }

    const data = await response.json() as { backups: Array<{ id: string; manifest: unknown }> };
    return data.backups
      .filter((b) => isManifest(b.manifest))
      .map((b) => toCloudBackupFile(b.manifest as EncryptedBackupManifest));
  } catch (err) {
    throw mapFetchError(err);
  }
}

export async function verifyCloudBackupAccess(firebaseUid: string): Promise<void> {
  await listCloudBackups(firebaseUid);
}

export async function downloadCloudBackup(
  _firebaseUid: string,
  backupId: string,
  destinationPath: string,
): Promise<void> {
  try {
    let headers = await getAuthHeader();

    const doDownload = () =>
      RNFS.downloadFile({
        fromUrl: `${API_BASE_URL}/api/backup/download/${encodeURIComponent(backupId)}`,
        toFile: destinationPath,
        headers,
      }).promise;

    let result = await doDownload();

    if (result.statusCode === 401 || result.statusCode === 403) {
      headers = await getAuthHeader(true);
      result = await doDownload();
    }

    if (result.statusCode !== 200) {
      throw mapHttpError(result.statusCode, '');
    }
  } catch (err) {
    throw mapFetchError(err);
  }
}

export async function deleteCloudBackup(
  _firebaseUid: string,
  backupId: string,
): Promise<void> {
  try {
    const response = await fetchWithAuth(
      `${API_BASE_URL}/api/backup/${encodeURIComponent(backupId)}`,
      { method: 'DELETE' },
    );

    if (!response.ok) {
      const body = await response.text();
      throw mapHttpError(response.status, body);
    }
  } catch (err) {
    throw mapFetchError(err);
  }
}
