import { router, useFocusEffect } from 'expo-router';

import { onAuthStateChanged, signOut } from 'firebase/auth';

import { useCallback, useState } from 'react';

import {
  ActivityIndicator,

  Alert,

  Platform,

  Pressable,

  ScrollView,

  StyleSheet,

  Text,

  View,
} from 'react-native';

import { auth } from '../services/firebase';

import { ucitajFirebaseNaloge } from '../services/firebaseNalozi';

import type { RadniNalog } from '../services/nalozi';

import { izracunajNaplatu } from '../services/nalozi';

import { proveriBackendKorisnika, testirajUploadFotografije } from '../services/backend';

if (Platform.OS === 'web' && __DEV__) {
  (globalThis as any).testUploadFotografije =
    testirajUploadFotografije;
}
// Pretvaranje cene i troskova u broj

function procitajIznos(tekst: string): number {

  const ocisceno = tekst

    .trim()

    .replace(/\s/g, '')

    .replace(/[^\d,.-]/g, '');

  if (!ocisceno) return 0;

  const poslednjiZarez = ocisceno.lastIndexOf(',');

  const poslednjaTacka = ocisceno.lastIndexOf('.');

  let broj = ocisceno;

  if (poslednjiZarez >= 0 && poslednjaTacka >= 0) {

    broj =

      poslednjiZarez > poslednjaTacka

        ? ocisceno.replace(/\./g, '').replace(',', '.')

        : ocisceno.replace(/,/g, '');

  } else if (poslednjiZarez >= 0) {

    broj = ocisceno.replace(',', '.');

  } else if (poslednjaTacka >= 0) {

    const delovi = ocisceno.split('.');

    if (

      delovi.length > 1 &&

      delovi.slice(1).every((deo) => /^\d{3}$/.test(deo))

    ) {

      broj = delovi.join('');

    }

  }

  const iznos = Number(broj);

  return Number.isFinite(iznos) && iznos >= 0 ? iznos : 0;

}

function formatirajNovac(iznos: number): string {

  return (

    iznos.toLocaleString('sr-RS', {

      minimumFractionDigits: 0,

      maximumFractionDigits: 2,

    }) + ' RSD'

  );

}

// Datum u formatu DD.MM.GGGG

function procitajDatum(tekst: string): Date | null {

  const delovi = tekst.trim().split('.');

  if (delovi.length < 3) return null;

  const dan = Number(delovi[0]);

  const mesec = Number(delovi[1]);

  const godina = Number(delovi[2]);

  if (

    !Number.isInteger(dan) ||

    !Number.isInteger(mesec) ||

    !Number.isInteger(godina)

  ) {

    return null;

  }

  const datum = new Date(godina, mesec - 1, dan);

  if (

    datum.getDate() !== dan ||

    datum.getMonth() !== mesec - 1 ||

    datum.getFullYear() !== godina

  ) {

    return null;

  }

  return datum;

}

// Datum i vreme termina, bez menjanja podataka u bazi.

function procitajTermin(nalog: RadniNalog): Date | null {

  const datum = procitajDatum(nalog.datum);

  if (!datum) return null;



  const poklapanje = (nalog.vreme || '').trim().match(/^(\d{1,2}):(\d{2})$/);

  if (!poklapanje) return null;



  const sati = Number(poklapanje[1]);

  const minuti = Number(poklapanje[2]);

  if (sati > 23 || minuti > 59) return null;



  datum.setHours(sati, minuti, 0, 0);

  return datum;

}



