# Task 03: Connectivity Service (react-native-netinfo)

## Goal

Install `@react-native-community/netinfo` and create a connectivity hook that the submit flow and offline queue can use to detect network state before making API calls.

## Description

Install the `@react-native-community/netinfo` package. Create a `useConnectivity` hook and a one-shot `checkConnectivity` utility in `apps/mobile/src/services/connectivity.ts`.

The hook provides:
- `isConnected: boolean` — device has any network connection
- `isInternetReachable: boolean | null` — actual internet access confirmed (null = unknown/checking)

The utility provides:
- `checkConnectivity(): Promise<boolean>` — one-shot check for submit flow (avoids hook overhead for single-use checks)

### Implementation notes

- `@react-native-community/netinfo` is the package name on npm (the spec references `react-native-netinfo` which redirects to this)
- The hook should subscribe to `NetInfo.addEventListener` for reactive updates
- `isInternetReachable` uses NetInfo's built-in reachability test which does a HEAD request to a known endpoint

### `connectivity.ts`

```ts
// app-wide hook — use in components that need reactive updates
export function useConnectivity(): {
  isConnected: boolean;
  isInternetReachable: boolean | null;
}

// one-shot check — use in submit handler before making API call
export async function checkConnectivity(): Promise<boolean>
```

### Files to create/modify

- **Modify** `apps/mobile/package.json` — add `@react-native-community/netinfo` dependency
- **Create** `apps/mobile/src/services/connectivity.ts`
- **Modify** (if needed) `apps/mobile/src/services/index.ts` — barrel export

## Acceptance Criteria

- [ ] `@react-native-community/netinfo` is listed in `package.json` dependencies
- [ ] `npm install` succeeds (native linking via autolinking)
- [ ] `useConnectivity` hook returns `{ isConnected, isInternetReachable }` that updates on network change
- [ ] `checkConnectivity()` returns `true` when online, `false` when offline
- [ ] Hook does not crash on mount (native module present)
- [ ] `npm run typecheck` passes
- [ ] `npm run lint` passes

## Dependencies

None
