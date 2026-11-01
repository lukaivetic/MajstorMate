
import { router } from 'expo-router';
import {
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
} from 'firebase/auth';
import { useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';

import { auth } from '../services/firebase';

export default function PrijavaScreen() {
  const [registracija, setRegistracija] = useState(false);
  const [email, setEmail] = useState('');
  const [lozinka, setLozinka] = useState('');
  const [loading, setLoading] = useState(false);
  const [greska, setGreska] = useState('');

  const prikaziGresku = (poruka: string) => {
    setGreska(poruka);

    if (Platform.OS !== 'web') {
      Alert.alert('Greška', poruka);
    }
  };

  const potvrdi = async () => {
    const cistEmail = email.trim();

    if (!cistEmail || !lozinka) {
      prikaziGresku('Unesi email adresu i lozinku.');
      return;
    }

    if (registracija && lozinka.length < 6) {
      prikaziGresku('Lozinka mora imati najmanje 6 karaktera.');
      return;
    }

    setLoading(true);
    setGreska('');

    try {
      if (registracija) {
        await createUserWithEmailAndPassword(
          auth,
          cistEmail,
          lozinka
        );
      } else {
        await signInWithEmailAndPassword(
          auth,
          cistEmail,
          lozinka
        );
      }

      router.replace('/');
    } catch (error: any) {
      const kod = error?.code;

      if (kod === 'auth/email-already-in-use') {
        prikaziGresku('Ova email adresa je već registrovana.');
      } else if (kod === 'auth/invalid-email') {
        prikaziGresku('Email adresa nije ispravna.');
      } else if (kod === 'auth/weak-password') {
        prikaziGresku('Izaberi jaču lozinku.');
      } else if (
        kod === 'auth/invalid-credential' ||
        kod === 'auth/wrong-password' ||
        kod === 'auth/user-not-found'
      ) {
        prikaziGresku('Pogrešan email ili lozinka.');
      } else if (kod === 'auth/too-many-requests') {
        prikaziGresku(
          'Previše pokušaja. Pokušaj ponovo kasnije.'
        );
      } else {
        prikaziGresku(
          'Došlo je do greške. Proveri internet vezu i pokušaj ponovo.'
        );
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.logo}>
        <Text style={styles.logoLetter}>M</Text>
      </View>

      <Text style={styles.brand}>
        Majstor<Text style={styles.brandAccent}>Mate</Text>
      </Text>

      <Text style={styles.subtitle}>
        Tvoj posao. Pod tvojom kontrolom.
      </Text>

      <View style={styles.card}>
        <Text style={styles.title}>
          {registracija ? 'Napravi nalog' : 'Dobrodošao nazad!'}
        </Text>

        <Text style={styles.description}>
          {registracija
            ? 'Registruj se i započni organizaciju svog posla.'
            : 'Prijavi se na svoj MajstorMate nalog.'}
        </Text>

        <Text style={styles.label}>Email adresa</Text>

        <TextInput
          style={styles.input}
          placeholder="primer@gmail.com"
          placeholderTextColor="#94A3B8"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          editable={!loading}
        />

        <Text style={styles.label}>Lozinka</Text>

        <TextInput
          style={styles.input}
          placeholder="Unesi lozinku"
          placeholderTextColor="#94A3B8"
          value={lozinka}
          onChangeText={setLozinka}
          secureTextEntry
          editable={!loading}
        />

        {greska ? (
          <Text style={styles.error}>{greska}</Text>
        ) : null}

        <Pressable
          style={[
            styles.primaryButton,
            loading && styles.disabledButton,
          ]}
          onPress={potvrdi}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.primaryButtonText}>
              {registracija ? 'Registruj se' : 'Prijavi se'}
            </Text>
          )}
        </Pressable>

        <Pressable
          onPress={() => {
            setRegistracija(!registracija);
            setGreska('');
          }}
          disabled={loading}
          style={styles.switchButton}
        >
          <Text style={styles.switchText}>
            {registracija
              ? 'Već imaš nalog? Prijavi se'
              : 'Nemaš nalog? Registruj se'}
          </Text>
        </Pressable>
      </View>

      <Text style={styles.footer}>
        MAJSTORMATE · TVOJ DIGITALNI POMOĆNIK
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F5F7FB',
  },
  content: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    paddingVertical: 50,
  },
  logo: {
    width: 65,
    height: 65,
    backgroundColor: '#DBEAFE',
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 15,
  },
  logoLetter: {
    color: '#2563EB',
    fontSize: 30,
    fontWeight: '800',
  },
  brand: {
    fontSize: 32,
    fontWeight: '800',
    color: '#172554',
    letterSpacing: -1,
  },
  brandAccent: {
    color: '#2563EB',
  },
  subtitle: {
    color: '#64748B',
    fontSize: 13,
    marginTop: 7,
    marginBottom: 30,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 28,
    width: '100%',
    maxWidth: 430,
    borderWidth: 1,
    borderColor: '#E8EDF5',
  },
  title: {
    color: '#172554',
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 9,
  },
  description: {
    color: '#64748B',
    fontSize: 13,
    lineHeight: 20,
    marginBottom: 25,
  },
  label: {
    color: '#334155',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 9,
  },
  input: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 15,
    paddingVertical: 14,
    fontSize: 14,
    color: '#172554',
    marginBottom: 20,
  },
  error: {
    color: '#DC2626',
    fontSize: 12,
    marginBottom: 16,
  },
  primaryButton: {
    backgroundColor: '#2563EB',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 5,
  },
  disabledButton: {
    opacity: 0.65,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  switchButton: {
    alignItems: 'center',
    marginTop: 23,
    padding: 5,
  },
  switchText: {
    color: '#2563EB',
    fontSize: 13,
    fontWeight: '700',
  },
  footer: {
    color: '#94A3B8',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
    textAlign: 'center',
    marginTop: 35,
  },
});