export default function HomeScreen() {

  const [nalozi, setNalozi] = useState<RadniNalog[]>([]);

  const [odjavljivanje, setOdjavljivanje] = useState(false);

  const [ucitavanje, setUcitavanje] = useState(true);

  const [greska, setGreska] = useState('');

  const [izabraniMesec, setIzabraniMesec] = useState(() => {

    const sada = new Date();

    return sada.getFullYear() * 12 + sada.getMonth();

  });

  const nazivMeseca = (indeks: number) => {

    const godina = Math.floor(indeks / 12);

    const mesec = indeks % 12;

    return new Date(godina, mesec, 1).toLocaleDateString('sr-RS', {

      month: 'long',

      year: 'numeric',

    });

  };

  // Ucitavanje podataka tek nakon Firebase provere prijave

  useFocusEffect(

    useCallback(() => {

      let aktivno = true;

      let brojUcitavanja = 0;

      setUcitavanje(true);

      setGreska('');

      const unsubscribe = onAuthStateChanged(auth, (korisnik) => {

        const trenutnoUcitavanje = ++brojUcitavanja;

        if (!aktivno) return;

        if (!korisnik) {

          setNalozi([]);

          setUcitavanje(false);

          return;

        }

        const ucitaj = async () => {

          setUcitavanje(true);

          setGreska('');

          try {

            const podaci = await ucitajFirebaseNaloge();

            if (aktivno && trenutnoUcitavanje === brojUcitavanja) {

              setNalozi(podaci);

            }

          } catch (error) {

            console.error(error);

            if (aktivno && trenutnoUcitavanje === brojUcitavanja) {

              setNalozi([]);

              setGreska(

                'Nije uspelo učitavanje podataka iz Firebase baze.'

              );

            }

          } finally {

            if (aktivno && trenutnoUcitavanje === brojUcitavanja) {

              setUcitavanje(false);

            }

          }

        };

        void ucitaj();

      });

      return () => {

        aktivno = false;

        brojUcitavanja++;

        unsubscribe();

      };

    }, [])

  );

  const testirajBackendNaTelefonu = async () => {
    try {
      await proveriBackendKorisnika();
      Alert.alert('✅ Backend povezan!', 'Firebase autentifikacija je uspešna.');
    } catch (error) {
      const poruka = error instanceof Error ? error.message : 'Nepoznata greška.';
      Alert.alert('❌ Backend greška', poruka);
    }
  };

  const odjaviSe = async () => {

    if (odjavljivanje) return;

    try {

      setOdjavljivanje(true);

      await signOut(auth);

      router.replace('/prijava');

    } catch {

      if (Platform.OS === 'web') {

        window.alert('Odjavljivanje nije uspelo. Pokušaj ponovo.');

      } else {

        Alert.alert(

          'Greška',

          'Odjavljivanje nije uspelo. Pokušaj ponovo.'

        );

      }

    } finally {

      setOdjavljivanje(false);

    }

  };

  const danas = new Date();

  const danasnjiDatum = [

    String(danas.getDate()).padStart(2, '0'),

    String(danas.getMonth() + 1).padStart(2, '0'),

    danas.getFullYear(),

  ].join('.');

  const danasnjiNalozi = nalozi.filter(

    (nalog) =>

      nalog.datum.trim().replace(/\.$/, '') === danasnjiDatum

  );

  const brojMusterija = new Set(

    nalozi

      .map(

        (nalog) =>

          nalog.telefon.trim() ||

          nalog.ime.trim().toLowerCase()

      )

      .filter(Boolean)

  ).size;

  const zavrseniNalozi = nalozi.filter(

    (nalog) => nalog.status === 'Završen'

  );

  const aktivniNalozi = nalozi.filter(

    (nalog) => nalog.status !== 'Završen'

  );

  // Statistika prema datumu zavrsenog naloga za izabrani mesec.

  const zavrseniIzabranogMeseca = zavrseniNalozi.filter((nalog) => {

    const datum = procitajDatum(nalog.datum);

    return (

      datum !== null &&

      datum.getFullYear() * 12 + datum.getMonth() === izabraniMesec

    );

  });

  const ukupnaVrednost = zavrseniIzabranogMeseca.reduce(

    (zbir, nalog) => zbir + procitajIznos(nalog.cena),

    0

  );

  const ukupniTroskovi = zavrseniIzabranogMeseca.reduce(

    (zbir, nalog) => zbir + procitajIznos(nalog.trosakMaterijala ?? '0'),

    0

  );

  const ukupnaZarada = ukupnaVrednost - ukupniTroskovi;

  const ukupnoNaplaceno = zavrseniIzabranogMeseca.reduce(

    (zbir, nalog) => zbir + izracunajNaplatu(nalog).uplaceno,

    0

  );

  const ukupnaDugovanja = zavrseniIzabranogMeseca.reduce(

    (zbir, nalog) => zbir + izracunajNaplatu(nalog).preostalo,

    0

  );

  const delimicnoPlaceni = zavrseniIzabranogMeseca.filter(

    (nalog) => izracunajNaplatu(nalog).statusNaplate === 'Delimično plaćeno'

  ).length;

  // Podsetnici se računaju iz postojećih naloga, bez dodatnog upisa u Firebase.

  const sadaZaPodsetnike = new Date();

  const pocetakSutra = new Date(sadaZaPodsetnike.getFullYear(), sadaZaPodsetnike.getMonth(), sadaZaPodsetnike.getDate() + 1);

  const pocetakPrekosutra = new Date(sadaZaPodsetnike.getFullYear(), sadaZaPodsetnike.getMonth(), sadaZaPodsetnike.getDate() + 2);

  const zaDvaSata = new Date(sadaZaPodsetnike.getTime() + 2 * 60 * 60 * 1000);



  const nezavrseniTermini = nalozi

    .filter((nalog) => nalog.status !== 'Završen')

    .map((nalog) => ({ nalog, termin: procitajTermin(nalog) }))

    .filter((stavka): stavka is { nalog: RadniNalog; termin: Date } => stavka.termin !== null);



  const zakasneliTermini = nezavrseniTermini

    .filter(({ termin }) => termin < sadaZaPodsetnike)

    .sort((a, b) => b.termin.getTime() - a.termin.getTime());



  const uskoroTermini = nezavrseniTermini

    .filter(({ termin }) => termin >= sadaZaPodsetnike && termin <= zaDvaSata)

    .sort((a, b) => a.termin.getTime() - b.termin.getTime());



  const sutrasnjiTermini = nezavrseniTermini

    .filter(({ termin }) => termin >= pocetakSutra && termin < pocetakPrekosutra)

    .sort((a, b) => a.termin.getTime() - b.termin.getTime());



  const imaPodsetnika = zakasneliTermini.length + uskoroTermini.length + sutrasnjiTermini.length > 0;



  const jobs = [...danasnjiNalozi].sort((a, b) =>

    a.vreme.localeCompare(b.vreme)

  );

  return (

    <ScrollView

      style={styles.screen}

      contentContainerStyle={styles.content}

    >

      <View style={styles.header}>

        <View>

          <Text style={styles.brand}>

            Majstor

            <Text style={styles.brandAccent}>Mate</Text>

          </Text>

          <Text style={styles.subtitle}>

            Tvoj posao. Pod tvojom kontrolom.

          </Text>

        </View>

        <View style={styles.headerActions}>

          <Pressable

            style={styles.logoutButton}

            onPress={odjaviSe}

            disabled={odjavljivanje}

          >

            <Text style={styles.logoutButtonText}>

              {odjavljivanje ? 'Odjava...' : '🚪 Odjavi se'}

            </Text>

          </Pressable>

          <View style={styles.avatar}>

            <Text style={styles.avatarText}>M</Text>

          </View>

        </View>

      </View>

      {__DEV__ && Platform.OS !== 'web' && (
        <Pressable
          onPress={testirajBackendNaTelefonu}
          style={{
            backgroundColor: '#16A34A',
            padding: 15,
            borderRadius: 12,
            marginBottom: 20,
            alignItems: 'center',
          }}
        >
          <Text style={{ color: '#FFFFFF', fontWeight: '700' }}>
            🔐 Test backend konekcije
          </Text>
        </Pressable>
      )}

      <View style={styles.greeting}>

        <Text style={styles.muted}>TVOJ RADNI DAN</Text>

        <Text style={styles.title}>

          Zdravo, majstore! 👋

        </Text>

        <Text style={styles.description}>

          Evo šta te danas čeka.

        </Text>

      </View>

      {ucitavanje ? (

        <View style={styles.loadingCard}>

          <ActivityIndicator

            size="large"

            color="#2563EB"

          />

          <Text style={styles.loadingText}>

            Učitavanje podataka iz Firebase baze...

          </Text>

        </View>

      ) : greska ? (

        <View style={styles.loadingCard}>

          <Text style={styles.errorText}>{greska}</Text>

        </View>

      ) : (

        <>

          {/* Postojece statistike */}

          <View style={styles.stats}>

            <View style={styles.statCard}>

              <Text style={styles.statIcon}>📅</Text>

              <Text style={styles.statNumber}>

                {danasnjiNalozi.length}

              </Text>

              <Text style={styles.statLabel}>

                Današnji poslovi

              </Text>

            </View>

            <View style={styles.statCard}>

              <Text style={styles.statIcon}>👥</Text>

              <Text style={styles.statNumber}>

                {brojMusterija}

              </Text>

              <Text style={styles.statLabel}>

                Mušterije

              </Text>

            </View>

            <View style={styles.statCard}>

              <Text style={styles.statIcon}>🔧</Text>

              <Text style={styles.statNumber}>

                {aktivniNalozi.length}

              </Text>

              <Text style={styles.statLabel}>

                Aktivni poslovi

              </Text>

            </View>

          </View>

          {/* Ukupna finansijska statistika */}

          <Text style={styles.overallHeading}>

            📈 Statistika za izabrani mesec

          </Text>

          <View style={styles.monthPicker}>

            <Pressable

              style={styles.monthPickerButton}

              onPress={() => setIzabraniMesec((vrednost) => vrednost - 1)}

            >

              <Text style={styles.monthPickerArrow}>‹</Text>

            </Pressable>

            <Text style={styles.monthPickerText}>

              {nazivMeseca(izabraniMesec)}

            </Text>

            <Pressable

              style={styles.monthPickerButton}

              onPress={() => setIzabraniMesec((vrednost) => vrednost + 1)}

            >

              <Text style={styles.monthPickerArrow}>›</Text>

            </Pressable>

          </View>

          {/* Postojeci finansijski pregled */}

          <View style={styles.financeStats}>

            <View style={styles.financeCard}>

              <Text style={styles.financeIcon}>💵</Text>

              <Text style={styles.financeLabel}>

                Ukupna vrednost poslova

              </Text>

              <Text style={styles.financeNumber}>

                {formatirajNovac(ukupnaVrednost)}

              </Text>

              <Text style={styles.financeNote}>

                Od završenih naloga u izabranom mesecu

              </Text>

            </View>

            <View style={styles.completedCard}>

              <Text style={styles.financeIcon}>✅</Text>

              <Text style={styles.financeLabel}>

                Završeni poslovi

              </Text>

              <Text style={styles.completedNumber}>

                {zavrseniIzabranogMeseca.length}

              </Text>

              <Text style={styles.financeNote}>

                Završeni nalozi u izabranom mesecu

              </Text>

            </View>

          </View>

          {/* NOVO: Troskovi i zarada */}

          <View style={styles.financeStats}>

            <View style={styles.expenseCard}>

              <Text style={styles.financeIcon}>🧾</Text>

              <Text style={styles.financeLabel}>

                Troškovi materijala

              </Text>

              <Text style={styles.expenseNumber}>

                {formatirajNovac(ukupniTroskovi)}

              </Text>

              <Text style={styles.financeNote}>

                Za završene poslove izabranog meseca

              </Text>

            </View>

            <View style={styles.profitCard}>

              <Text style={styles.financeIcon}>💰</Text>

              <Text style={styles.financeLabel}>

                Zarada nakon materijala

              </Text>

              <Text

                style={[

                  styles.profitNumber,

                  ukupnaZarada < 0 && styles.negativeNumber,

                ]}

              >

                {formatirajNovac(ukupnaZarada)}

              </Text>

              <Text style={styles.financeNote}>

                Bez ostalih troškova i poreza

              </Text>

            </View>

          </View>

                      {/* Evidencija naplate zavrsenih poslova */}

            <View style={styles.financeStats}>

              <View style={styles.collectionCard}>

                <Text style={styles.financeIcon}>💳</Text>

                <Text style={styles.financeLabel}>Ukupno naplaćeno</Text>

                <Text style={styles.collectionNumber}>

                  {formatirajNovac(ukupnoNaplaceno)}

                </Text>

                <Text style={styles.financeNote}>Uplate za naloge izabranog meseca</Text>

              </View>

              <View style={styles.debtCard}>

                <Text style={styles.financeIcon}>🔴</Text>

                <Text style={styles.financeLabel}>Ukupna dugovanja</Text>

                <Text style={styles.debtNumber}>

                  {formatirajNovac(ukupnaDugovanja)}

                </Text>

                <Text style={styles.financeNote}>Dug za naloge izabranog meseca</Text>

              </View>

            </View>

            <View style={styles.partialCard}>

              <Text style={styles.partialNumber}>{delimicnoPlaceni}</Text>

              <View style={styles.partialContent}>

                <Text style={styles.partialTitle}>Delimično plaćeni poslovi</Text>

                <Text style={styles.financeNote}>

                  Završeni poslovi za koje je deo iznosa uplaćen

                </Text>

              </View>

            </View>

        </>

      )}

      <Pressable

        style={styles.primaryButton}

        onPress={() => router.push('/novi-nalog')}

      >

        <Text style={styles.plus}>＋</Text>

        <Text style={styles.primaryButtonText}>

          Novi radni nalog

        </Text>

      </Pressable>

      <Pressable

        style={styles.customersButton}

        onPress={() => router.push('/musterije')}

      >

        <Text style={styles.customersButtonText}>

          👥 Pogledaj mušterije

        </Text>

      </Pressable>

      <Pressable

        style={styles.calendarButton}

        onPress={() => router.push('/kalendar')}

      >

        <Text style={styles.calendarButtonText}>

          📅 Pogledaj kalendar

        </Text>

      </Pressable>

      <Pressable

        style={styles.financesButton}

        onPress={() => router.push('/finansije')}

      >

        <Text style={styles.financesButtonText}>

          💰 Finansijski izveštaji

        </Text>

      </Pressable>

      <Pressable

        style={styles.profileButton}

        onPress={() => router.push('/profil')}

      >

        <Text style={styles.profileButtonText}>

          👷 Moj profil

        </Text>

      </Pressable>

        {/* Podsetnici za nezavršene poslove */}

        <View style={styles.reminderSection}>

          <View style={styles.sectionHeader}>

            <Text style={styles.sectionTitle}>🔔 Podsetnici za poslove</Text>

            <Pressable onPress={() => router.push('/radni-nalozi')}>

              <Text style={styles.sectionLink}>Svi nalozi</Text>

            </Pressable>

          </View>

          {ucitavanje ? (

            <View style={styles.reminderEmpty}><Text style={styles.jobDescription}>Učitavanje podsetnika...</Text></View>

          ) : greska ? (

            <View style={styles.reminderEmpty}><Text style={styles.errorText}>{greska}</Text></View>

          ) : !imaPodsetnika ? (

            <View style={styles.reminderEmpty}>

              <Text style={styles.reminderEmptyText}>✅ Nema hitnih, zakasnelih ni sutrašnjih nezavršenih poslova.</Text>

            </View>

          ) : (

            <>

              {([

                { naslov: '⚠️ Zakasneli termini', stavke: zakasneliTermini, boja: '#FEF2F2', ivica: '#FECACA' },

                { naslov: '⏰ Počinju u naredna 2 sata', stavke: uskoroTermini, boja: '#FFF7ED', ivica: '#FED7AA' },

                { naslov: '📅 Sutrašnji poslovi', stavke: sutrasnjiTermini, boja: '#EFF6FF', ivica: '#BFDBFE' },

              ] as const).map((grupa) =>

                grupa.stavke.length > 0 ? (

                  <View key={grupa.naslov} style={[styles.reminderGroup, { backgroundColor: grupa.boja, borderColor: grupa.ivica }]}>

                    <Text style={styles.reminderGroupTitle}>{grupa.naslov} ({grupa.stavke.length})</Text>

                    {grupa.stavke.map(({ nalog, termin }) => (

                      <View key={nalog.id} style={styles.reminderItem}>

                        <Text style={styles.reminderName}>{nalog.ime}</Text>

                        <Text style={styles.reminderDetails}>

                          {termin.toLocaleDateString('sr-RS')} u {nalog.vreme} · {nalog.status || 'Zakazan'}

                        </Text>

                        <Text style={styles.reminderDescription}>{nalog.opis}</Text>

                      </View>

                    ))}

                  </View>

                ) : null

              )}

            </>

          )}

        </View>



      <View style={styles.sectionHeader}>

        <Text style={styles.sectionTitle}>

          Današnji raspored

        </Text>

        <Pressable

          onPress={() => router.push('/radni-nalozi')}

        >

          <Text style={styles.sectionLink}>

            Pogledaj sve

          </Text>

        </Pressable>

      </View>

      {ucitavanje ? (

        <View style={styles.jobCard}>

          <Text style={styles.jobDescription}>

            Učitavanje današnjeg rasporeda...

          </Text>

        </View>

      ) : greska ? (

        <View style={styles.jobCard}>

          <Text style={styles.errorText}>{greska}</Text>

        </View>

      ) : jobs.length === 0 ? (

        <View style={styles.jobCard}>

          <Text style={styles.jobDescription}>

            Za danas nema zakazanih poslova.

          </Text>

        </View>

      ) : (

        jobs.map((job) => {

          const status = job.status || 'Zakazan';

          const statusBoja =

            status === 'Završen'

              ? '#DCFCE7'

              : status === 'U toku'

              ? '#FEF3C7'

              : '#DBEAFE';

          const tekstBoja =

            status === 'Završen'

              ? '#15803D'

              : status === 'U toku'

              ? '#B45309'

              : '#1D4ED8';

          return (

            <View key={job.id} style={styles.jobCard}>

              <View style={styles.timeColumn}>

                <Text style={styles.time}>

                  {job.vreme || '--:--'}

                </Text>

                <View style={styles.timelineDot} />

              </View>

              <View style={styles.jobDetails}>

                <Text style={styles.jobName}>

                  {job.ime}

                </Text>

                <Text style={styles.jobDescription}>

                  {job.opis}

                </Text>

                <View

                  style={[

                    styles.status,

                    { backgroundColor: statusBoja },

                  ]}

                >

                  <Text

                    style={[

                      styles.statusText,

                      { color: tekstBoja },

                    ]}

                  >

                    {status}

                  </Text>

                </View>

              </View>

              <Text style={styles.arrow}>›</Text>

            </View>

          );

        })

      )}

      <View style={styles.tipCard}>

        <Text style={styles.tipIcon}>✨</Text>

        <View style={styles.tipContent}>

          <Text style={styles.tipTitle}>

            Probaj pametni unos

          </Text>

          <Text style={styles.tipText}>

            Izdiktiraj detalje posla i prepusti aplikaciji

            da ih organizuje.

          </Text>

          <Text style={styles.comingSoon}>

            USKORO DOSTUPNO

          </Text>

        </View>

      </View>

      <Text style={styles.footer}>

        MAJSTORMATE · TVOJ DIGITALNI POMOĆNIK

      </Text>

    </ScrollView>

  );

}

