import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  obrisiFotografiju,
  ucitajFotografijeNaloga,
  ucitajUrlFotografije,
} from '../services/backend';

type Fotografija = {
  id: string;
  tip: 'pre' | 'posle';
  kreirano?: string;
  sirina?: number;
  visina?: number;
  url?: string;
  greska?: string;
};

export default function FotografijeEkran() {
  const { nalogId } = useLocalSearchParams<{ nalogId: string }>();
  const [fotografije, setFotografije] = useState<Fotografija[]>([]);
  const [ucitavanje, setUcitavanje] = useState(true);
  const [greska, setGreska] = useState('');
  const [izabranaFotografija, setIzabranaFotografija] = useState<Fotografija | null>(null);
  const [greskaPrikaza, setGreskaPrikaza] = useState(false);
  const [zaBrisanje, setZaBrisanje] = useState<Fotografija | null>(null);
  const [brisanje, setBrisanje] = useState(false);
  const [greskaBrisanja, setGreskaBrisanja] = useState('');
  const zahtevRef = useRef(0);
  const aktivanRef = useRef(false);

  const ucitaj = useCallback(async () => {
    const zahtev = ++zahtevRef.current;
    if (!aktivanRef.current) return;
    setUcitavanje(true);
    setGreska('');

    try {
      if (!nalogId) throw new Error('Nedostaje ID radnog naloga.');
      const rezultat = await ucitajFotografijeNaloga(nalogId);
      const lista: Fotografija[] = Array.isArray(rezultat.fotografije)
        ? rezultat.fotografije
        : [];
      const saUrlovima = await Promise.all(
        lista.map(async (slika) => {
          try {
            const url = await ucitajUrlFotografije(nalogId, slika.id);
            return { ...slika, url };
          } catch (error) {
            return {
              ...slika,
              greska: error instanceof Error ? error.message : 'Fotografija nije dostupna.',
            };
          }
        })
      );
      if (aktivanRef.current && zahtev === zahtevRef.current) {
        setFotografije(saUrlovima);
      }
    } catch (error) {
      if (aktivanRef.current && zahtev === zahtevRef.current) {
        setGreska(error instanceof Error ? error.message : 'Nije uspelo učitavanje fotografija.');
      }
    } finally {
      if (aktivanRef.current && zahtev === zahtevRef.current) {
        setUcitavanje(false);
      }
    }
  }, [nalogId]);

  useFocusEffect(
    useCallback(() => {
      aktivanRef.current = true;
      void ucitaj();
      return () => {
        aktivanRef.current = false;
        zahtevRef.current += 1;
      };
    }, [ucitaj])
  );

  const potvrdiBrisanje = async () => {
    if (!zaBrisanje || !nalogId || brisanje) return;
    setBrisanje(true);
    setGreskaBrisanja('');
    try {
      await obrisiFotografiju(nalogId, zaBrisanje.id);
      setFotografije((prethodne) => prethodne.filter((slika) => slika.id !== zaBrisanje.id));
      if (izabranaFotografija?.id === zaBrisanje.id) setIzabranaFotografija(null);
      setZaBrisanje(null);
      await ucitaj();
    } catch (error) {
      setGreskaBrisanja(error instanceof Error ? error.message : 'Brisanje fotografije nije uspelo.');
    } finally {
      setBrisanje(false);
    }
  };

  const pre = fotografije.filter((slika) => slika.tip === 'pre');
  const posle = fotografije.filter((slika) => slika.tip === 'posle');

  const prikaziFotografiju = (slika: Fotografija) => (
    <View key={slika.id} style={styles.photoCard}>
      {slika.url ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Otvori fotografiju ${slika.tip === 'pre' ? 'pre' : 'posle'} radova preko celog ekrana`}
          onPress={() => {
            setGreskaPrikaza(false);
            setIzabranaFotografija(slika);
          }}
        >
          <Image source={{ uri: slika.url }} style={styles.photo} resizeMode="contain" />
          <Text style={styles.openHint}>🔍 Dodirni za ceo ekran</Text>
        </Pressable>
      ) : (
        <View style={styles.photoPlaceholder}>
          <Text style={styles.error}>{slika.greska || 'Fotografija nije dostupna.'}</Text>
        </View>
      )}
      <Text style={styles.photoLabel}>
        {slika.tip === 'pre' ? '🔨 PRE radova' : '✅ POSLE radova'}
      </Text>
      {slika.kreirano ? (
        <Text style={styles.photoDate}>{new Date(slika.kreirano).toLocaleString('sr-RS')}</Text>
      ) : null}
      <Pressable
        style={styles.deleteButton}
        accessibilityRole="button"
        accessibilityLabel="Obriši fotografiju"
        onPress={() => {
          setGreskaBrisanja('');
          setZaBrisanje(slika);
        }}
      >
        <Text style={styles.deleteText}>🗑️ Obriši fotografiju</Text>
      </Pressable>
    </View>
  );

  return (
    <>
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        <Pressable onPress={() => router.back()}>
          <Text style={styles.back}>← Nazad</Text>
        </Pressable>
        <Text style={styles.title}>📸 Fotografije radova</Text>
        <Text style={styles.subtitle}>Pregled fotografija PRE i POSLE radova</Text>
        {ucitavanje ? (
          <View style={styles.loading}>
            <ActivityIndicator size="large" color="#2563EB" />
            <Text style={styles.empty}>Učitavanje fotografija...</Text>
          </View>
        ) : greska ? (
          <View style={styles.card}>
            <Text style={styles.error}>{greska}</Text>
            <Pressable style={styles.refreshButton} onPress={() => void ucitaj()}>
              <Text style={styles.refreshText}>🔄 Pokušaj ponovo</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>🔨 PRE radova ({pre.length})</Text>
              {pre.length === 0 ? (
                <Text style={styles.empty}>Još nema fotografija pre radova.</Text>
              ) : pre.map(prikaziFotografiju)}
            </View>
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>✅ POSLE radova ({posle.length})</Text>
              {posle.length === 0 ? (
                <Text style={styles.empty}>Još nema fotografija posle radova.</Text>
              ) : posle.map(prikaziFotografiju)}
            </View>
            <Pressable style={styles.refreshButton} onPress={() => void ucitaj()}>
              <Text style={styles.refreshText}>🔄 Osveži fotografije</Text>
            </Pressable>
          </>
        )}
      </ScrollView>

      <Modal
        visible={izabranaFotografija !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setIzabranaFotografija(null)}
        statusBarTranslucent
      >
        <View style={styles.fullScreen}>
          <Pressable
            style={styles.closeButton}
            onPress={() => setIzabranaFotografija(null)}
            accessibilityRole="button"
            accessibilityLabel="Zatvori fotografiju"
          >
            <Text style={styles.closeText}>✕ Zatvori</Text>
          </Pressable>
          {izabranaFotografija?.url && !greskaPrikaza ? (
            <Image
              key={izabranaFotografija.id}
              source={{ uri: izabranaFotografija.url }}
              style={styles.fullImage}
              resizeMode="contain"
              onError={() => setGreskaPrikaza(true)}
            />
          ) : (
            <Text style={styles.fullError}>Fotografija trenutno nije dostupna.</Text>
          )}
          <Text style={styles.fullCaption}>
            {izabranaFotografija?.tip === 'pre' ? '🔨 PRE radova' : '✅ POSLE radova'}
          </Text>
        </View>
      </Modal>

      <Modal
        visible={zaBrisanje !== null}
        transparent
        animationType="fade"
        onRequestClose={() => { if (!brisanje) setZaBrisanje(null); }}
      >
        <View style={styles.confirmOverlay}>
          <View style={styles.confirmCard}>
            <Text style={styles.confirmTitle}>🗑️ Obriši fotografiju?</Text>
            <Text style={styles.confirmDescription}>
              Fotografija će biti trajno obrisana. Ova radnja ne može da se poništi.
            </Text>
            {greskaBrisanja ? <Text style={styles.error}>{greskaBrisanja}</Text> : null}
            {brisanje ? <ActivityIndicator color="#DC2626" style={styles.deleteSpinner} /> : null}
            <Pressable
              style={[styles.confirmDelete, brisanje && styles.disabledButton]}
              disabled={brisanje}
              onPress={() => void potvrdiBrisanje()}
            >
              <Text style={styles.confirmDeleteText}>Da, obriši</Text>
            </Pressable>
            <Pressable
              style={[styles.cancelButton, brisanje && styles.disabledButton]}
              disabled={brisanje}
              onPress={() => setZaBrisanje(null)}
            >
              <Text style={styles.cancelText}>Odustani</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F5F7FB' },
  content: { width: '100%', maxWidth: 850, alignSelf: 'center', padding: 24, paddingBottom: 50 },
  back: { color: '#2563EB', fontSize: 15, fontWeight: '700', marginBottom: 24 },
  title: { color: '#172554', fontSize: 26, fontWeight: '800', marginBottom: 8 },
  subtitle: { color: '#64748B', fontSize: 14, marginBottom: 25 },
  loading: { paddingVertical: 40, alignItems: 'center' },
  card: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 20, marginBottom: 16 },
  sectionTitle: { color: '#172554', fontSize: 18, fontWeight: '800', marginBottom: 16 },
  photoCard: { backgroundColor: '#F8FAFC', borderRadius: 12, overflow: 'hidden', marginBottom: 16, borderWidth: 1, borderColor: '#E2E8F0' },
  photo: { width: '100%', height: 260, backgroundColor: '#E2E8F0' },
  openHint: { color: '#2563EB', textAlign: 'center', fontSize: 12, fontWeight: '700', paddingVertical: 8 },
  photoPlaceholder: { height: 180, justifyContent: 'center', alignItems: 'center', padding: 20 },
  photoLabel: { color: '#172554', fontSize: 14, fontWeight: '800', paddingHorizontal: 14, paddingTop: 12 },
  photoDate: { color: '#64748B', fontSize: 12, paddingHorizontal: 14, paddingTop: 5, paddingBottom: 14 },
  empty: { color: '#64748B', fontSize: 14, textAlign: 'center', marginTop: 12 },
  error: { color: '#DC2626', fontSize: 14, textAlign: 'center' },
  refreshButton: { backgroundColor: '#2563EB', padding: 14, borderRadius: 10, alignItems: 'center', marginTop: 12 },
  refreshText: { color: '#FFFFFF', fontWeight: '800', fontSize: 14 },
  deleteButton: { marginHorizontal: 14, marginTop: 10, marginBottom: 14, backgroundColor: '#FEE2E2', padding: 12, borderRadius: 9, alignItems: 'center' },
  deleteText: { color: '#B91C1C', fontWeight: '800', fontSize: 14 },
  fullScreen: { flex: 1, backgroundColor: '#050505', justifyContent: 'center', alignItems: 'center', paddingTop: 80, paddingBottom: 50 },
  closeButton: { position: 'absolute', top: 52, right: 20, zIndex: 2, backgroundColor: '#242424', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 11 },
  closeText: { color: '#FFFFFF', fontWeight: '800', fontSize: 15 },
  fullImage: { width: '100%', flex: 1 },
  fullCaption: { color: '#FFFFFF', fontWeight: '700', fontSize: 16, paddingTop: 14 },
  fullError: { color: '#FFFFFF', fontSize: 14, textAlign: 'center', flex: 1, textAlignVertical: 'center' },
  confirmOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'center', padding: 24 },
  confirmCard: { backgroundColor: '#FFFFFF', borderRadius: 18, padding: 22, maxWidth: 440, width: '100%', alignSelf: 'center' },
  confirmTitle: { color: '#172554', fontSize: 20, fontWeight: '800', marginBottom: 10 },
  confirmDescription: { color: '#475569', fontSize: 14, lineHeight: 21, marginBottom: 18 },
  confirmDelete: { backgroundColor: '#DC2626', borderRadius: 10, padding: 14, alignItems: 'center', marginTop: 12 },
  confirmDeleteText: { color: '#FFFFFF', fontWeight: '800', fontSize: 15 },
  cancelButton: { backgroundColor: '#F1F5F9', borderRadius: 10, padding: 14, alignItems: 'center', marginTop: 10 },
  cancelText: { color: '#334155', fontWeight: '700', fontSize: 15 },
  deleteSpinner: { marginVertical: 10 },
  disabledButton: { opacity: 0.5 },
});