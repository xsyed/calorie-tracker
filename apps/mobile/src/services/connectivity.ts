import { fetch, useNetInfo } from '@react-native-community/netinfo';

import type { BackupPreferences } from '../database';

export function useConnectivity(): {
  isConnected: boolean;
  isInternetReachable: boolean | null;
} {
  const state = useNetInfo();
  return {
    isConnected: state.isConnected ?? false,
    isInternetReachable: state.isInternetReachable,
  };
}

export async function checkConnectivity(): Promise<boolean> {
  const state = await fetch();
  return state.isConnected === true;
}

export async function checkBackupNetworkConstraints(
  preferences: BackupPreferences,
): Promise<boolean> {
  const state = await fetch();
  if (state.isConnected !== true) return false;
  if (!preferences.wifi_only) return true;
  return state.type === 'wifi';
}
