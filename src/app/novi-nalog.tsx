import { router, useLocalSearchParams } from 'expo-router';
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
import {
  izmeniFirebaseNalog,
  sacuvajFirebaseNalog,
  ucitajFirebaseNaloge,
} from '../services/firebaseNalozi';
import {
  izracunajNaplatu,
  procitajNovcaniIznos,
} from '../services/nalozi';
export default function NoviNalog() {
  const { id, kopijaId } = useLocalSearchParams<{ id?: string; kopijaId?: string }>();
  const rezimDupliranja = typeof kopijaId === 'string' && kopijaId.length > 0 && !id;
  const rezimIzmene = typeof id === 'string' && id.length > 0;
  const [ime, setIme] = useState('');
  const [telefon, setTelefon] = useState('');
  const [adresa, setAdresa] = useState('');
  const [opis, setOpis] = useState('');
  const [datum, setDatum] = useState('');
  const [vreme, setVreme] = useState('');
  const [cena, setCena] = useState('');
  // Trosak materijala
  const [trosakMaterijala, setTrosakMaterijala] = useState('');
  // NOVO: Evidentirana uplata
  const [uplaceno, setUplaceno] = useState('');
  const [ucitavanje, setUcitavanje] = useState(rezimIzmene || rezimDupliranja);
  const [cuvanje, setCuvanje] = useState(false);
  const [greska, setGreska] = useState('');
  const prikaziPoruku = (naslov: string, poruka: string) => {
    if (Platform.OS === 'web') {
      window  .alert(poruka);
    } else {
      Alert.alert(naslov, poruka);
    }
  };
  // Ucitavanje postojeceg naloga iz Firebase baze
  useEffect(() => {
    if (!rezimIzmene && !rezimDupliranja) {
      setUcitavanje(false);
      return;
    }
    let aktivno = true;
    const ucitajNalog = async () => {
      setUcitavanje(true);
      setGreska('');
      try {
        const nalozi = await ucitajFirebaseNaloge();
        const nalog = nalozi.find(
          (postojeciNalog) => postojeciNalog.id === (rezimIzmene ? id : kopijaId)
        );
        if (!nalog) {
          throw new Error('Radni nalog nije pronađen.');
        }
        if (!aktivno) return;
        setIme(nalog.ime);
          setTelefon(nalog.telefon);
        setAdresa(nalog.adresa ?? '');
        // Pri dupliranju prenosimo samo kontakt podatke.
        // Novi posao nema stari opis, datum, cenu, troskove ili uplate.
        setOpis(rezimDupliranja ? '' : nalog.opis);
        setDatum(rezimDupliranja ? '' : nalog.datum);
        setVreme(rezimDupliranja ? '' : nalog.vreme);
        setCena(rezimDupliranja ? '' : nalog.cena);
        setTrosakMaterijala(rezimDupliranja ? '' : (nalog.trosakMaterijala ?? ''));
        setUplaceno(rezimDupliranja ? '' : (nalog.uplaceno ?? '0'));
      } catch (error) {
        console.error(error);
        if (aktivno) {
          setGreska(
            error instanceof Error
              ? error.message
              : 'Nije uspelo učitavanje radnog naloga.'
          );
        }
      } finally {
        if (aktivno) {
          setUcitavanje(false);
        }
      }
    };
    void ucitajNalog();
    return () => {
      aktivno = false;
    };
  }, [id, kopijaId, rezimIzmene, rezimDupliranja]);
  // Provera da li je novcani iznos pravilno unet
  const ispravanIznos = (vrednost: string): boolean => {
    if (vrednost.trim() === '') return true;
    const ocisceno = vrednost.trim().replace(/\s/g, '');
    if (!/^\d+(?:[.,]\d{1,2})?$/.test(ocisceno)) {
      return false;
    }
    const broj = procitajNovcaniIznos(vrednost);
    return Number.isFinite(broj) && broj >= 0;
  };
  const cenaBroj = procitajNovcaniIznos(cena);
  const trosakBroj = procitajNovcaniIznos(trosakMaterijala);
  const uplacenoBroj = procitajNovcaniIznos(uplaceno);
  const ispravnaCena = ispravanIznos(cena);
  const ispravanTrosak = ispravanIznos(trosakMaterijala);
  const ispravnaUplata = ispravanIznos(uplaceno);
  // Uplata ne sme biti veca od cene posla
  const uplataNijeVecaOdCene =
    uplacenoBroj <= cenaBroj;
  const prikaziObracun =
    cena.trim() !== '' &&
    ispravnaCena &&
    ispravanTrosak;
  const zaradaNakonMaterijala =
    cenaBroj - trosakBroj;
  // NOVO: Automatski obracun naplate
  const obracunNaplate = izracunajNaplatu({
    id: rezimIzmene ? id : '',
    ime,
    telefon,
    opis,
    datum,
    vreme,
    cena,
    trosakMaterijala,
    uplaceno,
  });
  const prikaziNaplatu =
    cena.trim() !== '' &&
    ispravnaCena &&
    ispravnaUplata &&
    uplataNijeVecaOdCene;
  const formatirajIznos = (iznos: number) =>
    iznos.toLocaleString('sr-RS', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }) + ' RSD';
  const statusBoja =
    obracunNaplate.statusNaplate === 'Plaćeno'
      ? '#15803D'
      : obracunNaplate.statusNaplate === 'Delimično plaćeno'
      ? '#B45309'
      : '#DC2626';
  const statusPozadina =
    obracunNaplate.statusNaplate === 'Plaćeno'
      ? '#DCFCE7'
      : obracunNaplate.statusNaplate === 'Delimično plaćeno'
      ? '#FEF3C7'
      : '#FEE2E2';
  // Cuvanje novog ili izmena postojeceg naloga
  const sacuvajNalog = async () => {
    if (cuvanje || ucitavanje || greska) return;
    if (!ime.trim() || !opis.trim()) {
      prikaziPoruku(
        'Nedostaju podaci',
        'Unesi ime mušterije i opis posla.'
      );
      return;
    }
    if (!ispravnaCena || !ispravanTrosak) {
      prikaziPoruku(
        'Neispravan iznos',
        'Cena i trošak materijala moraju biti ispravni brojevi koji nisu negativni.'
      );
      return;
    }
    // NOVO: Provera uplate
    if (!ispravnaUplata) {
      prikaziPoruku(
        'Neispravna uplata',
        'Unesi ispravan iznos uplate. Na primer: 4000 ili 4000,50.'
      );
      return;
    }
    if (!uplataNijeVecaOdCene) {
      prikaziPoruku(
        'Uplata je prevelika',
        'Evidentirana uplata ne može biti veća od dogovorene cene posla.'
      );
      return;
    }
    try {
      setCuvanje(true);
      const podaci = {
        ime: ime.trim(),
        telefon: telefon.trim(),
        adresa: adresa.trim(),
        opis: opis.trim(),
        datum: datum.trim(),
        vreme: vreme.trim(),
        cena: cena.trim(),
        trosakMaterijala: trosakMaterijala.trim(),
        // NOVO: Cuvanje evidentirane uplate
        uplaceno: uplaceno.trim() || '0',
      };
      if (rezimIzmene) {
        await izmeniFirebaseNalog(id, podaci);
        prikaziPoruku(
          'Uspešno',
          'Radni nalog je uspešno izmenjen!'
        );
        router.replace('/radni-nalozi');
      } else {
        await sacuvajFirebaseNalog(podaci);
        prikaziPoruku(
          'Uspešno',
          'Radni nalog je uspešno sačuvan!'
        );
        router.replace('/');
      }
    } catch (error) {
      console.error(error);
      prikaziPoruku(
        'Greška',
        'Došlo je do greške prilikom čuvanja naloga.'
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
      <View style={styles.header}>
        <Text style={styles.subtitle}>
          MAJSTORMATE · RADNI NALOZI
        </Text>
        <Text style={styles.title}>
          {rezimIzmene
            ? 'Izmeni radni nalog'
            : rezimDupliranja
            ? 'Novi nalog za postojeću mušteriju'
            : 'Novi radni nalog'}
        </Text>
        <Text style={styles.description}>
          {rezimIzmene
            ? 'Izmeni podatke o mušteriji i poslu.'
            : rezimDupliranja
            ? 'Podaci mušterije su preuzeti. Unesi detalje novog posla.'
            : 'Popuni podatke o mušteriji i poslu koji treba da obaviš.'}
        </Text>
      </View>
      {ucitavanje ? (
        <View style={styles.card}>
          <ActivityIndicator
            size="large"
            color="#2563EB"
          />
          <Text style={styles.loadingText}>
            Učitavanje radnog naloga...
          </Text>
        </View>
      ) : greska ? (
        <View style={styles.card}>
          <Text style={styles.errorText}>
            {greska}
          </Text>
        </View>
      ) : (
        <>
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>
              👤 Podaci o mušteriji
            </Text>
            <Text style={styles.label}>
              Ime i prezime \*
            </Text>
            <TextInput
              style={styles.input}
              placeholder="Npr. Petar Petrović"
              placeholderTextColor="#94A3B8"
              value={ime}
              onChangeText={setIme}
            />
            <Text style={styles.label}>
              Broj telefona
            </Text>
            <TextInput
              style={styles.input}
              placeholder="Npr. 0641234567"
              placeholderTextColor="#94A3B8"
              keyboardType="phone-pad"
              value={telefon}
              onChangeText={setTelefon}
              />

              <Text style={styles.label}>
                📍 Adresa mušterije
              </Text>
              <TextInput
                style={styles.input}
                placeholder="Npr. Svetosavska 12, Kikinda"
                placeholderTextColor="#94A3B8"
                value={adresa}
                onChangeText={setAdresa}
                autoCapitalize="words"
              />
              <Text style={styles.addressHelp}>
                Unesi ulicu, broj i mesto. Adresa nije obavezna.
              </Text>
          </View>
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>
              🔧 Detalji posla
            </Text>
            <Text style={styles.label}>
              Opis posla \*
            </Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Npr. Zamena slavine u kuhinji..."
              placeholderTextColor="#94A3B8"
              multiline
              textAlignVertical="top"
              value={opis}
              onChangeText={setOpis}
            />
            <View style={styles.row}>
              <View style={styles.half}>
                <Text style={styles.label}>Datum</Text>
                <TextInput
                  style={styles.input}
                  placeholder="DD.MM.GGGG"
                  placeholderTextColor="#94A3B8"
                  value={datum}
                  onChangeText={setDatum}
                />
              </View>
              <View style={styles.half}>
                <Text style={styles.label}>Vreme</Text>
                <TextInput
                  style={styles.input}
                  placeholder="HH:MM"
                  placeholderTextColor="#94A3B8"
                  value={vreme}
                  onChangeText={setVreme}
                />
              </View>
            </View>
            <Text style={styles.label}>
              Dogovorena cena (RSD)
            </Text>
            <TextInput
              style={styles.input}
              placeholder="Npr. 3500"
              placeholderTextColor="#94A3B8"
              keyboardType="decimal-pad"
              value={cena}
              onChangeText={setCena}
            />
            <Text style={styles.label}>
              Trošak materijala (RSD)
            </Text>
            <TextInput
              style={styles.input}
              placeholder="Npr. 1200"
              placeholderTextColor="#94A3B8"
              keyboardType="decimal-pad"
              value={trosakMaterijala}
              onChangeText={setTrosakMaterijala}
            />
            {prikaziObracun && (
              <View style={styles.profitCard}>
                <Text style={styles.profitLabel}>
                  💰 Zarada nakon materijala
                </Text>
                <Text
                  style={[
                    styles.profitValue,
                    zaradaNakonMaterijala < 0 &&
                      styles.negativeProfit,
                  ]}
                >
                  {formatirajIznos(zaradaNakonMaterijala)}
                </Text>
                <Text style={styles.profitNote}>
                  Cena posla umanjena za trošak materijala.
                  Ovo nije nužno već naplaćen novac.
                </Text>
              </View>
            )}
          </View>
          {/* NOVO: Evidencija naplate */}
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>
              💳 Evidencija naplate
            </Text>
            <Text style={styles.label}>
              Koliko je mušterija uplatila? (RSD)
            </Text>
            <TextInput
              style={styles.input}
              placeholder="Npr. 2000"
              placeholderTextColor="#94A3B8"
              keyboardType="decimal-pad"
              value={uplaceno}
              onChangeText={setUplaceno}
            />
            <Text style={styles.paymentHelp}>
              Unesi ukupan iznos koji je mušterija do sada
              platila. Ako još nije platila, ostavi prazno
              ili unesi 0.
            </Text>
            {!ispravnaUplata && (
              <Text style={styles.paymentError}>
                Unesi ispravan iznos uplate.
              </Text>
            )}
            {ispravnaUplata && !uplataNijeVecaOdCene && (
              <Text style={styles.paymentError}>
                Uplata ne može biti veća od cene posla.
              </Text>
            )}
            {prikaziNaplatu && (
              <View style={styles.paymentCard}>
                <Text style={styles.paymentTitle}>
                  Pregled naplate
                </Text>
                <View style={styles.paymentRow}>
                  <Text style={styles.paymentRowLabel}>
                    Cena posla
                  </Text>
                  <Text style={styles.paymentRowValue}>
                    {formatirajIznos(obracunNaplate.cena)}
                  </Text>
                </View>
                <View style={styles.paymentRow}>
                  <Text style={styles.paymentRowLabel}>
                    Uplaćeno
                  </Text>
                  <Text style={styles.paymentRowValue}>
                    {formatirajIznos(obracunNaplate.uplaceno)}
                  </Text>
                </View>
                <View style={styles.paymentDivider} />
                <View style={styles.paymentRow}>
                  <Text style={styles.paymentRowLabel}>
                    Preostalo za naplatu
                  </Text>
                  <Text
                    style={[
                      styles.paymentRemaining,
                      obracunNaplate.preostalo === 0 &&
                        styles.paymentFullyPaid,
                    ]}
                  >
                    {formatirajIznos(obracunNaplate.preostalo)}
                  </Text>
                </View>
                <View
                  style={[
                    styles.paymentStatus,
                    { backgroundColor: statusPozadina },
                  ]}
                >
                  <Text
                    style={[
                      styles.paymentStatusText,
                      { color: statusBoja },
                    ]}
                  >
                    {obracunNaplate.statusNaplate}
                  </Text>
                </View>
              </View>
            )}
          </View>
          <Pressable
            style={[
              styles.button,
              cuvanje && styles.disabledButton,
            ]}
            onPress={() => void sacuvajNalog()}
            disabled={cuvanje}
          >
            {cuvanje ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.buttonText}>
                {rezimIzmene
                  ? '✓ Sačuvaj izmene'
                  : '✓ Sačuvaj radni nalog'}
              </Text>
            )}
          </Pressable>
          <Text style={styles.note}>
            \* Obavezna polja
          </Text>
        </>
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
    maxWidth: 750,
    alignSelf: 'center',
    padding: 24,
    paddingBottom: 50,
  },
  header: {
    marginBottom: 25,
  },
  subtitle: {
    color: '#64748B',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    marginBottom: 12,
  },
  title: {
    color: '#172554',
    fontSize: 30,
    fontWeight: '800',
    marginBottom: 8,
  },
  description: {
    color: '#64748B',
    fontSize: 14,
    lineHeight: 22,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 22,
    borderWidth: 1,
    borderColor: '#E8EDF5',
    marginBottom: 18,
  },
  sectionTitle: {
    color: '#172554',
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 22,
  },
  label: {
    color: '#334155',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 11,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 14,
    color: '#172554',
    marginBottom: 19,
  },
  addressHelp: {
    color: '#64748B',
    fontSize: 12,
    lineHeight: 18,
    marginTop: -10,
  },
  textArea: {
    height: 110,
    paddingTop: 13,
  },
  row: {
    flexDirection: 'row',
    gap: 14,
  },
  half: {
    flex: 1,
    minWidth: 0,
  },
  profitCard: {
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    borderRadius: 12,
    padding: 18,
    marginTop: 2,
  },
  profitLabel: {
    color: '#166534',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 9,
  },
  profitValue: {
    color: '#15803D',
    fontSize: 25,
    fontWeight: '800',
  },
  negativeProfit: {
    color: '#DC2626',
  },
  profitNote: {
    color: '#64748B',
    fontSize: 11,
    marginTop: 8,
  },
  // NOVO: Stilovi evidencije naplate
  paymentHelp: {
    color: '#64748B',
    fontSize: 12,
    lineHeight: 19,
    marginTop: -7,
    marginBottom: 18,
  },
  paymentError: {
    color: '#DC2626',
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 16,
  },
  paymentCard: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 18,
  },
  paymentTitle: {
    color: '#172554',
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 18,
  },
  paymentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 13,
  },
  paymentRowLabel: {
    color: '#64748B',
    fontSize: 12,
  },
  paymentRowValue: {
    color: '#172554',
    fontSize: 13,
    fontWeight: '700',
  },
  paymentDivider: {
    height: 1,
    backgroundColor: '#CBD5E1',
    marginBottom: 15,
  },
  paymentRemaining: {
    color: '#DC2626',
    fontSize: 15,
    fontWeight: '800',
  },
  paymentFullyPaid: {
    color: '#15803D',
  },
  paymentStatus: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    marginTop: 7,
  },
  paymentStatusText: {
    fontSize: 12,
    fontWeight: '800',
  },
  button: {
    backgroundColor: '#2563EB',
    borderRadius: 14,
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 5,
  },
  disabledButton: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  note: {
    textAlign: 'center',
    color: '#94A3B8',
    fontSize: 12,
    marginTop: 16,
  },
  loadingText: {
    textAlign: 'center',
    color: '#64748B',
    marginTop: 12,
  },
  errorText: {
    textAlign: 'center',
    color: '#DC2626',
    fontSize: 14,
  },
});
