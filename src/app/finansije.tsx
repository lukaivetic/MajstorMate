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
import type { RadniNalog, StatusNaplate } from '../services/nalozi';
import {
  izracunajNaplatu,
  procitajNovcaniIznos,
} from '../services/nalozi';

const meseci = [
  'Januar', 'Februar', 'Mart', 'April', 'Maj', 'Jun',
  'Jul', 'Avgust', 'Septembar', 'Oktobar', 'Novembar', 'Decembar',
];

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

function formatirajNovac(iznos: number): string {
  return iznos.toLocaleString('sr-RS', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }) + ' RSD';
}

function bojaNaplate(status: StatusNaplate) {
  if (status === 'Plaćeno') {
    return { pozadina: '#DCFCE7', tekst: '#15803D' };
  }
  if (status === 'Delimično plaćeno') {
    return { pozadina: '#FEF3C7', tekst: '#B45309' };
  }
  return { pozadina: '#FEE2E2', tekst: '#DC2626' };
}

export default function Finansije() {
  const [nalozi, setNalozi] = useState<RadniNalog[]>([]);
  const [izabraniMesec, setIzabraniMesec] = useState(
    () => new Date(new Date().getFullYear(), new Date().getMonth(), 1)
  );
  const [ucitavanje, setUcitavanje] = useState(true);
  const [greska, setGreska] = useState('');

  useFocusEffect(
    useCallback(() => {
      let aktivno = true;
      const ucitaj = async () => {
        setUcitavanje(true);
        setGreska('');
        try {
          const podaci = await ucitajFirebaseNaloge();
          if (aktivno) setNalozi(podaci);
        } catch (error) {
          console.error(error);
          if (aktivno) {
            setNalozi([]);
            setGreska('Nije uspelo učitavanje finansijskih izveštaja.');
          }
        } finally {
          if (aktivno) setUcitavanje(false);
        }
      };
      void ucitaj();
      return () => { aktivno = false; };
    }, [])
  );

  const godina = izabraniMesec.getFullYear();
  const mesec = izabraniMesec.getMonth();

  const prethodniMesec = () => {
    setIzabraniMesec(new Date(godina, mesec - 1, 1));
  };
  const sledeciMesec = () => {
    setIzabraniMesec(new Date(godina, mesec + 1, 1));
  };

  const sviPosloviUMesecu = nalozi.filter((nalog) => {
    const datum = procitajDatum(nalog.datum);
    return datum !== null &&
      datum.getMonth() === mesec &&
      datum.getFullYear() === godina;
  });

  const zavrseniUMesecu = sviPosloviUMesecu
    .filter((nalog) => (nalog.status || 'Zakazan') === 'Završen')
    .sort((a, b) =>
      (procitajDatum(b.datum)?.getTime() || 0) -
      (procitajDatum(a.datum)?.getTime() || 0)
    );

  const ukupnaVrednost = zavrseniUMesecu.reduce(
    (ukupno, nalog) => ukupno + procitajNovcaniIznos(nalog.cena), 0
  );
  const ukupniTroskovi = zavrseniUMesecu.reduce(
    (ukupno, nalog) =>
      ukupno + procitajNovcaniIznos(nalog.trosakMaterijala ?? '0'), 0
  );
  const ukupnaZarada = ukupnaVrednost - ukupniTroskovi;
  const prosecnaCena = zavrseniUMesecu.length > 0
    ? ukupnaVrednost / zavrseniUMesecu.length : 0;
  const brojNezavrsenih = sviPosloviUMesecu.length - zavrseniUMesecu.length;

  // Naplata je vezana za zavrsene poslove ciji je datum posla u izabranom mesecu.
  // Ne predstavlja tok uplata po datumu prijema, jer ne cuvamo datum svake uplate.
  const ukupnoNaplaćeno = zavrseniUMesecu.reduce(
    (ukupno, nalog) => ukupno + izracunajNaplatu(nalog).uplaceno, 0
  );
  const ukupnoDugovanje = zavrseniUMesecu.reduce(
    (ukupno, nalog) => ukupno + izracunajNaplatu(nalog).preostalo, 0
  );
  const brojPlacenih = zavrseniUMesecu.filter(
    (nalog) => izracunajNaplatu(nalog).statusNaplate === 'Plaćeno'
  ).length;
  const brojDelimicnih = zavrseniUMesecu.filter(
    (nalog) => izracunajNaplatu(nalog).statusNaplate === 'Delimično plaćeno'
  ).length;
  const brojNeplacenih = zavrseniUMesecu.filter(
    (nalog) => izracunajNaplatu(nalog).statusNaplate === 'Neplaćeno'
  ).length;
  const naplacenoNakonMaterijala = ukupnoNaplaćeno - ukupniTroskovi;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.title}>💰 Finansijski izveštaji</Text>
      <Text style={styles.subtitle}>
        Pregled vrednosti poslova, troškova materijala, zarade i evidentirane naplate po mesecima.
      </Text>

      <View style={styles.monthCard}>
        <Text style={styles.sectionLabel}>IZABERI MESEC</Text>
        <View style={styles.monthRow}>
          <Pressable style={styles.monthButton} onPress={prethodniMesec}>
            <Text style={styles.monthButtonText}>‹</Text>
          </Pressable>
          <Text style={styles.monthTitle}>{meseci[mesec]} {godina}.</Text>
          <Pressable style={styles.monthButton} onPress={sledeciMesec}>
            <Text style={styles.monthButtonText}>›</Text>
          </Pressable>
        </View>
      </View>

      {ucitavanje ? (
        <View style={styles.emptyCard}>
          <ActivityIndicator size="large" color="#2563EB" />
          <Text style={[styles.emptyText, styles.loadingText]}>
            Učitavanje finansijskih izveštaja...
          </Text>
        </View>
      ) : greska ? (
        <View style={styles.emptyCard}>
          <Text style={styles.errorText}>{greska}</Text>
        </View>
      ) : (
        <>
          <View style={styles.mainCard}>
            <Text style={styles.mainCardIcon}>💵</Text>
            <Text style={styles.mainCardLabel}>Ukupna vrednost završenih poslova</Text>
            <Text style={styles.mainCardValue}>{formatirajNovac(ukupnaVrednost)}</Text>
            <Text style={styles.mainCardNote}>
              Za {meseci[mesec].toLowerCase()} {godina}. Ovo nije iznos stvarno naplaćenog novca.
            </Text>
          </View>

          <View style={styles.financialRow}>
            <View style={styles.expenseCard}>
              <Text style={styles.financialIcon}>🧾</Text>
              <Text style={styles.financialLabel}>Troškovi materijala</Text>
              <Text style={styles.expenseValue}>{formatirajNovac(ukupniTroskovi)}</Text>
            </View>
            <View style={styles.profitCard}>
              <Text style={styles.financialIcon}>💰</Text>
              <Text style={styles.financialLabel}>Zarada nakon materijala</Text>
              <Text style={[styles.profitValue, ukupnaZarada < 0 && styles.negativeValue]}>
                {formatirajNovac(ukupnaZarada)}
              </Text>
            </View>
          </View>

          {/* NOVO: Evidentirana naplata */}
          <Text style={styles.sectionTitle}>💳 Pregled naplate</Text>
          <View style={styles.financialRow}>
            <View style={styles.collectedCard}>
              <Text style={styles.financialIcon}>✅</Text>
              <Text style={styles.financialLabel}>Ukupno evidentirano kao naplaćeno</Text>
              <Text style={styles.collectedValue}>{formatirajNovac(ukupnoNaplaćeno)}</Text>
            </View>
            <View style={styles.debtCard}>
              <Text style={styles.financialIcon}>🔴</Text>
              <Text style={styles.financialLabel}>Preostalo za naplatu</Text>
              <Text style={styles.debtValue}>{formatirajNovac(ukupnoDugovanje)}</Text>
            </View>
          </View>
          <View style={styles.paymentSummaryCard}>
            <Text style={styles.paymentSummaryTitle}>Status naplate završenih poslova</Text>
            <View style={styles.paymentSummaryRow}>
              <Text style={styles.paymentSummaryText}>🟢 Potpuno plaćeni</Text>
              <Text style={styles.paymentSummaryNumber}>{brojPlacenih}</Text>
            </View>
            <View style={styles.paymentSummaryRow}>
              <Text style={styles.paymentSummaryText}>🟡 Delimično plaćeni</Text>
              <Text style={styles.paymentSummaryNumber}>{brojDelimicnih}</Text>
            </View>
            <View style={styles.paymentSummaryRow}>
              <Text style={styles.paymentSummaryText}>🔴 Neplaćeni / bez evidentirane uplate</Text>
              <Text style={styles.paymentSummaryNumber}>{brojNeplacenih}</Text>
            </View>
            <View style={styles.jobFinanceDivider} />
            <View style={styles.paymentSummaryRow}>
              <Text style={styles.paymentSummaryText}>Evidentirane uplate minus troškovi materijala</Text>
              <Text style={[styles.paymentSummaryNumber, naplacenoNakonMaterijala < 0 && styles.negativeValue]}>
                {formatirajNovac(naplacenoNakonMaterijala)}
              </Text>
            </View>
            <Text style={styles.paymentSummaryNote}>
              Ovaj iznos nije konačan profit: ne uključuje druge troškove ni poreze.
            </Text>
          </View>

          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <Text style={styles.statIcon}>✅</Text>
              <Text style={styles.statNumber}>{zavrseniUMesecu.length}</Text>
              <Text style={styles.statLabel}>Završeni poslovi</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statIcon}>🔧</Text>
              <Text style={styles.statNumber}>{brojNezavrsenih}</Text>
              <Text style={styles.statLabel}>Nezavršeni poslovi</Text>
            </View>
          </View>

          <View style={styles.averageCard}>
            <Text style={styles.averageIcon}>📊</Text>
            <View style={styles.averageContent}>
              <Text style={styles.averageLabel}>Prosečna cena završenog posla</Text>
              <Text style={styles.averageValue}>{formatirajNovac(prosecnaCena)}</Text>
            </View>
          </View>

          <Text style={styles.sectionTitle}>Završeni poslovi u mesecu</Text>
          {zavrseniUMesecu.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyText}>
                Nema završenih poslova za izabrani mesec.
              </Text>
            </View>
          ) : (
            zavrseniUMesecu.map((nalog) => {
              const cena = procitajNovcaniIznos(nalog.cena);
              const trosak = procitajNovcaniIznos(nalog.trosakMaterijala ?? '0');
              const zarada = cena - trosak;
              const naplata = izracunajNaplatu(nalog);
              const boje = bojaNaplate(naplata.statusNaplate);

              return (
                <View key={nalog.id} style={styles.jobCard}>
                  <View style={styles.jobHeader}>
                    <Text style={styles.customerName}>{nalog.ime}</Text>
                    <Text style={styles.jobPrice}>{formatirajNovac(cena)}</Text>
                  </View>
                  <Text style={styles.jobDescription}>🔧 {nalog.opis}</Text>
                  <Text style={styles.jobDetails}>
                    📅 {nalog.datum}{nalog.vreme ? ` · ${nalog.vreme}` : ''}
                  </Text>
                  <Text style={styles.jobDetails}>
                    📞 {nalog.telefon || 'Telefon nije unet'}
                  </Text>

                  <View style={styles.jobFinanceBox}>
                    <View style={styles.jobFinanceRow}>
                      <Text style={styles.jobFinanceLabel}>Cena posla</Text>
                      <Text style={styles.jobFinanceAmount}>{formatirajNovac(cena)}</Text>
                    </View>
                    <View style={styles.jobFinanceRow}>
                      <Text style={styles.jobFinanceLabel}>Trošak materijala</Text>
                      <Text style={styles.jobExpenseAmount}>{formatirajNovac(trosak)}</Text>
                    </View>
                    <View style={styles.jobFinanceDivider} />
                    <View style={styles.jobFinanceRow}>
                      <Text style={styles.jobProfitLabel}>Zarada nakon materijala</Text>
                      <Text style={[styles.jobProfitAmount, zarada < 0 && styles.negativeValue]}>
                        {formatirajNovac(zarada)}
                      </Text>
                    </View>
                  </View>

                  {/* NOVO: Obracun naplate pojedinacnog posla */}
                  <View style={styles.jobPaymentBox}>
                    <Text style={styles.jobPaymentTitle}>💳 Evidencija naplate</Text>
                    <View style={styles.jobFinanceRow}>
                      <Text style={styles.jobFinanceLabel}>Uplaćeno</Text>
                      <Text style={styles.jobPaidAmount}>{formatirajNovac(naplata.uplaceno)}</Text>
                    </View>
                    <View style={styles.jobFinanceRow}>
                      <Text style={styles.jobFinanceLabel}>Preostali dug</Text>
                      <Text style={[styles.jobDebtAmount, naplata.preostalo === 0 && styles.jobPaidAmount]}>
                        {formatirajNovac(naplata.preostalo)}
                      </Text>
                    </View>
                    <View style={[styles.paymentBadge, { backgroundColor: boje.pozadina }]}>
                      <Text style={[styles.paymentBadgeText, { color: boje.tekst }]}>
                        {naplata.statusNaplate}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.completedBadge}>
                    <Text style={styles.completedBadgeText}>✓ Završen</Text>
                  </View>
                  <Pressable
                    style={styles.editButton}
                    onPress={() => router.push({
                      pathname: '/novi-nalog',
                      params: { id: nalog.id },
                    })}
                  >
                    <Text style={styles.editButtonText}>✏️ Izmeni nalog</Text>
                  </Pressable>
                </View>
              );
            })
          )}

          <Text style={styles.disclaimer}>
            Napomena: izveštaj obuhvata naloge sa statusom „Završen“ prema datumu
            zakazanog posla. Iznosi naplate prikazuju trenutno evidentirane uplate
            za te poslove, a ne uplate koje su nužno primljene u izabranom mesecu.
            Bez datuma pojedinačnih uplata nije moguće napraviti precizan mesečni
            izveštaj o prilivu novca. Stari nalozi bez evidentirane uplate prikazuju
            0 RSD naplaćeno. Zarada nakon materijala ne uključuje druge troškove i poreze.
          </Text>
        </>
      )}

      <Pressable style={styles.backButton} onPress={() => router.push('/')}>
        <Text style={styles.backButtonText}>← Nazad na Dashboard</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F5F7FB' },
  content: {
    width: '100%', maxWidth: 850, alignSelf: 'center', padding: 24, paddingBottom: 50,
  },
  title: { color: '#172554', fontSize: 29, fontWeight: '800', marginBottom: 8 },
  subtitle: { color: '#64748B', fontSize: 14, marginBottom: 25 },
  monthCard: {
    backgroundColor: '#FFFFFF', borderRadius: 18, padding: 20,
    borderWidth: 1, borderColor: '#E8EDF5', marginBottom: 20,
  },
  sectionLabel: {
    color: '#94A3B8', fontSize: 11, fontWeight: '800',
    letterSpacing: 1, textAlign: 'center', marginBottom: 15,
  },
  monthRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  monthButton: {
    backgroundColor: '#EFF6FF', width: 44, height: 44,
    borderRadius: 12, alignItems: 'center', justifyContent: 'center',
  },
  monthButtonText: {
    color: '#2563EB', fontSize: 30, lineHeight: 35, fontWeight: '700',
  },
  monthTitle: { color: '#172554', fontSize: 19, fontWeight: '800' },
  mainCard: {
    backgroundColor: '#EFF6FF', borderRadius: 18, padding: 24,
    borderWidth: 1, borderColor: '#BFDBFE', marginBottom: 16,
  },
  mainCardIcon: { fontSize: 28, marginBottom: 13 },
  mainCardLabel: {
    color: '#475569', fontSize: 13, fontWeight: '700', marginBottom: 10,
  },
  mainCardValue: { color: '#1D4ED8', fontSize: 30, fontWeight: '800' },
  mainCardNote: { color: '#64748B', fontSize: 12, marginTop: 10 },
  financialRow: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  expenseCard: {
    flex: 1, minWidth: 0, backgroundColor: '#FFF7ED', borderRadius: 16,
    padding: 18, borderWidth: 1, borderColor: '#FED7AA',
  },
  profitCard: {
    flex: 1, minWidth: 0, backgroundColor: '#F0FDF4', borderRadius: 16,
    padding: 18, borderWidth: 1, borderColor: '#BBF7D0',
  },
  financialIcon: { fontSize: 23, marginBottom: 12 },
  financialLabel: { color: '#475569', fontSize: 12, fontWeight: '700', marginBottom: 9 },
  expenseValue: { color: '#C2410C', fontSize: 20, fontWeight: '800', flexShrink: 1 },
  profitValue: { color: '#15803D', fontSize: 20, fontWeight: '800', flexShrink: 1 },
  negativeValue: { color: '#DC2626' },
  collectedCard: {
    flex: 1, minWidth: 0, backgroundColor: '#F0FDF4', borderRadius: 16,
    padding: 18, borderWidth: 1, borderColor: '#BBF7D0',
  },
  collectedValue: { color: '#15803D', fontSize: 20, fontWeight: '800', flexShrink: 1 },
  debtCard: {
    flex: 1, minWidth: 0, backgroundColor: '#FEF2F2', borderRadius: 16,
    padding: 18, borderWidth: 1, borderColor: '#FECACA',
  },
  debtValue: { color: '#DC2626', fontSize: 20, fontWeight: '800', flexShrink: 1 },
  paymentSummaryCard: {
    backgroundColor: '#FFFFFF', borderRadius: 16, padding: 19,
    borderWidth: 1, borderColor: '#E8EDF5', marginBottom: 20,
  },
  paymentSummaryTitle: {
    color: '#172554', fontSize: 15, fontWeight: '800', marginBottom: 16,
  },
  paymentSummaryRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    flexWrap: 'wrap', gap: 10, marginBottom: 12,
  },
  paymentSummaryText: { color: '#475569', fontSize: 12, flexShrink: 1 },
  paymentSummaryNumber: { color: '#172554', fontSize: 15, fontWeight: '800' },
  paymentSummaryNote: { color: '#64748B', fontSize: 11, lineHeight: 17 },
  statsRow: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  statCard: {
    flex: 1, backgroundColor: '#FFFFFF', borderRadius: 16, padding: 18,
    borderWidth: 1, borderColor: '#E8EDF5',
  },
  statIcon: { fontSize: 22, marginBottom: 10 },
  statNumber: { color: '#172554', fontSize: 27, fontWeight: '800' },
  statLabel: { color: '#64748B', fontSize: 12, marginTop: 6 },
  averageCard: {
    backgroundColor: '#FFFFFF', borderRadius: 16, padding: 19,
    borderWidth: 1, borderColor: '#E8EDF5', flexDirection: 'row',
    alignItems: 'center', gap: 15, marginBottom: 28,
  },
  averageIcon: { fontSize: 28 },
  averageContent: { flex: 1 },
  averageLabel: { color: '#64748B', fontSize: 12, marginBottom: 7 },
  averageValue: { color: '#172554', fontSize: 21, fontWeight: '800' },
  sectionTitle: {
    color: '#172554', fontSize: 19, fontWeight: '800', marginBottom: 15,
  },
  emptyCard: {
    backgroundColor: '#FFFFFF', borderRadius: 16, padding: 22,
    borderWidth: 1, borderColor: '#E8EDF5',
  },
  emptyText: { color: '#64748B', fontSize: 13, textAlign: 'center' },
  loadingText: { marginTop: 12 },
  errorText: { color: '#DC2626', fontSize: 13, textAlign: 'center' },
  jobCard: {
    backgroundColor: '#FFFFFF', borderRadius: 16, padding: 19,
    borderWidth: 1, borderColor: '#E8EDF5', marginBottom: 12,
  },
  jobHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    flexWrap: 'wrap', gap: 10, marginBottom: 12,
  },
  customerName: { color: '#172554', fontSize: 16, fontWeight: '800' },
  jobPrice: { color: '#2563EB', fontSize: 16, fontWeight: '800' },
  jobDescription: { color: '#475569', fontSize: 14, marginBottom: 12 },
  jobDetails: { color: '#64748B', fontSize: 12, marginBottom: 9 },
  jobFinanceBox: {
    backgroundColor: '#F8FAFC', borderRadius: 12, padding: 15,
    marginTop: 10, marginBottom: 8,
  },
  jobFinanceRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    flexWrap: 'wrap', gap: 8, marginBottom: 8,
  },
  jobFinanceLabel: { color: '#64748B', fontSize: 12 },
  jobFinanceAmount: { color: '#172554', fontSize: 12, fontWeight: '700' },
  jobExpenseAmount: { color: '#C2410C', fontSize: 12, fontWeight: '700' },
  jobFinanceDivider: {
    height: 1, backgroundColor: '#E2E8F0', marginVertical: 6,
  },
  jobProfitLabel: { color: '#166534', fontSize: 12, fontWeight: '700' },
  jobProfitAmount: { color: '#15803D', fontSize: 14, fontWeight: '800' },
  jobPaymentBox: {
    backgroundColor: '#F8FAFC', borderRadius: 12, borderWidth: 1,
    borderColor: '#E2E8F0', padding: 15, marginBottom: 8,
  },
  jobPaymentTitle: {
    color: '#172554', fontSize: 13, fontWeight: '800', marginBottom: 13,
  },
  jobPaidAmount: { color: '#15803D', fontSize: 13, fontWeight: '800' },
  jobDebtAmount: { color: '#DC2626', fontSize: 13, fontWeight: '800' },
  paymentBadge: {
    alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 7,
    borderRadius: 8, marginTop: 5,
  },
  paymentBadgeText: { fontSize: 12, fontWeight: '800' },
  completedBadge: {
    backgroundColor: '#DCFCE7', borderRadius: 8, paddingHorizontal: 12,
    paddingVertical: 7, alignSelf: 'flex-start', marginTop: 8,
  },
  completedBadgeText: { color: '#15803D', fontSize: 12, fontWeight: '700' },
  editButton: {
    backgroundColor: '#EFF6FF', borderRadius: 9, paddingHorizontal: 14,
    paddingVertical: 11, marginTop: 16, alignSelf: 'flex-start',
  },
  editButtonText: { color: '#2563EB', fontSize: 12, fontWeight: '700' },
  disclaimer: { color: '#64748B', fontSize: 11, lineHeight: 18, marginTop: 22 },
  backButton: { padding: 15, alignItems: 'center', marginTop: 16 },
  backButtonText: { color: '#2563EB', fontSize: 14, fontWeight: '700' },
});
