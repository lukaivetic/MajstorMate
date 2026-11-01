
import { useEffect, useState } from 'react';
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

import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../services/firebase';

import {
    ProfilMajstora,
    sacuvajFirebaseProfil,
    ucitajFirebaseProfil,
} from '../services/firebaseProfil';

const prazanProfil: ProfilMajstora = {
  ime: '',
  firma: '',
  telefon: '',
  adresa: '',
  usluga: '',
};

export default function ProfilScreen() {
  const [profil, setProfil] =
    useState<ProfilMajstora>(prazanProfil);

  const [ucitavanje, setUcitavanje] = useState(true);
  const [cuvanje, setCuvanje] = useState(false);
  const [greska, setGreska] = useState('');

  useEffect(() => {
    let aktivno = true;

    const odjava = onAuthStateChanged(
      auth,
      async (korisnik) => {
        if (!korisnik) {
          if (aktivno) {
            setUcitajGresku('Korisnik nije prijavljen.');
          }
          return;
        }

        try {
          const podaci = await ucitajFirebaseProfil();

          if (aktivno) {
            setProfil(podaci);
            setGreska('');
          }
        } catch (error) {
          console.error(error);

          if (aktivno) {
            setGreska('Nije uspelo učitavanje profila.');
          }
        } finally {
          if (aktivno) {
            setUcitavanje(false);
          }
        }
      }
    );

    return () => {
      aktivno = false;
      odjava();
    };
  }, []);

  const setUcitajGresku = (poruka: string) => {
    setGreska(poruka);
    setUcitavanje(false);
  };

  const promeniPolje = (
    polje: keyof ProfilMajstora,
    vrednost: string
  ) => {
    setProfil((prethodni) => ({
      ...prethodni,
      [polje]: vrednost,
    }));
  };

  const prikaziPoruku = (
    naslov: string,
    poruka: string
  ) => {
    if (Platform.OS === 'web') {
      window.alert(poruka);
    } else {
      Alert.alert(naslov, poruka);
    }
  };

  const sacuvaj = async () => {
    if (cuvanje || ucitavanje) return;

    if (!profil.ime.trim()) {
      prikaziPoruku(
        'Nedostaje ime',
        'Unesi ime i prezime majstora.'
      );
      return;
    }

    try {
      setCuvanje(true);

      const sredjenProfil: ProfilMajstora = {
        ime: profil.ime.trim(),
        firma: profil.firma.trim(),
        telefon: profil.telefon.trim(),
        adresa: profil.adresa.trim(),
        usluga: profil.usluga.trim(),
      };

      await sacuvajFirebaseProfil(sredjenProfil);

      setProfil(sredjenProfil);

      prikaziPoruku(
        'Uspešno',
        'Profil je uspešno sačuvan!'
      );
    } catch (error) {
      console.error(error);

      prikaziPoruku(
        'Greška',
        'Nije uspelo čuvanje profila.'
      );
    } finally {
      setCuvanje(false);
    }
  };

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.title}>Moj profil</Text>

      <Text style={styles.subtitle}>
        Podaci o majstoru i poslovanju.
      </Text>

      {ucitavanje ? (
        <View style={styles.card}>
          <ActivityIndicator
            size="large"
            color="#2563EB"
          />

          <Text style={styles.loadingText}>
            Učitavanje profila...
          </Text>
        </View>
      ) : greska ? (
        <View style={styles.card}>
          <Text style={styles.errorText}>
            {greska}
          </Text>
        </View>
      ) : (
        <View style={styles.card}>
          <View style={styles.header}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                👷
              </Text>
            </View>

            <View style={styles.headerText}>
              <Text style={styles.cardTitle}>
                Podaci o majstoru
              </Text>

              <Text style={styles.cardSubtitle}>
                Ovi podaci će se koristiti i na
                radnim nalozima.
              </Text>
            </View>
          </View>

          <Text style={styles.label}>
            Ime i prezime *
          </Text>

          <TextInput
            style={styles.input}
            placeholder="Npr. Marko Marković"
            placeholderTextColor="#94A3B8"
            value={profil.ime}
            onChangeText={(vrednost) =>
              promeniPolje('ime', vrednost)
            }
          />

          <Text style={styles.label}>
            Naziv firme ili radionice
          </Text>

          <TextInput
            style={styles.input}
            placeholder="Npr. Marko Elektro Servis"
            placeholderTextColor="#94A3B8"
            value={profil.firma}
            onChangeText={(vrednost) =>
              promeniPolje('firma', vrednost)
            }
          />

          <Text style={styles.label}>
            Broj telefona
          </Text>

          <TextInput
            style={styles.input}
            placeholder="Npr. 060 123 4567"
            placeholderTextColor="#94A3B8"
            keyboardType="phone-pad"
            value={profil.telefon}
            onChangeText={(vrednost) =>
              promeniPolje('telefon', vrednost)
            }
          />

          <Text style={styles.label}>
            Adresa
          </Text>

          <TextInput
            style={styles.input}
            placeholder="Npr. Kikinda, Srbija"
            placeholderTextColor="#94A3B8"
            value={profil.adresa}
            onChangeText={(vrednost) =>
              promeniPolje('adresa', vrednost)
            }
          />

          <Text style={styles.label}>
            Vrsta usluge
          </Text>

          <TextInput
            style={styles.input}
            placeholder="Npr. Električar"
            placeholderTextColor="#94A3B8"
            value={profil.usluga}
            onChangeText={(vrednost) =>
              promeniPolje('usluga', vrednost)
            }
          />

          <Pressable
            style={[
              styles.saveButton,
              cuvanje && styles.disabledButton,
            ]}
            onPress={() => void sacuvaj()}
            disabled={cuvanje}
          >
            {cuvanje ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.saveButtonText}>
                💾 Sačuvaj profil
              </Text>
            )}
          </Pressable>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F5F7FB',
  },
  content: {
    width: '100%',
    maxWidth: 850,
    alignSelf: 'center',
    padding: 24,
    paddingBottom: 50,
  },
  title: {
    color: '#172554',
    fontSize: 30,
    fontWeight: '800',
    marginBottom: 8,
  },
  subtitle: {
    color: '#64748B',
    fontSize: 14,
    marginBottom: 25,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 24,
    borderWidth: 1,
    borderColor: '#E8EDF5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 30,
  },
  avatar: {
    width: 62,
    height: 62,
    borderRadius: 18,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 30,
  },
  headerText: {
    flex: 1,
  },
  cardTitle: {
    color: '#172554',
    fontSize: 19,
    fontWeight: '800',
    marginBottom: 5,
  },
  cardSubtitle: {
    color: '#64748B',
    fontSize: 13,
    lineHeight: 19,
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
    borderColor: '#CBD5E1',
    borderRadius: 11,
    paddingHorizontal: 15,
    paddingVertical: 13,
    fontSize: 14,
    color: '#172554',
    marginBottom: 22,
  },
  saveButton: {
    backgroundColor: '#2563EB',
    borderRadius: 11,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  disabledButton: {
    opacity: 0.6,
  },
  loadingText: {
    color: '#64748B',
    textAlign: 'center',
    marginTop: 15,
  },
  errorText: {
    color: '#DC2626',
    textAlign: 'center',
    fontSize: 14,
  },
});