const styles = StyleSheet.create({

  reminderSection: {

    marginBottom: 28,

  },

  reminderEmpty: {

    backgroundColor: '#FFFFFF',

    borderWidth: 1,

    borderColor: '#E8EDF5',

    borderRadius: 16,

    padding: 18,

  },

  reminderEmptyText: {

    color: '#475569',

    fontSize: 13,

    lineHeight: 20,

  },

  reminderGroup: {

    borderWidth: 1,

    borderRadius: 16,

    padding: 15,

    marginBottom: 12,

  },

  reminderGroupTitle: {

    color: '#172554',

    fontWeight: '800',

    fontSize: 14,

    marginBottom: 10,

  },

  reminderItem: {

    backgroundColor: '#FFFFFF',

    borderRadius: 11,

    padding: 12,

    marginTop: 7,

  },

  reminderName: {

    color: '#172554',

    fontWeight: '800',

    fontSize: 13,

  },

  reminderDetails: {

    color: '#2563EB',

    fontSize: 12,

    fontWeight: '700',

    marginTop: 5,

  },

  reminderDescription: {

    color: '#64748B',

    fontSize: 12,

    marginTop: 5,

  },

  screen: {

    flex: 1,

    backgroundColor: '#F5F7FB',

  },

  content: {

    padding: 24,

    paddingTop: 32,

    paddingBottom: 48,

    maxWidth: 850,

    width: '100%',

    alignSelf: 'center',

  },

  header: {

    flexDirection: 'row',

    justifyContent: 'space-between',

    alignItems: 'center',

    marginBottom: 38,

    gap: 12,

  },

  headerActions: {

    flexDirection: 'row',

    alignItems: 'center',

    gap: 10,

  },

  logoutButton: {

    backgroundColor: '#FEF2F2',

    borderWidth: 1,

    borderColor: '#FECACA',

    paddingHorizontal: 12,

    paddingVertical: 11,

    borderRadius: 12,

  },

  logoutButtonText: {

    color: '#DC2626',

    fontSize: 12,

    fontWeight: '700',

  },

  brand: {

    fontSize: 27,

    fontWeight: '800',

    color: '#172554',

    letterSpacing: -1,

  },

  brandAccent: {

    color: '#2563EB',

  },

  subtitle: {

    fontSize: 12,

    color: '#64748B',

    marginTop: 4,

  },

  avatar: {

    width: 44,

    height: 44,

    borderRadius: 15,

    backgroundColor: '#DBEAFE',

    alignItems: 'center',

    justifyContent: 'center',

  },

  avatarText: {

    color: '#1D4ED8',

    fontSize: 19,

    fontWeight: '800',

  },

  greeting: {

    marginBottom: 24,

  },

  muted: {

    color: '#64748B',

    fontSize: 11,

    fontWeight: '700',

    letterSpacing: 1.3,

    marginBottom: 10,

  },

  title: {

    fontSize: 30,

    fontWeight: '800',

    color: '#172554',

    letterSpacing: -0.8,

  },

  description: {

    color: '#64748B',

    fontSize: 15,

    marginTop: 8,

  },

  monthPicker: {

    flexDirection: 'row',

    alignItems: 'center',

    justifyContent: 'space-between',

    backgroundColor: '#FFFFFF',

    borderWidth: 1,

    borderColor: '#BFDBFE',

    borderRadius: 14,

    padding: 8,

    marginBottom: 20,

  },

  monthPickerButton: {

    backgroundColor: '#EFF6FF',

    borderRadius: 10,

    width: 45,

    height: 42,

    alignItems: 'center',

    justifyContent: 'center',

  },

  monthPickerArrow: {

    fontSize: 30,

    color: '#2563EB',

    fontWeight: '700',

    lineHeight: 35,

  },

  monthPickerText: {

    color: '#172554',

    fontSize: 17,

    fontWeight: '800',

    textTransform: 'capitalize',

  },

  overallHeading: {

    color: '#172554',

    fontSize: 19,

    fontWeight: '800',

    marginBottom: 15,

  },

  stats: {

    flexDirection: 'row',

    gap: 12,

    marginBottom: 22,

  },

  statCard: {

    flex: 1,

    backgroundColor: '#FFFFFF',

    borderRadius: 18,

    padding: 14,

    borderWidth: 1,

    borderColor: '#E8EDF5',

  },

  statIcon: {

    fontSize: 20,

    marginBottom: 13,

  },

  statNumber: {

    color: '#172554',

    fontSize: 25,

    fontWeight: '800',

  },

  statLabel: {

    color: '#64748B',

    fontSize: 11,

    marginTop: 5,

  },

  financeStats: {

    flexDirection: 'row',

    gap: 12,

    marginBottom: 22,

  },

  financeCard: {

    flex: 1.5,

    backgroundColor: '#EFF6FF',

    borderRadius: 18,

    padding: 18,

    borderWidth: 1,

    borderColor: '#BFDBFE',

    minWidth: 0,

  },

  completedCard: {

    flex: 1,

    backgroundColor: '#F0FDF4',

    borderRadius: 18,

    padding: 18,

    borderWidth: 1,

    borderColor: '#BBF7D0',

    minWidth: 0,

  },

  financeIcon: {

    fontSize: 23,

    marginBottom: 10,

  },

  financeLabel: {

    color: '#475569',

    fontSize: 12,

    fontWeight: '700',

    marginBottom: 8,

  },

  financeNumber: {

    color: '#1D4ED8',

    fontSize: 23,

    fontWeight: '800',

    flexShrink: 1,

  },

  completedNumber: {

    color: '#15803D',

    fontSize: 25,

    fontWeight: '800',

  },

  financeNote: {

    color: '#64748B',

    fontSize: 10,

    marginTop: 8,

  },

  // NOVO: Kartice troskova i zarade

  expenseCard: {

    flex: 1,

    minWidth: 0,

    backgroundColor: '#FFF7ED',

    borderRadius: 18,

    padding: 18,

    borderWidth: 1,

    borderColor: '#FED7AA',

  },

  profitCard: {

    flex: 1,

    minWidth: 0,

    backgroundColor: '#F0FDF4',

    borderRadius: 18,

    padding: 18,

    borderWidth: 1,

    borderColor: '#BBF7D0',

  },

  expenseNumber: {

    color: '#C2410C',

    fontSize: 21,

    fontWeight: '800',

    flexShrink: 1,

  },

  profitNumber: {

    color: '#15803D',

    fontSize: 21,

    fontWeight: '800',

    flexShrink: 1,

  },

  negativeNumber: {

    color: '#DC2626',

  },

    collectionCard: {

    flex: 1,

    minWidth: 0,

    backgroundColor: '#F0FDF4',

    borderRadius: 18,

    padding: 18,

    borderWidth: 1,

    borderColor: '#BBF7D0',

  },

  debtCard: {

    flex: 1,

    minWidth: 0,

    backgroundColor: '#FEF2F2',

    borderRadius: 18,

    padding: 18,

    borderWidth: 1,

    borderColor: '#FECACA',

  },

  collectionNumber: {

    color: '#15803D',

    fontSize: 21,

    fontWeight: '800',

    flexShrink: 1,

  },

  debtNumber: {

    color: '#DC2626',

    fontSize: 21,

    fontWeight: '800',

    flexShrink: 1,

  },

  partialCard: {

    flexDirection: 'row',

    alignItems: 'center',

    gap: 16,

    backgroundColor: '#FFFBEB',

    borderRadius: 18,

    borderWidth: 1,

    borderColor: '#FDE68A',

    padding: 18,

    marginBottom: 22,

  },

  partialNumber: {

    color: '#B45309',

    fontSize: 29,

    fontWeight: '800',

  },

  partialContent: {

    flex: 1,

  },

  partialTitle: {

    color: '#92400E',

    fontSize: 13,

    fontWeight: '800',

  },

  monthlyCollected: {

    color: '#15803D',

    fontSize: 14,

    fontWeight: '800',

  },

  monthlyDebt: {

    color: '#DC2626',

    fontSize: 14,

    fontWeight: '800',

  },

  // NOVO: Mesecni finansijski pregled

  monthlyCard: {

    backgroundColor: '#FFFFFF',

    borderRadius: 18,

    padding: 20,

    borderWidth: 1,

    borderColor: '#E8EDF5',

    marginBottom: 24,

  },

  monthlyTitle: {

    color: '#172554',

    fontSize: 18,

    fontWeight: '800',

    marginBottom: 6,

  },

  monthlySubtitle: {

    color: '#64748B',

    fontSize: 12,

    marginBottom: 20,

  },

  monthlyRow: {

    flexDirection: 'row',

    justifyContent: 'space-between',

    alignItems: 'center',

    flexWrap: 'wrap',

    gap: 8,

    marginBottom: 13,

  },

  monthlyLabel: {

    color: '#64748B',

    fontSize: 13,

  },

  monthlyValue: {

    color: '#172554',

    fontSize: 14,

    fontWeight: '700',

  },

  monthlyExpense: {

    color: '#C2410C',

    fontSize: 14,

    fontWeight: '700',

  },

  monthlyDivider: {

    height: 1,

    backgroundColor: '#E2E8F0',

    marginBottom: 15,

  },

  monthlyProfitLabel: {

    color: '#166534',

    fontSize: 13,

    fontWeight: '800',

  },

  monthlyProfit: {

    color: '#15803D',

    fontSize: 17,

    fontWeight: '800',

  },

  monthlyNote: {

    color: '#94A3B8',

    fontSize: 11,

    marginTop: 8,

  },

  primaryButton: {

    backgroundColor: '#2563EB',

    borderRadius: 15,

    paddingVertical: 17,

    paddingHorizontal: 18,

    flexDirection: 'row',

    alignItems: 'center',

    justifyContent: 'center',

    marginBottom: 34,

    gap: 9,

  },

  plus: {

    color: '#FFFFFF',

    fontSize: 22,

    lineHeight: 23,

  },

  primaryButtonText: {

    color: '#FFFFFF',

    fontWeight: '700',

    fontSize: 15,

  },

  customersButton: {

    backgroundColor: '#FFFFFF',

    borderRadius: 15,

    paddingVertical: 16,

    paddingHorizontal: 18,

    alignItems: 'center',

    justifyContent: 'center',

    borderWidth: 1,

    borderColor: '#BFDBFE',

    marginTop: -20,

    marginBottom: 34,

  },

  customersButtonText: {

    color: '#2563EB',

    fontSize: 14,

    fontWeight: '700',

  },

  calendarButton: {

    backgroundColor: '#FFFFFF',

    borderRadius: 15,

    paddingVertical: 16,

    paddingHorizontal: 18,

    alignItems: 'center',

    justifyContent: 'center',

    borderWidth: 1,

    borderColor: '#BFDBFE',

    marginTop: -20,

    marginBottom: 34,

  },

  calendarButtonText: {

    color: '#2563EB',

    fontSize: 14,

    fontWeight: '700',

  },

  financesButton: {

    backgroundColor: '#FFFFFF',

    borderRadius: 15,

    paddingVertical: 16,

    paddingHorizontal: 18,

    alignItems: 'center',

    justifyContent: 'center',

    borderWidth: 1,

    borderColor: '#BFDBFE',

    marginTop: -20,

    marginBottom: 34,

  },

  financesButtonText: {

    color: '#2563EB',

    fontSize: 14,

    fontWeight: '700',

  },

  profileButton: {

    backgroundColor: '#FFFFFF',

    borderRadius: 15,

    paddingVertical: 16,

    paddingHorizontal: 18,

    alignItems: 'center',

    justifyContent: 'center',

    borderWidth: 1,

    borderColor: '#BFDBFE',

    marginTop: -20,

    marginBottom: 34,

  },

  profileButtonText: {

    color: '#2563EB',

    fontSize: 14,

    fontWeight: '700',

  },

  sectionHeader: {

    flexDirection: 'row',

    alignItems: 'center',

    justifyContent: 'space-between',

    marginBottom: 15,

  },

  sectionTitle: {

    color: '#172554',

    fontSize: 19,

    fontWeight: '800',

  },

  sectionLink: {

    color: '#2563EB',

    fontSize: 12,

    fontWeight: '700',

  },

  jobCard: {

    backgroundColor: '#FFFFFF',

    borderRadius: 17,

    borderWidth: 1,

    borderColor: '#E8EDF5',

    padding: 17,

    flexDirection: 'row',

    alignItems: 'flex-start',

    marginBottom: 12,

    gap: 14,

  },

  timeColumn: {

    alignItems: 'center',

    width: 49,

  },

  time: {

    color: '#2563EB',

    fontWeight: '800',

    fontSize: 13,

    marginBottom: 13,

  },

  timelineDot: {

    width: 9,

    height: 9,

    borderRadius: 5,

    backgroundColor: '#93C5FD',

  },

  jobDetails: {

    flex: 1,

  },

  jobName: {

    color: '#172554',

    fontSize: 14,

    fontWeight: '700',

  },

  jobDescription: {

    color: '#64748B',

    fontSize: 12,

    marginTop: 5,

    marginBottom: 11,

  },

  status: {

    alignSelf: 'flex-start',

    borderRadius: 7,

    paddingHorizontal: 9,

    paddingVertical: 5,

  },

  statusText: {

    fontSize: 10,

    fontWeight: '700',

  },

  arrow: {

    color: '#94A3B8',

    fontSize: 27,

  },

  tipCard: {

    backgroundColor: '#EEF2FF',

    borderRadius: 18,

    padding: 19,

    flexDirection: 'row',

    gap: 14,

    marginTop: 15,

  },

  tipIcon: {

    fontSize: 25,

  },

  tipContent: {

    flex: 1,

  },

  tipTitle: {

    color: '#312E81',

    fontSize: 15,

    fontWeight: '800',

    marginBottom: 7,

  },

  tipText: {

    color: '#4338CA',

    fontSize: 12,

    lineHeight: 19,

  },

  comingSoon: {

    color: '#6366F1',

    fontSize: 10,

    fontWeight: '800',

    letterSpacing: 1,

    marginTop: 12,

  },

  footer: {

    color: '#94A3B8',

    fontSize: 9,

    fontWeight: '700',

    letterSpacing: 1,

    textAlign: 'center',

    marginTop: 35,

  },

  loadingCard: {

    backgroundColor: '#FFFFFF',

    borderRadius: 18,

    padding: 24,

    alignItems: 'center',

    marginBottom: 22,

    borderWidth: 1,

    borderColor: '#E8EDF5',

  },

  loadingText: {

    color: '#64748B',

    fontSize: 13,

    marginTop: 12,

  },

  errorText: {

    color: '#DC2626',

    fontSize: 13,

    textAlign: 'center',

  },

});
