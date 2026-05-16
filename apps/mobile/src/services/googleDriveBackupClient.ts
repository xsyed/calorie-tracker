import { Platform } from 'react-native';

import {
  GoogleSignin,
  statusCodes,
} from '@react-native-google-signin/google-signin';
import RNFS from 'react-native-fs';

const DRIVE_APPDATA_SCOPE = 'https://www.googleapis.com/auth/drive.appdata';
const DRIVE_API_BASE_URL = 'https://www.googleapis.com/drive/v3';
const DRIVE_UPLOAD_BASE_URL = 'https://www.googleapis.com/upload/drive/v3';
const JSON_CONTENT_TYPE = 'application/json; charset=UTF-8';
const SQLITE_MIME_TYPE = 'application/octet-stream';
const DRIVE_FILE_FIELDS = 'id,name,createdTime,modifiedTime,size,appProperties';

export type GoogleDriveBackupErrorCode =
  | 'drive_unavailable'
  | 'reauth_required'
  | 'permission_denied'
  | 'quota_exceeded'
  | 'network_error'
  | 'api_error'
  | 'invalid_response';

export interface DriveBackupFile {
  checksum: string | null;
  firebaseUid: string | null;
  id: string;
  name: string;
  createdTime: string;
  modifiedTime: string;
  sizeBytes: number | null;
}

interface DriveFileResponse {
  appProperties?: {
    checksum?: string;
    firebase_uid?: string;
  };
  id: string;
  name: string;
  createdTime?: string;
  modifiedTime?: string;
  size?: string;
}

interface DriveListResponse {
  files?: unknown[];
}

interface DriveErrorBody {
  error?: {
    message?: string;
    errors?: Array<{ reason?: string }>;
  };
}

export class GoogleDriveBackupError extends Error {
  constructor(
    public readonly code: GoogleDriveBackupErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'GoogleDriveBackupError';
  }
}

export class GoogleDriveUnavailableError extends GoogleDriveBackupError {
  constructor(message = 'Google Drive backup is unavailable on this platform') {
    super('drive_unavailable', message);
    this.name = 'GoogleDriveUnavailableError';
  }
}

export class GoogleDriveReauthRequiredError extends GoogleDriveBackupError {
  constructor(message = 'Google Drive access must be renewed') {
    super('reauth_required', message);
    this.name = 'GoogleDriveReauthRequiredError';
  }
}

export class GoogleDriveQuotaExceededError extends GoogleDriveBackupError {
  constructor(message = 'Google Drive AppData quota exceeded') {
    super('quota_exceeded', message);
    this.name = 'GoogleDriveQuotaExceededError';
  }
}

class GoogleDrivePermissionError extends GoogleDriveBackupError {
  constructor(message = 'Google Drive appData permission is missing or misconfigured') {
    super('permission_denied', message);
    this.name = 'GoogleDrivePermissionError';
  }
}

export interface UploadBackupProgress {
  bytesSent: number;
  totalBytes: number;
}

interface UploadBackupOptions {
  checksum?: string;
  firebaseUid?: string;
  filePath: string;
  fileName: string;
  mimeType?: string;
  onProgress?: (progress: UploadBackupProgress) => void;
}

