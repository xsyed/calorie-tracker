import { fetch, useNetInfo } from '@react-native-community/netinfo';

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
