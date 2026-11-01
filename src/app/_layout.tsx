
import {
  DarkTheme,
  DefaultTheme,
  Stack,
  ThemeProvider,
  useRouter,
  useSegments,
} from 'expo-router';

import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  useColorScheme,
  View,
} from 'react-native';

import {
  onAuthStateChanged,
  type User,
} from 'firebase/auth';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { auth } from '../services/firebase';

void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const router = useRouter();
  const segments = useSegments();

  const [korisnik, setKorisnik] = useState<User | null>(null);
  const [proveraZavrsena, setProveraZavrsena] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setKorisnik(user);
      setProveraZavrsena(true);
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!proveraZavrsena) return;

    const naPrijavi = segments[0] === 'prijava';

    if (!korisnik && !naPrijavi) {
      router.replace('/prijava');
    } else if (korisnik && naPrijavi) {
      router.replace('/');
    }
  }, [korisnik, proveraZavrsena, segments, router]);

  const naPrijavi = segments[0] === 'prijava';

  const prikaziPrijavu = proveraZavrsena && !korisnik && naPrijavi;

  const prikaziAplikaciju =
    proveraZavrsena && !!korisnik && !naPrijavi;

  const prikaziSadrzaj = prikaziPrijavu || prikaziAplikaciju;

  return (
    <ThemeProvider
      value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}
    >
      <AnimatedSplashOverlay />

      <View style={styles.container}>
        <View
          style={[
            styles.stackContainer,
            !prikaziSadrzaj && styles.sakriveno,
          ]}
          pointerEvents={prikaziSadrzaj ? 'auto' : 'none'}
        >
          <Stack>
            <Stack.Screen
              name="index"
              options={{ headerShown: false }}
            />

            <Stack.Screen
              name="prijava"
              options={{ headerShown: false }}
            />

            <Stack.Screen
              name="novi-nalog"
              options={{
                title: 'Novi radni nalog',
                headerBackTitle: 'Nazad',
              }}
            />

            <Stack.Screen
              name="radni-nalozi"
              options={{ title: 'Radni nalozi' }}
            />

            <Stack.Screen
              name="musterije"
              options={{ title: 'Mušterije' }}
            />

            <Stack.Screen
              name="kalendar"
              options={{ title: 'Kalendar' }}
            />

            <Stack.Screen
              name="finansije"
              options={{ title: 'Finansijski izveštaji' }}
            />
          </Stack>
        </View>

        {!prikaziSadrzaj && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator
              size="large"
              color="#2563EB"
            />

            <Text style={styles.loadingText}>
              Provera prijave...
            </Text>
          </View>
        )}
      </View>
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  stackContainer: {
    flex: 1,
  },
  sakriveno: {
    opacity: 0,
  },
  loadingContainer: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F5F7FB',
  },
  loadingText: {
    marginTop: 12,
    color: '#64748B',
    fontSize: 14,
    fontWeight: '600',
  },
});