function assertAndroid(): void {
  if (Platform.OS !== 'android') {
    throw new GoogleDriveUnavailableError();
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isNativeCodeError(value: unknown): value is { code: string } {
  return isRecord(value) && typeof value.code === 'string';
}

function isDriveFileResponse(value: unknown): value is DriveFileResponse {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.name === 'string'
  );
}

function getDriveErrorReason(body: DriveErrorBody): string | null {
  const reasons = body.error?.errors;
  if (!Array.isArray(reasons)) return null;
  return reasons.find((item) => typeof item.reason === 'string')?.reason ?? null;
}

function hasDriveAppDataScope(scopes: readonly string[] | undefined): boolean {
  return scopes?.includes(DRIVE_APPDATA_SCOPE) === true;
}

function isDrivePermissionReason(reason: string | null): boolean {
  return (
    reason === 'accessNotConfigured' ||
    reason === 'forbidden' ||
    reason === 'insufficientFilePermissions' ||
    reason === 'insufficientPermissions'
  );
}

function parseSize(size: string | undefined): number | null {
  if (size === undefined) return null;
  const parsed = Number(size);
  return Number.isFinite(parsed) ? parsed : null;
}

function mapDriveFile(file: DriveFileResponse): DriveBackupFile {
  return {
    checksum: file.appProperties?.checksum ?? null,
    firebaseUid: file.appProperties?.firebase_uid ?? null,
    id: file.id,
    name: file.name,
    createdTime: file.createdTime ?? file.modifiedTime ?? '',
    modifiedTime: file.modifiedTime ?? file.createdTime ?? '',
    sizeBytes: parseSize(file.size),
  };
}

function parseJsonString(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function mapDriveErrorBody(statusCode: number, bodyText: string): GoogleDriveBackupError {
  const body = parseJsonString(bodyText);
  const errorBody = isRecord(body) ? (body as DriveErrorBody) : {};
  const reason = getDriveErrorReason(errorBody);
  const message = errorBody.error?.message ?? `Google Drive API error: ${statusCode}`;

  if (reason === 'storageQuotaExceeded' || reason === 'quotaExceeded') {
    return new GoogleDriveQuotaExceededError(message);
  }

  if (statusCode === 403 && isDrivePermissionReason(reason)) {
    return new GoogleDrivePermissionError(message);
  }

  if (statusCode === 401 || statusCode === 403) {
    return new GoogleDriveReauthRequiredError(message);
  }

  return new GoogleDriveBackupError('api_error', message);
}

async function parseDriveError(response: Response): Promise<GoogleDriveBackupError> {
  const body = await readJson(response);
  const errorBody = isRecord(body) ? (body as DriveErrorBody) : {};
  const reason = getDriveErrorReason(errorBody);
  const message = errorBody.error?.message ?? `Google Drive API error: ${response.status}`;

  if (reason === 'storageQuotaExceeded' || reason === 'quotaExceeded') {
    return new GoogleDriveQuotaExceededError(message);
  }

  if (response.status === 403 && isDrivePermissionReason(reason)) {
    return new GoogleDrivePermissionError(message);
  }

  if (response.status === 401 || response.status === 403) {
    return new GoogleDriveReauthRequiredError(message);
  }

  return new GoogleDriveBackupError('api_error', message);
}

async function ensureDriveScope(): Promise<void> {
  const silent = await GoogleSignin.signInSilently();
  if (silent.type === 'noSavedCredentialFound') {
    throw new GoogleDriveReauthRequiredError('No Google Sign-In session found');
  }

  if (hasDriveAppDataScope(silent.data.scopes)) return;

  await requestDriveScope();
}

async function requestDriveScope(): Promise<void> {
  const scoped = await GoogleSignin.addScopes({ scopes: [DRIVE_APPDATA_SCOPE] });
  if (scoped === null || scoped.type === 'cancelled') {
    throw new GoogleDriveReauthRequiredError('Google Drive scope was not granted');
  }
  if (!hasDriveAppDataScope(scoped.data.scopes)) {
    throw new GoogleDrivePermissionError('Google Drive appData scope was not granted');
  }
}

async function getDriveAccessToken(): Promise<string> {
  assertAndroid();
  const hasServices = await GoogleSignin.hasPlayServices({
    showPlayServicesUpdateDialog: false,
  });
  if (!hasServices) {
    throw new GoogleDriveUnavailableError('Google Play Services are unavailable');
  }

  try {
    await ensureDriveScope();
    return (await GoogleSignin.getTokens()).accessToken;
  } catch (err) {
    if (isNativeCodeError(err) && err.code === statusCodes.SIGN_IN_REQUIRED) {
      throw new GoogleDriveReauthRequiredError();
    }
    if (err instanceof GoogleDriveBackupError) throw err;
    throw new GoogleDriveReauthRequiredError(
      err instanceof Error ? err.message : 'Failed to obtain Google Drive token',
    );
  }
}

async function refreshDriveAccessToken(previousToken: string): Promise<string> {
  try {
    await GoogleSignin.clearCachedAccessToken(previousToken);
    await ensureDriveScope();
    return (await GoogleSignin.getTokens()).accessToken;
  } catch (err) {
    if (err instanceof GoogleDriveBackupError) throw err;
    throw new GoogleDriveReauthRequiredError();
  }
}

async function renewDriveScopeAccessToken(previousToken: string): Promise<string> {
  try {
    await GoogleSignin.clearCachedAccessToken(previousToken);
    await requestDriveScope();
    return (await GoogleSignin.getTokens()).accessToken;
  } catch (err) {
    if (err instanceof GoogleDriveBackupError) throw err;
    throw new GoogleDriveReauthRequiredError();
  }
}

async function driveFetch(
  path: string,
  init: RequestInit,
  retryOnAuth = true,
): Promise<Response> {
  const token = await getDriveAccessToken();
  const response = await fetch(`${DRIVE_API_BASE_URL}${path}`, {
    ...init,
    headers: {
      ...init.headers,
      Authorization: `Bearer ${token}`,
    },
  });

  if (response.status !== 401 && response.status !== 403) return response;

  const driveError = await parseDriveError(response.clone());
  if (driveError.code === 'quota_exceeded' || !retryOnAuth) throw driveError;

  const refreshedToken = driveError.code === 'permission_denied'
    ? await renewDriveScopeAccessToken(token)
    : await refreshDriveAccessToken(token);
  return fetch(`${DRIVE_API_BASE_URL}${path}`, {
    ...init,
    headers: {
      ...init.headers,
      Authorization: `Bearer ${refreshedToken}`,
    },
  });
}

async function expectJsonResponse(response: Response): Promise<unknown> {
  if (!response.ok) throw await parseDriveError(response);
  return readJson(response);
}

function buildListPath(): string {
  const params = new URLSearchParams({
    fields: 'files(id,name,size,createdTime,modifiedTime,appProperties)',
    orderBy: 'createdTime desc',
    q: "'appDataFolder' in parents and trashed = false",
    spaces: 'appDataFolder',
  });
  return `/files?${params.toString()}`;
}

function buildDriveFileMetadata(options: UploadBackupOptions): Record<string, unknown> {
  return {
    appProperties: {
      ...(options.checksum === undefined ? {} : { checksum: options.checksum }),
      ...(options.firebaseUid === undefined ? {} : { firebase_uid: options.firebaseUid }),
    },
    name: options.fileName,
    parents: ['appDataFolder'],
  };
}

async function createDriveFile(options: UploadBackupOptions): Promise<DriveBackupFile> {
  const response = await driveFetch(`/files?fields=${DRIVE_FILE_FIELDS}`, {
    body: JSON.stringify(buildDriveFileMetadata(options)),
    headers: { 'Content-Type': JSON_CONTENT_TYPE },
    method: 'POST',
  });
  const body = await expectJsonResponse(response);
  if (!isDriveFileResponse(body)) {
    throw new GoogleDriveBackupError('invalid_response', 'Invalid Drive create response');
  }
  return mapDriveFile(body);
}

async function uploadFileContent(
  fileId: string,
  options: UploadBackupOptions,
  token: string,
): Promise<DriveBackupFile> {
  let upload;
  try {
    upload = await RNFS.uploadFiles({
      binaryStreamOnly: true,
      files: [
        {
          filename: options.fileName,
          filepath: options.filePath,
          filetype: options.mimeType ?? SQLITE_MIME_TYPE,
          name: 'file',
        },
      ],
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': options.mimeType ?? SQLITE_MIME_TYPE,
      },
      method: 'PATCH',
      progress: (progress) => {
        options.onProgress?.({
          bytesSent: progress.totalBytesSent,
          totalBytes: progress.totalBytesExpectedToSend,
        });
      },
        toUrl: `${DRIVE_UPLOAD_BASE_URL}/files/${encodeURIComponent(fileId)}?uploadType=media&fields=${DRIVE_FILE_FIELDS}`,
    }).promise;
  } catch (err) {
    throw new GoogleDriveBackupError(
      'network_error',
      err instanceof Error ? err.message : 'Google Drive upload interrupted',
    );
  }

  if (upload.statusCode < 200 || upload.statusCode >= 300) {
    throw mapDriveErrorBody(upload.statusCode, upload.body);
  }

  const body = upload.body ? parseJsonString(upload.body) : null;
  if (!isDriveFileResponse(body)) {
    throw new GoogleDriveBackupError('invalid_response', 'Invalid Drive upload response');
  }
  return mapDriveFile(body);
}

async function deletePartialDownload(path: string): Promise<void> {
  if (await RNFS.exists(path)) {
    await RNFS.unlink(path);
  }
}

export async function listGoogleDriveBackups(): Promise<DriveBackupFile[]> {
  assertAndroid();
  const response = await driveFetch(buildListPath(), { method: 'GET' });
  const body = await expectJsonResponse(response);
  const files = isRecord(body) ? (body as DriveListResponse).files : null;
  if (!Array.isArray(files)) {
    throw new GoogleDriveBackupError('invalid_response', 'Invalid Drive list response');
  }

  return files.filter(isDriveFileResponse).map(mapDriveFile);
}

export async function verifyGoogleDriveBackupAccess(): Promise<void> {
  await listGoogleDriveBackups();
}

export async function uploadGoogleDriveBackup(
  options: UploadBackupOptions,
): Promise<DriveBackupFile> {
  assertAndroid();
  const createdFile = await createDriveFile(options);
  let token = await getDriveAccessToken();

  try {
    return await uploadFileContent(createdFile.id, options, token);
  } catch (err) {
    if (!(err instanceof GoogleDriveBackupError)) throw err;
    if (err.code === 'reauth_required') {
      token = await refreshDriveAccessToken(token);
    } else if (err.code === 'permission_denied') {
      token = await renewDriveScopeAccessToken(token);
    } else {
      throw err;
    }
    return uploadFileContent(createdFile.id, options, token);
  }
}

export async function downloadGoogleDriveBackup(
  fileId: string,
  destinationPath: string,
): Promise<void> {
  assertAndroid();
  let token = await getDriveAccessToken();
  const downloadUrl = `${DRIVE_API_BASE_URL}/files/${encodeURIComponent(fileId)}?alt=media`;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const result = await RNFS.downloadFile({
      fromUrl: downloadUrl,
      headers: { Authorization: `Bearer ${token}` },
      toFile: destinationPath,
    }).promise;
    if (result.statusCode >= 200 && result.statusCode < 300) return;
    await deletePartialDownload(destinationPath);
    if (attempt === 0 && (result.statusCode === 401 || result.statusCode === 403)) {
      token = await refreshDriveAccessToken(token);
    } else {
      throw new GoogleDriveBackupError(
        result.statusCode === 403 ? 'reauth_required' : 'api_error',
        `Google Drive download failed: ${result.statusCode}`,
      );
    }
  }
}

export async function deleteGoogleDriveBackup(fileId: string): Promise<void> {
  assertAndroid();
  const response = await driveFetch(
    `/files/${encodeURIComponent(fileId)}`,
    { method: 'DELETE' },
  );
  if (!response.ok) throw await parseDriveError(response);
}

export { DRIVE_APPDATA_SCOPE };
