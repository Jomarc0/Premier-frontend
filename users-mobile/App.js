import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AuthProvider, useAuth } from './src/context/AuthContext';
import BiometricUnlockScreen from './src/screens/BiometricUnlockScreen';
import DashboardScreen from './src/screens/DashboardScreen';
import LandingScreen from './src/screens/LandingScreen';
import LoginScreen from './src/screens/LoginScreen';
import TotpSetupScreen from './src/screens/TotpSetupScreen';
import TotpVerifyScreen from './src/screens/TotpVerifyScreen';
import { colors } from './src/theme';

const Stack = createNativeStackNavigator();

function Routes() {
  const { passenger, loading, needsBiometricUnlock } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={colors.maroon} />
      </View>
    );
  }

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {passenger ? (
        <Stack.Screen name="Dashboard" component={DashboardScreen} />
      ) : needsBiometricUnlock ? (
        <Stack.Screen name="BiometricUnlock" component={BiometricUnlockScreen} />
      ) : (
        <>
          <Stack.Screen name="Landing" component={LandingScreen} />
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="TotpSetup" component={TotpSetupScreen} />
          <Stack.Screen name="TotpVerify" component={TotpVerifyScreen} />
        </>
      )}
    </Stack.Navigator>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <NavigationContainer>
          <StatusBar style="light" />
          <Routes />
        </NavigationContainer>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
