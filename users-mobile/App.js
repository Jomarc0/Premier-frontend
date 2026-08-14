import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, Text, TextInput, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { PostHogProvider } from 'posthog-react-native';

import { AuthProvider, useAuth } from './src/context/AuthContext';
import { RealtimeProvider } from './src/context/RealtimeContext';
import DashboardScreen from './src/screens/DashboardScreen';
import LandingScreen from './src/screens/LandingScreen';
import LoginScreen from './src/screens/LoginScreen';
import MobileNfcPaymentScreen from './src/screens/MobileNfcPaymentScreen';
import QRFarePaymentScreen from './src/screens/QRFarePaymentScreen';
import ReportLostCardScreen from './src/screens/ReportLostCardScreen';
import TotpSetupScreen from './src/screens/TotpSetupScreen';
import TotpVerifyScreen from './src/screens/TotpVerifyScreen';
import { POSTHOG_HOST, POSTHOG_KEY } from './src/analytics/posthog';
import { colors } from './src/theme';


Text.defaultProps = Text.defaultProps || {};
Text.defaultProps.allowFontScaling = false;
TextInput.defaultProps = TextInput.defaultProps || {};
TextInput.defaultProps.allowFontScaling = false;
const Stack = createNativeStackNavigator();

function Routes() {
  const { passenger, loading } = useAuth();

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
        <>
          <Stack.Screen name="Dashboard" component={DashboardScreen} />
          <Stack.Screen name="MobileNfcPayment" component={MobileNfcPaymentScreen} />
          <Stack.Screen name="QRFarePayment" component={QRFarePaymentScreen} />
          <Stack.Screen name="ReportLostCard" component={ReportLostCardScreen} />
        </>
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
      <NavigationContainer>
        <PostHogProvider apiKey={POSTHOG_KEY} options={{ host: POSTHOG_HOST }}>
          <AuthProvider>
            <RealtimeProvider>
              <StatusBar style="light" />
              <Routes />
            </RealtimeProvider>
          </AuthProvider>
        </PostHogProvider>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}


