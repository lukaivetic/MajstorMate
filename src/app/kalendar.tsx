
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

const meseci = [
  'Januar',
  'Februar',
  'Mart',
  'April',
  'Maj',
  'Jun',
  'Jul',
  'Avgust',
  'Septembar',
  'Oktobar',
  'Novembar',
  'Decembar',
];

const daniUNedelji = [
  'Pon',
  'Uto',
  'Sre',
  'Čet',
  'Pet',
  'Sub',
  'Ned',
];

function formatirajDatum(datum: Date): string {
  const dan = String(datum.getDate()).padStart(2, '0');
  const mesec = String(datum.getMonth() + 1).padStart(2, '0');
  const godina = datum.getFullYear();

  return `${dan}.${mesec}.${godina}`;
}

function datumNaloga(nalog: RadniNalog): string {
  const delovi = nalog.datum.trim().split('.');

  if (delovi.length < 3) {
    return '';
  }

  const dan = Number(delovi[0]);
  const mesec = Number(delovi[1]);
  const godina = Number(delovi[2]);

  if (
    !Number.isInteger(dan) ||
    !Number.isInteger(mesec) ||
    !Number.isInteger(godina)
  ) {
    return '';
  }

  const datum = new Date(godina, mesec - 1, dan);

  if (
    datum.getDate() !== dan ||
    datum.getMonth() !== mesec - 1 ||
    datum.getFullYear() !== godina
  ) {
    return '';
  }

  return formatirajDatum(datum);
}

