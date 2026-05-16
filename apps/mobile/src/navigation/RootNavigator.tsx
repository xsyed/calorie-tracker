import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { useAuth } from '../auth';
import { initDatabase, userExists } from '../database';
import HomeScreen from '../screens/HomeScreen';
import LoginScreen from '../screens/LoginScreen';
import OnboardingScreen from '../screens/OnboardingScreen';
import SettingsScreen from '../screens/SettingsScreen';
import SplashScreen from '../screens/SplashScreen';
import WaterScreen from '../screens/WaterScreen';
import WeightScreen from '../screens/WeightScreen';
import { FlushTriggers } from '../services/FlushTriggers';
import type { RootStackParamList, RootTabParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<RootTabParamList>();

function AuthenticatedTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarIcon: ({ color, focused }) => (
          <TabIcon color={color} focused={focused} routeName={route.name} />
        ),
      })}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{ tabBarLabel: 'Home' }}
      />
      <Tab.Screen
        name="Weight"
        component={WeightScreen}
        options={{ tabBarLabel: 'Weight' }}
      />
    </Tab.Navigator>
  );
}

interface TabIconProps {
  color: string;
  focused: boolean;
  routeName: keyof RootTabParamList;
}

function TabIcon({ color, focused, routeName }: TabIconProps) {
  return (
    <View
      style={[
        styles.tabIcon,
        focused && styles.tabIconFocused,
        { borderColor: color },
      ]}
    >
      {routeName === 'Home' ? (
        <>
          <View style={[styles.homeRoof, { borderBottomColor: color }]} />
          <View style={[styles.homeBase, { borderColor: color }]} />
        </>
      ) : (
        <>
          <View style={[styles.weightDial, { borderColor: color }]} />
          <View style={[styles.weightNeedle, { backgroundColor: color }]} />
          <View style={[styles.weightBase, { borderColor: color }]} />
        </>
      )}
    </View>
  );
}

export default function RootNavigator() {
  const auth = useAuth();
  const [userCheckState, setUserCheckState] = useState<
    'pending' | 'exists' | 'not-exists'
  >('pending');
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [appJustLaunched, setAppJustLaunched] = useState(true);
  const prevStatus = useRef(auth.status);

  useEffect(() => {
    initDatabase();
  }, []);

  useEffect(() => {
    if (auth.status !== 'checking' && appJustLaunched) {
      setAppJustLaunched(false);
      if (auth.status === 'authenticated') {
        auth.getIdToken(true).catch(async (err) => {
          if (!isNetworkError(err)) {
            setSessionError('Session expired. Please sign in again.');
            await auth.signOut();
          }
        });
      }
    }
  }, [auth.status, appJustLaunched, auth.getIdToken, auth.signOut]);

  useEffect(() => {
    if (auth.status === 'authenticated' && auth.user) {
      userExists(auth.user.uid)
        .then((exists) => {
          setUserCheckState(exists ? 'exists' : 'not-exists');
        })
        .catch(() => {
          setUserCheckState('not-exists');
        });
    } else {
      setUserCheckState('pending');
    }
  }, [auth.status, auth.user?.uid]);

  useEffect(() => {
    if (prevStatus.current === 'unauthenticated' && auth.status === 'authenticated') {
      setSessionError(null);
    }
    if (auth.status === 'checking') {
      setSessionError(null);
    }
    prevStatus.current = auth.status;
  }, [auth.status]);

  const handleOnboardingComplete = useCallback(() => {
    setUserCheckState('exists');
  }, []);

  const showSplash =
    auth.status === 'checking' ||
    (auth.status === 'authenticated' && userCheckState === 'pending');

  return (
    <>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {showSplash ? (
          <Stack.Screen name="Splash" component={SplashScreen} />
        ) : auth.status === 'unauthenticated' ? (
          <Stack.Screen
            name="Login"
            component={LoginScreen}
            initialParams={
              sessionError !== null ? { message: sessionError } : undefined
            }
          />
        ) : userCheckState === 'exists' ? (
          <>
            <Stack.Screen name="Home" component={AuthenticatedTabs} />
            <Stack.Screen name="Water" component={WaterScreen} />
            <Stack.Screen name="Settings" component={SettingsScreen} />
          </>
        ) : (
          <Stack.Screen
            name="Onboarding"
            component={OnboardingScreen}
            initialParams={{ onOnboardingComplete: handleOnboardingComplete }}
          />
        )}
      </Stack.Navigator>
      {userCheckState === 'exists' && <FlushTriggers />}
    </>
  );
}

function isNetworkError(err: unknown): boolean {
  if (
    err instanceof Error &&
    'code' in err &&
    typeof (err as Record<string, unknown>).code === 'string'
  ) {
    return (err as Record<string, unknown>).code ===
      'auth/network-request-failed';
  }
  if (err instanceof Error) {
    return err.message.toLowerCase().includes('network');
  }
  return false;
}

const styles = StyleSheet.create({
  tabIcon: {
    width: 28,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabIconFocused: {
    opacity: 1,
  },
  homeRoof: {
    width: 0,
    height: 0,
    borderLeftWidth: 10,
    borderRightWidth: 10,
    borderBottomWidth: 9,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
  },
  homeBase: {
    width: 18,
    height: 12,
    marginTop: -1,
    borderWidth: 2,
    borderTopWidth: 0,
    borderBottomLeftRadius: 2,
    borderBottomRightRadius: 2,
  },
  weightDial: {
    position: 'absolute',
    top: 2,
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
  },
  weightNeedle: {
    position: 'absolute',
    top: 8,
    width: 2,
    height: 8,
    borderRadius: 1,
    transform: [{ rotate: '25deg' }],
  },
  weightBase: {
    width: 22,
    height: 18,
    marginTop: 5,
    borderWidth: 2,
    borderRadius: 6,
  },
});
