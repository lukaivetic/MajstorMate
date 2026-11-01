
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { ucitajFirebaseNaloge } from '../services/firebaseNalozi';
import type { RadniNalog } from '../services/nalozi';

type Musterija = {
  kljuc: string;
  ime: string;
  telefon: string;
  nalozi: RadniNalog[];
};

export default function Musterije() {
  const [nalozi, setNalozi] = useState<RadniNalog[]>([]);
  const [otvorenaMusterija, setOtvorenaMusterija] =
    useState<string | null>(null);

  const [ucitavanje, setUcitavanje] = useState(true);
  const [greska, setGreska] = useState('');

  // Ucitavanje radnih naloga iz Firebase baze
  useFocusEffect(
    useCallback(() => {
      let aktivno = true;

      const ucitaj = async () => {
        setUcitavanje(true);
        setGreska('');

        try {
          const podaci = await ucitajFirebaseNaloge();

          if (aktivno) {
            setNalozi(podaci);
          }
        } catch (error) {
          console.error(error);

          if (aktivno) {
            setNalozi([]);
            setGreska(
              'Nije uspelo učitavanje mušterija iz Firebase baze.'
            );
          }
        } finally {
          if (aktivno) {
            setUcitavanje(false);
          }
        }
      };

      void ucitaj();

      return () => {
        aktivno = false;
      };
    }, [])
  );

  // Grupisanje radnih naloga po musterijama
  const musterije: Musterija[] = [];

  nalozi.forEach((nalog) => {
    const telefon = nalog.telefon.trim();
    const ime = nalog.ime.trim();

    const kljuc = telefon
      ? `telefon:${telefon.replace(/\s/g, '')}`
      : `ime:${ime.toLowerCase()}`;

    const postojeca = musterije.find(
      (musterija) => musterija.kljuc === kljuc
    );

    if (postojeca) {
      postojeca.nalozi.push(nalog);
    } else {
      musterije.push({
        kljuc,
        ime,
        telefon,
        nalozi: [nalog],
      });
    }
  });

  // Ukupna zarada od zavrsenih poslova musterije
  const izracunajUkupno = (poslovi: RadniNalog[]) => {
    return poslovi
      .filter((nalog) => nalog.status === 'Završen')
      .reduce((ukupno, nalog) => {
        const cena = Number(
          nalog.cena.replace(/\s/g, '').replace(',', '.')
        );

        return ukupno + (Number.isFinite(cena) ? cena : 0);
      }, 0);
  };

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
    >
      <View style={styles.header}>
        <Text style={styles.title}>👥 Mušterije</Text>

        <Text style={styles.subtitle}>
          Evidencija mušterija i njihovih poslova.
        </Text>
      </View>

      <View style={styles.summaryCard}>
        <Text style={styles.summaryLabel}>
          UKUPNO MUŠTERIJA
        </Text>

        <Text style={styles.summaryNumber}>
          {ucitavanje || greska ? '—' : musterije.length}
        </Text>
      </View>

      {ucitavanje ? (
        <View style={styles.card}>
          <ActivityIndicator
            size="large"
            color="#2563EB"
          />

          <Text style={styles.loadingText}>
            Učitavanje mušterija iz Firebase baze...
          </Text>
        </View>
      ) : greska ? (
        <View style={styles.card}>
          <Text style={styles.errorText}>
            {greska}
          </Text>
        </View>
      ) : musterije.length === 0 ? (
        <View style={styles.card}>
          <Text style={styles.empty}>
            Još nema mušterija. Dodaj prvi radni nalog!
          </Text>
        </View>
      ) : (
        musterije.map((musterija) => {
          const otvorena =
            otvorenaMusterija === musterija.kljuc;

          const zavrseni = musterija.nalozi.filter(
            (nalog) => nalog.status === 'Završen'
          );

          const ukupno = izracunajUkupno(musterija.nalozi);

          return (
            <View
              key={musterija.kljuc}
              style={styles.card}
            >
              <View style={styles.customerHeader}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>
                    {musterija.ime.charAt(0).toUpperCase()}
                  </Text>
                </View>

                <View style={styles.customerInfo}>
                  <Text style={styles.name}>
                    {musterija.ime}
                  </Text>

                  <Text style={styles.phone}>
                    📞 {musterija.telefon || 'Telefon nije unet'}
                  </Text>
                </View>
              </View>

              <View style={styles.stats}>
                <View>
                  <Text style={styles.statNumber}>
                    {musterija.nalozi.length}
                  </Text>

                  <Text style={styles.statLabel}>
                    Ukupno poslova
                  </Text>
                </View>

                <View>
                  <Text style={styles.statNumber}>
                    {zavrseni.length}
                  </Text>

                  <Text style={styles.statLabel}>
                    Završeno
                  </Text>
                </View>
              </View>

              <View style={styles.earnings}>
                <Text style={styles.earningsLabel}>
                  Vrednost završenih poslova
                </Text>

                <Text style={styles.earningsValue}>
                  {ukupno.toLocaleString('sr-RS')} RSD
                </Text>
              </View>

              <Pressable
                style={styles.detailsButton}
                onPress={() =>
                  setOtvorenaMusterija(
                    otvorena ? null : musterija.kljuc
                  )
                }
              >
                <Text style={styles.detailsButtonText}>
                  {otvorena
                    ? 'Sakrij poslove ↑'
                    : 'Prikaži poslove ↓'}
                </Text>
              </Pressable>

              {otvorena && (
                <View style={styles.jobs}>
                  {musterija.nalozi.map((nalog) => (
                    <View
                      key={nalog.id}
                      style={styles.job}
                    >
                      <Text style={styles.jobDescription}>
                        🔧 {nalog.opis}
                      </Text>

                      <Text style={styles.jobDetail}>
                        📅 {nalog.datum || 'Datum nije unet'}
                      </Text>

                      <Text style={styles.jobDetail}>
                        Status: {nalog.status || 'Zakazan'}
                      </Text>

                      <Text style={styles.jobPrice}>
                        {nalog.cena
                          ? `${nalog.cena} RSD`
                          : 'Cena nije uneta'}
                      </Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          );
        })
      )}

      <Pressable
        style={styles.backButton}
        onPress={() => router.push('/')}
      >
        <Text style={styles.backButtonText}>
          ← Nazad na Dashboard
        </Text>
      </Pressable>
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
  header: {
    marginBottom: 24,
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
  },
  summaryCard: {
    backgroundColor: '#EFF6FF',
    borderRadius: 18,
    padding: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  summaryLabel: {
    color: '#64748B',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
  },
  summaryNumber: {
    color: '#1D4ED8',
    fontSize: 35,
    fontWeight: '800',
    marginTop: 8,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E8EDF5',
    marginBottom: 15,
  },
  empty: {
    color: '#64748B',
    textAlign: 'center',
    fontSize: 14,
  },
  loadingText: {
    color: '#64748B',
    textAlign: 'center',
    fontSize: 14,
    marginTop: 12,
  },
  errorText: {
    color: '#DC2626',
    textAlign: 'center',
    fontSize: 14,
  },
  customerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 20,
  },
  avatar: {
    width: 45,
    height: 45,
    borderRadius: 15,
    backgroundColor: '#DBEAFE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#1D4ED8',
    fontSize: 20,
    fontWeight: '800',
  },
  customerInfo: {
    flex: 1,
  },
  name: {
    color: '#172554',
    fontSize: 17,
    fontWeight: '800',
    marginBottom: 5,
  },
  phone: {
    color: '#64748B',
    fontSize: 13,
  },
  stats: {
    flexDirection: 'row',
    gap: 45,
    marginBottom: 20,
  },
  statNumber: {
    color: '#172554',
    fontSize: 23,
    fontWeight: '800',
  },
  statLabel: {
    color: '#64748B',
    fontSize: 11,
    marginTop: 4,
  },
  earnings: {
    backgroundColor: '#F0FDF4',
    borderRadius: 12,
    padding: 14,
    marginBottom: 15,
  },
  earningsLabel: {
    color: '#64748B',
    fontSize: 12,
    marginBottom: 6,
  },
  earningsValue: {
    color: '#15803D',
    fontSize: 20,
    fontWeight: '800',
  },
  detailsButton: {
    backgroundColor: '#EFF6FF',
    borderRadius: 10,
    padding: 12,
    alignItems: 'center',
  },
  detailsButtonText: {
    color: '#2563EB',
    fontSize: 13,
    fontWeight: '700',
  },
  jobs: {
    marginTop: 15,
    gap: 10,
  },
  job: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  jobDescription: {
    color: '#172554',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 8,
  },
  jobDetail: {
    color: '#64748B',
    fontSize: 12,
    marginBottom: 6,
  },
  jobPrice: {
    color: '#2563EB',
    fontSize: 14,
    fontWeight: '800',
    marginTop: 5,
  },
  backButton: {
    padding: 15,
    alignItems: 'center',
    marginTop: 10,
  },
  backButtonText: {
    color: '#2563EB',
    fontSize: 14,
    fontWeight: '700',
  },
});