export default function Kalendar() {
  const [nalozi, setNalozi] = useState<RadniNalog[]>([]);

  const [prikazaniMesec, setPrikazaniMesec] = useState(
    () => new Date(new Date().getFullYear(), new Date().getMonth(), 1)
  );

  const [izabraniDatum, setIzabraniDatum] = useState(
    () => formatirajDatum(new Date())
  );

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
              'Nije uspelo učitavanje kalendara iz Firebase baze.'
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

  const godina = prikazaniMesec.getFullYear();
  const mesec = prikazaniMesec.getMonth();

  const brojDanaUMesecu = new Date(
    godina,
    mesec + 1,
    0
  ).getDate();

  // JavaScript: nedelja = 0, ponedeljak = 1.
  // Nama je potreban ponedeljak kao prvi dan.
  const prviDanUNedelji =
    (new Date(godina, mesec, 1).getDay() + 6) % 7;

  const danasnjiDatum = formatirajDatum(new Date());

  const prethodniMesec = () => {
    setPrikazaniMesec(
      new Date(godina, mesec - 1, 1)
    );
  };

  const sledeciMesec = () => {
    setPrikazaniMesec(
      new Date(godina, mesec + 1, 1)
    );
  };

  const vratiNaDanas = () => {
    const danas = new Date();

    setPrikazaniMesec(
      new Date(danas.getFullYear(), danas.getMonth(), 1)
    );

    setIzabraniDatum(formatirajDatum(danas));
  };

  const izaberiDan = (dan: number) => {
    const datum = new Date(godina, mesec, dan);
    setIzabraniDatum(formatirajDatum(datum));
  };

  const brojPoslovaZaDatum = (datum: string) => {
    return nalozi.filter(
      (nalog) => datumNaloga(nalog) === datum
    ).length;
  };

  const posloviZaIzabraniDan = nalozi
    .filter(
      (nalog) => datumNaloga(nalog) === izabraniDatum
    )
    .sort((a, b) => a.vreme.localeCompare(b.vreme));

  // Prazna polja pre prvog dana + dani u mesecu.
  const polja: (number | null)[] = [];

  for (let i = 0; i < prviDanUNedelji; i++) {
    polja.push(null);
  }

  for (let dan = 1; dan <= brojDanaUMesecu; dan++) {
    polja.push(dan);
  }

  // Dopunimo poslednju nedelju praznim poljima.
  while (polja.length % 7 !== 0) {
    polja.push(null);
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
    >
      <Text style={styles.title}>📅 Kalendar poslova</Text>

      <Text style={styles.subtitle}>
        Pregled zakazanih poslova po danima.
      </Text>

      <View style={styles.calendarCard}>
        <View style={styles.monthHeader}>
          <Pressable
            style={styles.monthButton}
            onPress={prethodniMesec}
          >
            <Text style={styles.monthButtonText}>‹</Text>
          </Pressable>

          <Text style={styles.monthTitle}>
            {meseci[mesec]} {godina}.
          </Text>

          <Pressable
            style={styles.monthButton}
            onPress={sledeciMesec}
          >
            <Text style={styles.monthButtonText}>›</Text>
          </Pressable>
        </View>

        <Pressable
          style={styles.todayButton}
          onPress={vratiNaDanas}
        >
          <Text style={styles.todayButtonText}>
            Vrati na danas
          </Text>
        </Pressable>

        <View style={styles.calendarGrid}>
          {daniUNedelji.map((dan) => (
            <View key={dan} style={styles.dayCell}>
              <Text style={styles.weekdayText}>
                {dan}
              </Text>
            </View>
          ))}

          {polja.map((dan, index) => {
            if (dan === null) {
              return (
                <View
                  key={`prazno-${index}`}
                  style={styles.dayCell}
                />
              );
            }

            const datum = formatirajDatum(
              new Date(godina, mesec, dan)
            );

            const brojPoslova = brojPoslovaZaDatum(datum);

            const izabran = datum === izabraniDatum;
            const danas = datum === danasnjiDatum;

            return (
              <Pressable
                key={datum}
                style={[
                  styles.dayCell,
                  styles.calendarDay,
                  izabran && styles.selectedDay,
                  danas && !izabran && styles.currentDay,
                ]}
                onPress={() => izaberiDan(dan)}
              >
                <Text
                  style={[
                    styles.dayNumber,
                    izabran && styles.selectedDayText,
                  ]}
                >
                  {dan}
                </Text>

                {brojPoslova > 0 && (
                  <View
                    style={[
                      styles.jobIndicator,
                      izabran && styles.selectedIndicator,
                    ]}
                  >
                    <Text
                      style={[
                        styles.jobIndicatorText,
                        izabran &&
                          styles.selectedIndicatorText,
                      ]}
                    >
                      {brojPoslova}
                    </Text>
                  </View>
                )}
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.legend}>
          Broj u oznaci pokazuje koliko poslova ima tog dana.
        </Text>
      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>
          Poslovi za {izabraniDatum}
        </Text>

        <Text style={styles.countText}>
          {ucitavanje || greska
            ? '—'
            : posloviZaIzabraniDan.length}
        </Text>
      </View>

      {ucitavanje ? (
        <View style={styles.emptyCard}>
          <ActivityIndicator
            size="large"
            color="#2563EB"
          />
          <Text style={[styles.emptyText, styles.loadingText]}>
            Učitavanje poslova iz Firebase baze...
          </Text>
        </View>
      ) : greska ? (
        <View style={styles.emptyCard}>
          <Text style={styles.errorText}>
            {greska}
          </Text>
        </View>
      ) : posloviZaIzabraniDan.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyText}>
            Nema zakazanih poslova za ovaj datum.
          </Text>
        </View>
      ) : (
        posloviZaIzabraniDan.map((nalog) => {
          const status = nalog.status || 'Zakazan';

          return (
            <View key={nalog.id} style={styles.jobCard}>
              <View style={styles.jobHeader}>
                <Text style={styles.customerName}>
                  {nalog.ime}
                </Text>

                <Text style={styles.jobTime}>
                  {nalog.vreme || '--:--'}
                </Text>
              </View>

              <Text style={styles.jobDescription}>
                🔧 {nalog.opis}
              </Text>

              <Text style={styles.jobDetail}>
                📞 {nalog.telefon || 'Telefon nije unet'}
              </Text>

              <Text style={styles.jobDetail}>
                Status: {status}
              </Text>

              <Text style={styles.jobPrice}>
                {nalog.cena
                  ? `${nalog.cena} RSD`
                  : 'Cena nije uneta'}
              </Text>

              <Pressable
                style={styles.editButton}
                onPress={() =>
                  router.push({
                    pathname: '/novi-nalog',
                    params: { id: nalog.id },
                  })
                }
              >
                <Text style={styles.editButtonText}>
                  ✏️ Izmeni nalog
                </Text>
              </Pressable>
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
  calendarCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: '#E8EDF5',
    marginBottom: 28,
  },
  monthHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  monthButton: {
    backgroundColor: '#EFF6FF',
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthButtonText: {
    color: '#2563EB',
    fontSize: 30,
    lineHeight: 35,
    fontWeight: '700',
  },
  monthTitle: {
    color: '#172554',
    fontSize: 19,
    fontWeight: '800',
  },
  todayButton: {
    alignSelf: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: 9,
    paddingHorizontal: 15,
    paddingVertical: 9,
    marginBottom: 20,
  },
  todayButtonText: {
    color: '#475569',
    fontSize: 12,
    fontWeight: '700',
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayCell: {
    width: '14.2857%',
    minHeight: 57,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 5,
  },
  weekdayText: {
    color: '#64748B',
    fontSize: 11,
    fontWeight: '700',
  },
  calendarDay: {
    borderRadius: 10,
  },
  selectedDay: {
    backgroundColor: '#2563EB',
  },
  currentDay: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  dayNumber: {
    color: '#172554',
    fontSize: 14,
    fontWeight: '700',
  },
  selectedDayText: {
    color: '#FFFFFF',
  },
  jobIndicator: {
    backgroundColor: '#DBEAFE',
    borderRadius: 10,
    paddingHorizontal: 7,
    paddingVertical: 2,
    marginTop: 4,
  },
  jobIndicatorText: {
    color: '#1D4ED8',
    fontSize: 10,
    fontWeight: '800',
  },
  selectedIndicator: {
    backgroundColor: '#FFFFFF',
  },
  selectedIndicatorText: {
    color: '#2563EB',
  },
  legend: {
    color: '#94A3B8',
    fontSize: 11,
    textAlign: 'center',
    marginTop: 18,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
    gap: 10,
  },
  sectionTitle: {
    color: '#172554',
    fontSize: 18,
    fontWeight: '800',
    flex: 1,
  },
  countText: {
    color: '#2563EB',
    fontSize: 18,
    fontWeight: '800',
  },
  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 22,
    borderWidth: 1,
    borderColor: '#E8EDF5',
  },
  emptyText: {
    color: '#64748B',
    fontSize: 13,
    textAlign: 'center',
  },
  loadingText: {
    marginTop: 12,
  },
  errorText: {
    color: '#DC2626',
    fontSize: 13,
    textAlign: 'center',
  },
  jobCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: '#E8EDF5',
    marginBottom: 12,
  },
  jobHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    gap: 10,
  },
  customerName: {
    color: '#172554',
    fontSize: 17,
    fontWeight: '800',
    flex: 1,
  },
  jobTime: {
    color: '#2563EB',
    fontSize: 14,
    fontWeight: '800',
  },
  jobDescription: {
    color: '#475569',
    fontSize: 14,
    marginBottom: 12,
  },
  jobDetail: {
    color: '#64748B',
    fontSize: 12,
    marginBottom: 8,
  },
  jobPrice: {
    color: '#2563EB',
    fontSize: 16,
    fontWeight: '800',
    marginTop: 6,
  },
  editButton: {
    backgroundColor: '#EFF6FF',
    borderRadius: 9,
    paddingHorizontal: 14,
    paddingVertical: 11,
    marginTop: 17,
    alignSelf: 'flex-start',
  },
  editButtonText: {
    color: '#2563EB',
    fontSize: 12,
    fontWeight: '700',
  },
  backButton: {
    padding: 15,
    alignItems: 'center',
    marginTop: 18,
  },
  backButtonText: {
    color: '#2563EB',
    fontSize: 14,
    fontWeight: '700',
  },
});
