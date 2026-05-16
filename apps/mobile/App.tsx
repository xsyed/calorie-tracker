import { Platform, StatusBar, useColorScheme } from 'react-native';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AuthProvider } from './src/auth';
import RootNavigator from './src/navigation/RootNavigator';
import { DRIVE_APPDATA_SCOPE } from './src/services';

const googleSignInConfig = {
  webClientId:
    '86581074055-4f6s1hmpdtjo0mqb86lmot2qt4aecn6b.apps.googleusercontent.com',
  offlineAccess: true,
};

GoogleSignin.configure(
  Platform.OS === 'android'
    ? { ...googleSignInConfig, scopes: [DRIVE_APPDATA_SCOPE] }
    : googleSignInConfig,
);

function App() {
  const isDarkMode = useColorScheme() === 'dark';

  return (
    <SafeAreaProvider>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
      <AuthProvider>
        <NavigationContainer>
          <RootNavigator />
        </NavigationContainer>
      </AuthProvider>
    </SafeAreaProvider>
  );
}

export default App;
