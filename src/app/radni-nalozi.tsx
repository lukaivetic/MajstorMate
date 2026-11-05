import * as ImagePicker from 'expo-image-picker';
import { router, useFocusEffect } from 'expo-router';
import { doc, runTransaction } from 'firebase/firestore';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { posaljiFotografijuNaloga } from '../services/backend';
import { auth, db } from '../services/firebase';
import {
  obrisiFirebaseNalog,
  promeniFirebaseStatus,
  ucitajFirebaseNaloge,
} from '../services/firebaseNalozi';
import {
  ucitajFirebaseProfil,
} from '../services/firebaseProfil';
import type {
  RadniNalog,
  StatusNaloga,
  Uplata,
} from '../services/nalozi';
import { izracunajNaplatu, procitajNovcaniIznos } from '../services/nalozi';
type FilterStatus = 'Svi' | StatusNaloga;
type Sortiranje = 'Najnoviji prvo' | 'Najstariji prvo';
type TipPdf = 'musterija' | 'interni';
// Zastita HTML dokumenta od ubacivanja koda
const escapeHtml = (tekst: string): string =>
  tekst
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
// Pretvaranje novcanih iznosa u broj
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
export default function RadniNalozi() {
  const [nalozi, setNalozi] = useState<RadniNalog[]>([]);
  const [pretraga, setPretraga] = useState('');
  const [filterStatus, setFilterStatus] =
    useState<FilterStatus>('Svi');
  const [sortiranje, setSortiranje] =
    useState<Sortiranje>('Najnoviji prvo');
  const [ucitavanje, setUcitavanje] = useState(true);
  const [greska, setGreska] = useState('');
  const [obrada, setObrada] = useState(false);
  const [slanjeFotografije, setSlanjeFotografije] = useState(false);
  const [nalogZaUplatu, setNalogZaUplatu] = useState<string | null>(null);
  const [iznosNoveUplate, setIznosNoveUplate] = useState('');
  const [datumNoveUplate, setDatumNoveUplate] = useState(() => {
    const danas = new Date();
    return `${String(danas.getDate()).padStart(2, '0')}.${String(danas.getMonth() + 1).padStart(2, '0')}.${danas.getFullYear()}.`;
  });
  const dodajUplatu = async (nalog: RadniNalog) => {
    if (obrada) return;
    const iznos = procitajNovcaniIznos(iznosNoveUplate);
    const datum = datumNoveUplate.trim();
    const delovi = datum.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})\.?$/);
    if (!iznosNoveUplate.trim() || !Number.isFinite(iznos) || iznos <= 0 ||
        !/^[\d\s.,]+$/.test(iznosNoveUplate)) {
      prikaziGresku('Unesi ispravan iznos uplate veći od nule.');
      return;
    }
    if (!delovi) {
      prikaziGresku('Datum mora biti u formatu DD.MM.GGGG.');
      return;
    }
    const dan = Number(delovi[1]);
    const mesec = Number(delovi[2]);
    const godina = Number(delovi[3]);
    const provera = new Date(godina, mesec - 1, dan);
    if (provera.getFullYear() !== godina || provera.getMonth() !== mesec - 1 || provera.getDate() !== dan) {
      prikaziGresku('Unesi postojeći datum.');
      return;
    }
    const korisnik = auth.currentUser;
    if (!korisnik) {
      prikaziGresku('Korisnik nije prijavljen.');
      return;
    }
    try {
      setObrada(true);
      const referenca = doc(db, 'korisnici', korisnik.uid, 'nalozi', nalog.id);
      const novaUplata: Uplata = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
        datum: `${String(dan).padStart(2, '0')}.${String(mesec).padStart(2, '0')}.${godina}.`,
        iznos: String(Math.round(iznos * 100) / 100),
      };
      const osvezen = await runTransaction(db, async (transakcija) => {
        const snimak = await transakcija.get(referenca);
        if (!snimak.exists()) throw new Error('Radni nalog više ne postoji.');
        const podaci = snimak.data() as Omit<RadniNalog, 'id'>;
        let uplate: Uplata[] = Array.isArray(podaci.uplate) ? [...podaci.uplate] : [];
        // Postojeću uplatu čuvamo kao ranije evidentiranu, bez izmišljanja datuma.
        if (!Array.isArray(podaci.uplate)) {
          const stariIznos = procitajNovcaniIznos(podaci.uplaceno ?? '0');
          if (stariIznos > 0) {
            uplate.push({ id: 'ranija-uplata', datum: 'Ranije evidentirano', iznos: String(stariIznos) });
          }
        }
        const vecUplaceno = uplate.reduce((zbir, stavka) => zbir + procitajNovcaniIznos(stavka.iznos), 0);
        const cena = procitajNovcaniIznos(podaci.cena ?? '0');
        if (cena <= 0) throw new Error('Prvo unesi cenu radnog naloga.');
        if (Math.round((vecUplaceno + iznos - cena) * 100) > 0) {
          throw new Error('Uplata ne može biti veća od preostalog duga.');
        }
        uplate.push(novaUplata);
        const uplaceno = String(Math.round((vecUplaceno + iznos) * 100) / 100);
        transakcija.update(referenca, { uplate, uplaceno });
        return { uplate, uplaceno };
      });
      setNalozi((prethodni) => prethodni.map((stavka) =>
        stavka.id === nalog.id ? { ...stavka, ...osvezen } : stavka
      ));
      setNalogZaUplatu(null);
      setIznosNoveUplate('');
    } catch (error) {
      console.error(error);
      prikaziGresku(error instanceof Error ? error.message : 'Nije uspelo dodavanje uplate.');
    } finally {
      setObrada(false);
    }
  };
  // Ucitavanje naloga iz Firebase baze
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
            setGreska('Nije uspelo učitavanje radnih naloga.');
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
  const prikaziGresku = (poruka: string) => {
    if (Platform.OS === 'web') {
      window.alert(poruka);
    } else {
      Alert.alert('Greška', poruka);
    }
  };
  // NOVO: PDF za musteriju ili interni PDF
  const preuzmiPdf = async (
    nalog: RadniNalog,
    tip: TipPdf
  ) => {
    // Browser prozor otvaramo odmah da ne bude blokiran kao pop-up.

    const prozor = Platform.OS === 'web' ? window.open('', '_blank') : null;
    if (Platform.OS === 'web') {

      if (!prozor) {

        window.alert('Browser je blokirao novi prozor. Dozvoli pop-up prozore za ovu aplikaciju.');

        return;

      }

      prozor.document.title = 'Učitavanje PDF-a...';

      prozor.document.body.textContent = 'Učitavanje podataka majstora...';

    }
    try {
      const profil = await ucitajFirebaseProfil();
      if (prozor?.closed) return;
      const interni = tip === 'interni';
      const cena = procitajIznos(nalog.cena);
      const trosak = procitajIznos(
        nalog.trosakMaterijala ?? '0'
      );
      const zarada = cena - trosak;
      const polje = (naziv: string, vrednost: string) => `
        <div class="field">
          <div class="label">${escapeHtml(naziv)}</div>
          <div class="value">
            ${escapeHtml(vrednost || 'Nije uneto')}
          </div>
        </div>
      `;
      const podaciMajstora = `
        <div class="section-title">PODACI O MAJSTORU</div>
        ${polje('Ime i prezime', profil.ime)}
        ${profil.firma ? polje('Firma / radionica', profil.firma) : ''}
        ${profil.telefon ? polje('Telefon', profil.telefon) : ''}
        ${profil.adresa ? polje('Adresa', profil.adresa) : ''}
        ${profil.usluga ? polje('Vrsta usluge', profil.usluga) : ''}
      `;
      // Samo interni PDF sadrzi troskove i zaradu
      const finansijskiObracun = interni
        ? `
          <div class="section-title">
            INTERNI FINANSIJSKI OBRAČUN
          </div>
          <div class="finance-box">
            <div class="finance-row">
              <span>Dogovorena cena</span>
              <strong>${escapeHtml(formatirajNovac(cena))}</strong>
            </div>
            <div class="finance-row">
              <span>Trošak materijala</span>
              <strong class="expense">
                ${escapeHtml(formatirajNovac(trosak))}
              </strong>
            </div>
            <div class="finance-divider"></div>
            <div class="finance-row">
              <strong>Zarada nakon materijala</strong>
              <strong class="${zarada < 0 ? 'negative' : 'profit'}">
                ${escapeHtml(formatirajNovac(zarada))}
              </strong>
            </div>
          </div>
          <p class="internal-note">
            Interni dokument. Zarada je obračunata nakon
            troškova materijala, bez ostalih troškova i poreza.
          </p>
        `
        : '';
      const html = `
        <!DOCTYPE html>
        <html lang="sr">
        <head>
          <meta charset="UTF-8" />
          <title>
            ${interni ? 'Interni nalog' : 'Radni nalog'} -
            ${escapeHtml(nalog.ime)}
          </title>
          <style>
            * {
              box-sizing: border-box;
            }
            body {
              font-family: Arial, sans-serif;
              color: #172554;
              margin: 0;
              padding: 36px;
              background: white;
            }
            .header {
              display: flex;
              justify-content: space-between;
              align-items: flex-start;
              border-bottom: 3px solid #2563EB;
              padding-bottom: 20px;
              margin-bottom: 30px;
            }
            .brand {
              font-size: 29px;
              font-weight: 800;
            }
            .brand span {
              color: #2563EB;
            }
            .document-title {
              text-align: right;
              font-size: 18px;
              font-weight: 700;
            }
            .subtitle {
              font-size: 12px;
              color: #64748B;
              margin-top: 7px;
            }
            .section-title {
              font-size: 15px;
              font-weight: 700;
              margin: 26px 0 14px;
              padding-bottom: 8px;
              border-bottom: 1px solid #E2E8F0;
            }
            .field {
              margin-bottom: 16px;
              break-inside: avoid;
            }
            .label {
              font-size: 11px;
              font-weight: 700;
              color: #64748B;
              margin-bottom: 5px;
            }
            .value {
              font-size: 14px;
              color: #172554;
              white-space: pre-wrap;
              overflow-wrap: anywhere;
            }
            .price-box {
              margin-top: 30px;
              background: #EFF6FF;
              padding: 20px;
              border-radius: 12px;
              display: flex;
              justify-content: space-between;
              align-items: center;
              gap: 12px;
              break-inside: avoid;
            }
            .price-label {
              font-size: 15px;
              font-weight: 700;
            }
            .price {
              font-size: 22px;
              font-weight: 800;
              color: #2563EB;
              overflow-wrap: anywhere;
            }
            /* NOVO: Interni finansijski obracun */
            .finance-box {
              background: #F8FAFC;
              border: 1px solid #E2E8F0;
              border-radius: 12px;
              padding: 20px;
              break-inside: avoid;
            }
            .finance-row {
              display: flex;
              justify-content: space-between;
              align-items: center;
              gap: 15px;
              margin-bottom: 14px;
              font-size: 14px;
            }
            .finance-row:last-child {
              margin-bottom: 0;
            }
            .finance-divider {
              height: 1px;
              background: #CBD5E1;
              margin: 18px 0;
            }
            .expense {
              color: #C2410C;
            }
            .profit {
              color: #15803D;
              font-size: 17px;
            }
            .negative {
              color: #DC2626;
              font-size: 17px;
            }
            .internal-note {
              color: #64748B;
              font-size: 11px;
              line-height: 18px;
              margin-top: 12px;
            }
            .footer {
              margin-top: 55px;
              border-top: 1px solid #E2E8F0;
              padding-top: 14px;
              color: #94A3B8;
              font-size: 11px;
              text-align: center;
            }
            .print-button {
              background: #2563EB;
              color: white;
              border: none;
              border-radius: 9px;
              padding: 12px 20px;
              font-size: 14px;
              font-weight: bold;
              cursor: pointer;
              margin-bottom: 24px;
            }
            @media print {
              body {
                padding: 12mm;
              }
              .print-button {
                display: none;
              }
              @page {
                size: A4;
                margin: 10mm;
              }
            }
          </style>
        </head>
        <body>
          <button
            class="print-button"
            onclick="window.print()"
          >
            Sačuvaj ili odštampaj PDF
          </button>
          <div class="header">
            <div>
              <div class="brand">
                Majstor<span>Mate</span>
              </div>
              <div class="subtitle">
                Tvoj digitalni pomoćnik
              </div>
            </div>
            <div>
              <div class="document-title">
                ${interni ? 'INTERNI RADNI NALOG' : 'RADNI NALOG'}
              </div>
              <div class="subtitle">
                Broj: ${escapeHtml(nalog.id)}
              </div>
            </div>
          </div>
          ${podaciMajstora}
          <div class="section-title">
            PODACI O MUŠTERIJI
          </div>
          ${polje('Ime i prezime', nalog.ime)}
          ${polje('Telefon', nalog.telefon)}
            ${nalog.adresa?.trim() ? polje('Adresa mušterije', nalog.adresa) : ''}
          <div class="section-title">
            DETALJI POSLA
          </div>
          ${polje('Opis posla', nalog.opis)}
          ${polje('Datum', nalog.datum)}
          ${polje('Vreme', nalog.vreme)}
          ${polje('Status', nalog.status || 'Zakazan')}
          <div class="price-box">
            <span class="price-label">
              Ukupna cena
            </span>
            <span class="price">
              ${escapeHtml(nalog.cena || 'Nije uneta')}
              ${nalog.cena ? ' RSD' : ''}
            </span>
          </div>
          ${finansijskiObracun}
          <div class="footer">
            MajstorMate · Tvoj digitalni pomoćnik
            ${interni ? ' · Interni dokument' : ''}
          </div>
        </body>
        </html>
      `;
      if (Platform.OS === 'web') {

        if (!prozor || prozor.closed) return;

        prozor.document.open();

        prozor.document.write(html);

        prozor.document.close();

      } else {

        // Expo Print pravi PDF lokalno, a Sharing otvara iOS/Android meni za deljenje.

        const Print = await import('expo-print');

        const Sharing = await import('expo-sharing');

        const htmlZaTelefon = html.replace(/<button\b[^>]*>[\s\S]*?<\/button>/i, '');

        const { uri } = await Print.printToFileAsync({ html: htmlZaTelefon });

        if (await Sharing.isAvailableAsync()) {

          await Sharing.shareAsync(uri, {

            mimeType: 'application/pdf',

            UTI: 'com.adobe.pdf',

            dialogTitle: tip === 'interni' ? 'Podeli interni PDF' : 'Podeli PDF za mušteriju',

          });

        } else {

          Alert.alert('PDF je napravljen', 'Deljenje fajlova nije dostupno na ovom uređaju.');

        }

      }

    } catch (error) {
      console.error(error);
    if (prozor && !prozor.closed) {

  prozor.close();

}

      prikaziGresku(
        'Nije uspelo pravljenje PDF-a. Proveri internet i pokušaj ponovo.'
      );
    }
  };
  // Promena statusa u Firebase bazi
  const promeniStatus = async (
    id: string,
    noviStatus: StatusNaloga
  ) => {
    if (obrada) return;
    try {
      setObrada(true);
      await promeniFirebaseStatus(id, noviStatus);
      setNalozi((prethodni) =>
        prethodni.map((nalog) =>
          nalog.id === id
            ? { ...nalog, status: noviStatus }
            : nalog
        )
      );
    } catch (error) {
      console.error(error);
      prikaziGresku(
        'Došlo je do greške prilikom promene statusa.'
      );
    } finally {
      setObrada(false);
    }
  };
  // Brisanje naloga iz Firebase baze
  const potvrdiBrisanje = (nalog: RadniNalog) => {
    if (obrada) return;
    const obrisi = async () => {
      try {
        setObrada(true);
        await obrisiFirebaseNalog(nalog.id);
        setNalozi((prethodni) =>
          prethodni.filter(
            (stavka) => stavka.id !== nalog.id
          )
        );
      } catch (error) {
        console.error(error);
        prikaziGresku(
          'Došlo je do greške prilikom brisanja.'
        );
      } finally {
        setObrada(false);
      }
    };
    if (Platform.OS === 'web') {
      const potvrda = window.confirm(
        `Da li sigurno želiš da obrišeš radni nalog za ${nalog.ime}?`
      );
      if (potvrda) {
        void obrisi();
      }
    } else {
      Alert.alert(
        'Brisanje radnog naloga',
        `Da li sigurno želiš da obrišeš nalog za ${nalog.ime}?`,
        [
          {
            text: 'Odustani',
            style: 'cancel',
          },
          {
            text: 'Obriši',
            style: 'destructive',
            onPress: () => {
              void obrisi();
            },
          },
        ]
      );
    }
  };
  // Pozivanje musterije iz radnog naloga
  const pozoviMusteriju = async (telefon: string) => {
    const broj = telefon.trim().replace(/[\s()\-]/g, '');
    if (!broj || !/^\+?\d+$/.test(broj)) {
      prikaziGresku('Broj telefona nije unet ili nije ispravan.');
      return;
    }

    try {
      await Linking.openURL(`tel:${broj}`);
    } catch (error) {
      console.error(error);
      prikaziGresku('Nije uspelo otvaranje aplikacije za pozivanje.');
    }
  };

  // Korak 61: otvaranje razgovora sa musterijom
  const brojZaPoruke = (telefon: string): string | null => {
    const broj = telefon.replace(/[^\d+]/g, '');
    if (!/^\+?\d+$/.test(broj)) return null;

    let cifre = broj.replace(/^\+/, '');
    if (cifre.startsWith('00')) cifre = cifre.slice(2);
    else if (cifre.startsWith('0')) cifre = `381${cifre.slice(1)}`;

    return /^\d{8,15}$/.test(cifre) ? cifre : null;
  };

  const otvoriPoruke = async (telefon: string, aplikacija: 'WhatsApp' | 'Viber') => {
    const broj = brojZaPoruke(telefon);
    if (!broj) {
      prikaziGresku('Unesi ispravan broj telefona mušterije.');
      return;
    }

    const url = aplikacija === 'WhatsApp'
      ? `https://wa.me/${broj}`
      : `viber://chat?number=${encodeURIComponent(`+${broj}`)}`;

    try {
      await Linking.openURL(url);
    } catch (error) {
      console.error(error);
      prikaziGresku(
        aplikacija === 'Viber'
          ? 'Viber nije dostupan ili uređaj ne podržava otvaranje razgovora.'
          : 'Nije uspelo otvaranje WhatsApp razgovora.'
      );
    }
  };

  // Google Maps navigacija do adrese sa radnog naloga
  const otvoriNavigaciju = async (adresa: string) => {
    const odrediste = adresa.trim();
    if (!odrediste) {
      prikaziGresku('Adresa mušterije nije uneta.');
      return;
    }
    const url = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(odrediste)}&travelmode=driving`;
    try {
      await Linking.openURL(url);
    } catch (error) {
      console.error(error);
      prikaziGresku('Nije uspelo otvaranje Google Maps navigacije.');
    }
  };
  // Korak 63.91: izbor PRE/POSLE, galerija i slanje fotografije.
  const izaberiFotografiju = (nalog: RadniNalog) => {
    if (slanjeFotografije) return;

    const odaberiIzGalerije = async (tip: 'pre' | 'posle') => {
      try {
        const rezultat = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['images'],
          allowsEditing: false,
          quality: 0.8,
          selectionLimit: 1,
        });

        if (rezultat.canceled || !rezultat.assets?.length) return;

        const fotografija = rezultat.assets[0];
        const oznaka = tip === 'pre' ? 'PRE radova' : 'POSLE radova';
        const potvrda = `Poslati fotografiju ${oznaka} za nalog: ${nalog.ime}?`;

        const posalji = async () => {
          try {
            setSlanjeFotografije(true);
            await posaljiFotografijuNaloga(
              nalog.id,
              tip,
              fotografija.uri,
              fotografija.mimeType ?? 'image/jpeg'
            );
            const poruka = `Fotografija ${oznaka} uspešno je sačuvana uz nalog za ${nalog.ime}.`;
            if (Platform.OS === 'web') window.alert(poruka);
            else Alert.alert('✅ Fotografija sačuvana!', poruka);
          } catch (error) {
            console.error('Slanje fotografije nije uspelo:', error);
            prikaziGresku(
              error instanceof Error ? error.message : 'Nije uspelo slanje fotografije.'
            );
          } finally {
            setSlanjeFotografije(false);
          }
        };

        if (Platform.OS === 'web') {
          if (window.confirm(potvrda)) void posalji();
        } else {
          Alert.alert('Potvrdi slanje', potvrda, [
            { text: 'Odustani', style: 'cancel' },
            { text: 'Pošalji', onPress: () => void posalji() },
          ]);
        }
      } catch (error) {
        console.error('Greška pri izboru fotografije:', error);
        prikaziGresku('Nije uspelo otvaranje galerije.');
      }
    };

    if (Platform.OS === 'web') {
      const izbor = window.prompt('Tip fotografije: unesi PRE ili POSLE');
      if (!izbor) return;
      const tip = izbor.trim().toLowerCase();
      if (tip !== 'pre' && tip !== 'posle') {
        prikaziGresku('Unesi PRE ili POSLE.');
        return;
      }
      void odaberiIzGalerije(tip);
    } else {
      Alert.alert('📸 Fotografije PRE/POSLE', `Nalog: ${nalog.ime}\nIzaberi tip fotografije:`, [
        { text: 'Otkaži', style: 'cancel' },
        { text: 'PRE radova', onPress: () => void odaberiIzGalerije('pre') },
        { text: 'POSLE radova', onPress: () => void odaberiIzGalerije('posle') },
      ]);
    }
  };

  const izmeniNalog = (nalog: RadniNalog) => {
    router.push({
      pathname: '/novi-nalog',
      params: { id: nalog.id },
    });
  };
  // Korak 62: Novi nalog za istu musteriju, bez kopiranja starog posla i uplata.
  const duplirajNalog = (nalog: RadniNalog) => {
    router.push({
      pathname: '/novi-nalog',
      params: { kopijaId: nalog.id },
    });
  };
  // Pretvara datum DD.MM.GGGG u broj za sortiranje
  const datumZaSortiranje = (datum: string): number => {
    const delovi = datum.trim().split('.');
    if (delovi.length < 3) {
      return 0;
    }
    const dan = Number(delovi[0]);
    const mesec = Number(delovi[1]);
    const godina = Number(delovi[2]);
    if (
      !Number.isInteger(dan) ||
      !Number.isInteger(mesec) ||
      !Number.isInteger(godina) ||
      dan < 1 ||
      dan > 31 ||
      mesec < 1 ||
      mesec > 12
    ) {
      return 0;
    }
    return godina * 10000 + mesec * 100 + dan;
  };
  // Pretraga, filtriranje i sortiranje
  const filtriraniNalozi = nalozi
    .filter((nalog) => {
      const tekst = pretraga.trim().toLowerCase();
      const odgovaraPretrazi =
        nalog.ime.toLowerCase().includes(tekst) ||
        nalog.telefon.toLowerCase().includes(tekst) ||
          (nalog.adresa ?? '').toLowerCase().includes(tekst) ||
        nalog.opis.toLowerCase().includes(tekst);
      const odgovaraStatusu =
        filterStatus === 'Svi' ||
        (nalog.status || 'Zakazan') === filterStatus;
      return odgovaraPretrazi && odgovaraStatusu;
    })
    .sort((a, b) => {
      const datumA = datumZaSortiranje(a.datum);
      const datumB = datumZaSortiranje(b.datum);
      if (sortiranje === 'Najnoviji prvo') {
        return datumB - datumA;
      }
      return datumA - datumB;
    });
  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
    >
      <Text style={styles.title}>
        Radni nalozi
      </Text>
      <Text style={styles.subtitle}>
        Pregled svih sačuvanih poslova.
      </Text>
      {/* PRETRAGA I FILTERI */}
      <View style={styles.filterCard}>
        <Text style={styles.filterTitle}>
          🔎 Pretraži radne naloge
        </Text>
        <TextInput
          style={styles.searchInput}
          placeholder="Ime, telefon ili opis posla..."
          placeholderTextColor="#94A3B8"
          value={pretraga}
          onChangeText={setPretraga}
        />
        <Text style={styles.filterLabel}>
          Filtriraj po statusu
        </Text>
        <View style={styles.filterButtons}>
          {(
            [
              'Svi',
              'Zakazan',
              'U toku',
              'Završen',
            ] as FilterStatus[]
          ).map((status) => (
            <Pressable
              key={status}
              style={[
                styles.filterButton,
                filterStatus === status &&
                  styles.activeFilterButton,
              ]}
              onPress={() => setFilterStatus(status)}
            >
              <Text
                style={[
                  styles.filterButtonText,
                  filterStatus === status &&
                    styles.activeFilterButtonText,
                ]}
              >
                {status}
              </Text>
            </Pressable>
          ))}
        </View>
        <Text style={styles.filterLabel}>
          Sortiranje po datumu
        </Text>
        <View style={styles.filterButtons}>
          {(
            [
              'Najnoviji prvo',
              'Najstariji prvo',
            ] as Sortiranje[]
          ).map((opcija) => (
            <Pressable
              key={opcija}
              style={[
                styles.filterButton,
                sortiranje === opcija &&
                  styles.activeFilterButton,
              ]}
              onPress={() => setSortiranje(opcija)}
            >
              <Text
                style={[
                  styles.filterButtonText,
                  sortiranje === opcija &&
                    styles.activeFilterButtonText,
                ]}
              >
                {opcija}
              </Text>
            </Pressable>
          ))}
        </View>
        <Text style={styles.resultsText}>
          Prikazano {filtriraniNalozi.length} od{' '}
          {nalozi.length} radnih naloga
        </Text>
      </View>
      {/* UCITAVANJE */}
      {ucitavanje ? (
        <View style={styles.card}>
          <ActivityIndicator
            size="large"
            color="#2563EB"
          />
          <Text style={styles.empty}>
            Učitavanje radnih naloga...
          </Text>
        </View>
      ) : greska ? (
        <View style={styles.card}>
          <Text style={styles.errorText}>
            {greska}
          </Text>
        </View>
      ) : nalozi.length === 0 ? (
        <View style={styles.card}>
          <Text style={styles.empty}>
            Još nema sačuvanih radnih naloga.
          </Text>
        </View>
      ) : filtriraniNalozi.length === 0 ? (
        <View style={styles.card}>
          <Text style={styles.empty}>
            Nema naloga koji odgovaraju tvojoj pretrazi.
          </Text>
        </View>
      ) : (
        filtriraniNalozi.map((nalog) => {
          const status = nalog.status || 'Zakazan';
          // Evidencija naplate za ovaj radni nalog
          const naplata = izracunajNaplatu(nalog);
          const bojaNaplate =
            naplata.statusNaplate === 'Plaćeno'
              ? '#15803D'
              : naplata.statusNaplate === 'Delimično plaćeno'
              ? '#B45309'
              : '#DC2626';
          const pozadinaNaplate =
            naplata.statusNaplate === 'Plaćeno'
              ? '#DCFCE7'
              : naplata.statusNaplate === 'Delimično plaćeno'
              ? '#FEF3C7'
              : '#FEE2E2';
          return (
            <View key={nalog.id} style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.name}>
                  {nalog.ime}
                </Text>
                <View
                  style={[
                    styles.statusBadge,
                    status === 'Zakazan'
                      ? styles.zakazanBadge
                      : status === 'U toku'
                      ? styles.uTokuBadge
                      : styles.zavrsenBadge,
                  ]}
                >
                  <Text
                    style={[
                      styles.statusText,
                      status === 'Zakazan'
                        ? styles.zakazanText
                        : status === 'U toku'
                        ? styles.uTokuText
                        : styles.zavrsenText,
                    ]}
                  >
                    {status}
                  </Text>
                </View>
              </View>
              <Text style={styles.description}>
                {nalog.opis}
              </Text>
              <Text style={styles.details}>
                📞 {nalog.telefon || 'Telefon nije unet'}
              </Text>
              {Boolean(nalog.telefon?.trim()) && (
                <View style={styles.contactActions}>
                <Pressable
                  style={styles.callButton}
                  onPress={() => void pozoviMusteriju(nalog.telefon)}
                  accessibilityRole="button"
                  accessibilityLabel={`Pozovi mušteriju ${nalog.ime}`}
                >
                  <Text style={styles.callButtonText}>📞 Pozovi mušteriju</Text>
                </Pressable>
                <View style={styles.messageActions}>
                  <Pressable
                    style={styles.whatsappButton}
                    onPress={() => void otvoriPoruke(nalog.telefon, 'WhatsApp')}
                    accessibilityRole="button"
                    accessibilityLabel={`WhatsApp poruka za ${nalog.ime}`}
                  >
                    <Text style={styles.whatsappButtonText}>💬 WhatsApp</Text>
                  </Pressable>
                  <Pressable
                    style={styles.viberButton}
                    onPress={() => void otvoriPoruke(nalog.telefon, 'Viber')}
                    accessibilityRole="button"
                    accessibilityLabel={`Viber poruka za ${nalog.ime}`}
                  >
                    <Text style={styles.viberButtonText}>📱 Viber</Text>
                  </Pressable>
                </View>
                </View>
              )}
              <Text style={styles.details}>
                📅 {nalog.datum || 'Datum nije unet'}
                {nalog.vreme ? ` · ${nalog.vreme}` : ''}
              </Text>
                {Boolean(nalog.adresa?.trim()) && (
                  <View style={styles.addressSection}>
                    <Text style={styles.details}>📍 {nalog.adresa}</Text>
                    <Pressable
                      style={styles.navigationButton}
                      onPress={() => void otvoriNavigaciju(nalog.adresa ?? '')}
                    >
                      <Text style={styles.navigationButtonText}>🗺️ Otvori navigaciju</Text>
                    </Pressable>
                  </View>
                )}
              <Text style={styles.price}>
                {nalog.cena
                  ? `${nalog.cena} RSD`
                  : 'Cena nije uneta'}
              </Text>
                {/* NOVO: Status i pregled naplate */}
                <View style={styles.paymentCard}>
                  <View style={styles.paymentHeader}>
                    <Text style={styles.paymentTitle}>
                      💳 Naplata
                    </Text>
                    <View
                      style={[
                        styles.paymentBadge,
                        { backgroundColor: pozadinaNaplate },
                      ]}
                    >
                      <Text
                        style={[
                          styles.paymentBadgeText,
                          { color: bojaNaplate },
                        ]}
                      >
                        {naplata.statusNaplate}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.paymentRow}>
                    <Text style={styles.paymentLabel}>
                      Uplaćeno
                    </Text>
                    <Text style={styles.paymentValue}>
                      {formatirajNovac(naplata.uplaceno)}
                    </Text>
                  </View>
                  <View style={styles.paymentRow}>
                    <Text style={styles.paymentLabel}>
                      Preostalo za naplatu
                    </Text>
                    <Text
                      style={[
                        styles.paymentRemaining,
                        naplata.preostalo === 0 &&
                          styles.paymentSettled,
                      ]}
                    >
                      {formatirajNovac(naplata.preostalo)}
                    </Text>
                  </View>
                  <View style={styles.paymentHistory}>
                    <Text style={styles.paymentHistoryTitle}>Istorija uplata</Text>
                    {Array.isArray(nalog.uplate) && nalog.uplate.length > 0 ? (
                      nalog.uplate.map((uplata) => (
                        <View key={uplata.id} style={styles.paymentRow}>
                          <Text style={styles.paymentLabel}>{uplata.datum}</Text>
                          <Text style={styles.paymentValue}>
                            {formatirajNovac(procitajNovcaniIznos(uplata.iznos))}
                          </Text>
                        </View>
                      ))
                    ) : procitajNovcaniIznos(nalog.uplaceno ?? '0') > 0 ? (
                      <Text style={styles.paymentHint}>
                        Ranije evidentirano: {formatirajNovac(procitajNovcaniIznos(nalog.uplaceno ?? '0'))}
                      </Text>
                    ) : (
                      <Text style={styles.paymentHint}>Još nema evidentiranih uplata.</Text>
                    )}
                  </View>
                  {nalogZaUplatu === nalog.id ? (
                    <View style={styles.newPaymentForm}>
                      <Text style={styles.filterLabel}>Iznos nove uplate (RSD)</Text>
                      <TextInput
                        style={styles.paymentInput}
                        keyboardType="decimal-pad"
                        placeholder="Npr. 3000"
                        value={iznosNoveUplate}
                        onChangeText={setIznosNoveUplate}
                        editable={!obrada}
                      />
                      <Text style={styles.filterLabel}>Datum uplate (DD.MM.GGGG.)</Text>
                      <TextInput
                        style={styles.paymentInput}
                        placeholder="10.10.2026."
                        value={datumNoveUplate}
                        onChangeText={setDatumNoveUplate}
                        editable={!obrada}
                      />
                      <View style={styles.paymentFormActions}>
                        <Pressable
                          style={styles.savePaymentButton}
                          disabled={obrada}
                          onPress={() => void dodajUplatu(nalog)}
                        >
                          <Text style={styles.savePaymentButtonText}>
                            {obrada ? 'Čuvanje...' : 'Sačuvaj uplatu'}
                          </Text>
                        </Pressable>
                        <Pressable
                          style={styles.cancelPaymentButton}
                          disabled={obrada}
                          onPress={() => setNalogZaUplatu(null)}
                        >
                          <Text style={styles.paymentValue}>Otkaži</Text>
                        </Pressable>
                      </View>
                    </View>
                  ) : naplata.preostalo > 0 && naplata.cena > 0 ? (
                    <Pressable
                      style={styles.addPaymentButton}
                      disabled={obrada}
                      onPress={() => {
                        setNalogZaUplatu(nalog.id);
                        setIznosNoveUplate('');
                      }}
                    >
                      <Text style={styles.addPaymentButtonText}>+ Dodaj uplatu</Text>
                    </Pressable>
                  ) : null}
                  {!nalog.cena.trim() && (
                    <Text style={styles.paymentHint}>
                      Cena nije uneta — naplata se ne može konačno utvrditi.
                    </Text>
                  )}
                </View>
              <Text style={styles.statusLabel}>
                Status posla
              </Text>
              <View style={styles.statusActions}>
                {(
                  [
                    'Zakazan',
                    'U toku',
                    'Završen',
                  ] as StatusNaloga[]
                ).map((opcija) => (
                  <Pressable
                    key={opcija}
                    disabled={obrada}
                    style={[
                      styles.statusButton,
                      status === opcija &&
                        styles.activeStatusButton,
                    ]}
                    onPress={() =>
                      void promeniStatus(nalog.id, opcija)
                    }
                  >
                    <Text
                      style={[
                        styles.statusButtonText,
                        status === opcija &&
                          styles.activeStatusButtonText,
                      ]}
                    >
                      {opcija}
                    </Text>
                  </Pressable>
                ))}
              </View>
              <View style={styles.actions}>
                <Pressable
                  style={{
                    backgroundColor: '#DBEAFE',
                    borderRadius: 9,
                    paddingHorizontal: 14,
                    paddingVertical: 10,
                  }}
                  disabled={slanjeFotografije}
                  onPress={() =>
                    router.push({
                      pathname: '/fotografije',
                      params: { nalogId: nalog.id },
                    })
                  }
                >
                  <Text
                    style={{
                      color: '#1D4ED8',
                      fontSize: 12,
                      fontWeight: '700',
                    }}
                  >
                    📸 Fotografije PRE/POSLE
                  </Text>
                </Pressable>
                <Pressable
                  style={{
                    backgroundColor: '#DCFCE7',
                    borderRadius: 9,
                    paddingHorizontal: 14,
                    paddingVertical: 10,
                  }}
                  disabled={slanjeFotografije}
                  onPress={() => izaberiFotografiju(nalog)}
                >
                  <Text
                    style={{
                      color: '#15803D',
                      fontSize: 12,
                      fontWeight: '700',
                    }}
                  >
                    {slanjeFotografije ? '⏳ Slanje fotografije...' : '➕ Dodaj fotografiju'}
                  </Text>
                </Pressable>
                <Pressable
                  style={styles.editButton}
                  onPress={() => izmeniNalog(nalog)}
                >
                  <Text style={styles.editButtonText}>
                    ✏️ Izmeni nalog
                  </Text>
                </Pressable>
                <Pressable
                  style={styles.duplicateButton}
                  onPress={() => duplirajNalog(nalog)}
                  accessibilityRole="button"
                  accessibilityLabel={`Dupliraj nalog za ${nalog.ime}`}
                >
                  <Text style={styles.duplicateButtonText}>
                    📋 Dupliraj nalog
                  </Text>
                </Pressable>
                {/* NOVO: PDF za musteriju */}
                <Pressable
                  style={styles.pdfButton}
                  onPress={() =>
                    void preuzmiPdf(nalog, 'musterija')
                  }
                >
                  <Text style={styles.pdfButtonText}>
                    📄 PDF za mušteriju
                  </Text>
                </Pressable>
                {/* NOVO: Interni PDF */}
                <Pressable
                  style={styles.internalPdfButton}
                  onPress={() =>
                    void preuzmiPdf(nalog, 'interni')
                  }
                >
                  <Text style={styles.internalPdfButtonText}>
                    🔒 Interni PDF
                  </Text>
                </Pressable>
                <Pressable
                  style={styles.deleteButton}
                  disabled={obrada}
                  onPress={() => potvrdiBrisanje(nalog)}
                >
                  <Text style={styles.deleteButtonText}>
                    🗑 Obriši nalog
                  </Text>
                </Pressable>
              </View>
            </View>
          );
        })
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
  filterCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E8EDF5',
    marginBottom: 24,
  },
  filterTitle: {
    color: '#172554',
    fontSize: 17,
    fontWeight: '800',
    marginBottom: 15,
  },
  searchInput: {
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
  filterLabel: {
    color: '#334155',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 10,
  },
  filterButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 20,
  },
  filterButton: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 9,
    paddingHorizontal: 13,
    paddingVertical: 10,
  },
  activeFilterButton: {
    backgroundColor: '#2563EB',
    borderColor: '#2563EB',
  },
  filterButtonText: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: '700',
  },
  activeFilterButtonText: {
    color: '#FFFFFF',
  },
  resultsText: {
    color: '#64748B',
    fontSize: 12,
    marginTop: 2,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E8EDF5',
    marginBottom: 14,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 10,
  },
  name: {
    color: '#172554',
    fontSize: 17,
    fontWeight: '800',
  },
  description: {
    color: '#475569',
    fontSize: 14,
    marginBottom: 15,
  },
  details: {
    color: '#64748B',
    fontSize: 13,
    marginBottom: 9,
  },
  callButton: {
    backgroundColor: '#DCFCE7',
    borderRadius: 9,
    paddingHorizontal: 14,
    paddingVertical: 10,
    alignSelf: 'flex-start',
    marginBottom: 12,
  },
  callButtonText: {
    color: '#15803D',
    fontSize: 12,
    fontWeight: '700',
  },
  contactActions: {
    alignItems: 'flex-start',
  },
  messageActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  whatsappButton: {
    backgroundColor: '#DCFCE7',
    borderRadius: 9,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  whatsappButtonText: {
    color: '#15803D',
    fontSize: 12,
    fontWeight: '700',
  },
  viberButton: {
    backgroundColor: '#F5F3FF',
    borderRadius: 9,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  viberButtonText: {
    color: '#7C3AED',
    fontSize: 12,
    fontWeight: '700',
  },
  addressSection: {
    marginTop: 6,
    marginBottom: 8,
    alignItems: 'flex-start',
  },
  navigationButton: {
    backgroundColor: '#EFF6FF',
    borderRadius: 9,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginTop: 3,
  },
  navigationButtonText: {
    color: '#2563EB',
    fontSize: 12,
    fontWeight: '700',
  },
  price: {
    color: '#2563EB',
    fontSize: 16,
    fontWeight: '800',
    marginTop: 8,
  },
  empty: {
    color: '#64748B',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 8,
  },
  errorText: {
    color: '#DC2626',
    fontSize: 14,
    textAlign: 'center',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '700',
  },
  zakazanBadge: {
    backgroundColor: '#DBEAFE',
  },
  zakazanText: {
    color: '#1D4ED8',
  },
  uTokuBadge: {
    backgroundColor: '#FEF3C7',
  },
  uTokuText: {
    color: '#B45309',
  },
  zavrsenBadge: {
    backgroundColor: '#DCFCE7',
  },
  zavrsenText: {
    color: '#15803D',
  },
  // NOVO: Kartica za evidenciju naplate
  paymentCard: {
    backgroundColor: '#F8FAFC',
    borderColor: '#E2E8F0',
    borderWidth: 1,
    borderRadius: 12,
    padding: 15,
    marginTop: 16,
  },
  paymentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 13,
  },
  paymentTitle: {
    color: '#172554',
    fontSize: 14,
    fontWeight: '800',
  },
  paymentBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 9,
  },
  paymentBadgeText: {
    fontSize: 11,
    fontWeight: '800',
  },
  paymentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  paymentLabel: {
    color: '#64748B',
    fontSize: 12,
  },
  paymentValue: {
    color: '#172554',
    fontSize: 13,
    fontWeight: '700',
  },
  paymentRemaining: {
    color: '#DC2626',
    fontSize: 14,
    fontWeight: '800',
  },
  paymentSettled: {
    color: '#15803D',
  },
  paymentHint: {
    color: '#64748B',
    fontSize: 11,
    marginTop: 5,
  },
  paymentHistory: {
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  paymentHistoryTitle: {
    color: '#172554',
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 10,
  },
  addPaymentButton: {
    backgroundColor: '#2563EB',
    borderRadius: 9,
    padding: 12,
    alignItems: 'center',
    marginTop: 12,
  },
  addPaymentButtonText: { color: '#FFFFFF', fontWeight: '800', fontSize: 13 },
  newPaymentForm: { marginTop: 14 },
  paymentInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 9,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
    color: '#172554',
  },
  paymentFormActions: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  savePaymentButton: { backgroundColor: '#2563EB', borderRadius: 9, padding: 12 },
  savePaymentButtonText: { color: '#FFFFFF', fontWeight: '800' },
  cancelPaymentButton: { backgroundColor: '#E2E8F0', borderRadius: 9, padding: 12 },
  statusLabel: {
    color: '#334155',
    fontSize: 13,
    fontWeight: '700',
    marginTop: 22,
    marginBottom: 10,
  },
  statusActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  statusButton: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 9,
    paddingHorizontal: 13,
    paddingVertical: 9,
  },
  activeStatusButton: {
    backgroundColor: '#172554',
    borderColor: '#172554',
  },
  statusButtonText: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: '700',
  },
  activeStatusButtonText: {
    color: '#FFFFFF',
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 18,
  },
  editButton: {
    backgroundColor: '#EFF6FF',
    borderRadius: 9,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  editButtonText: {
    color: '#2563EB',
    fontSize: 12,
    fontWeight: '700',
  },
  duplicateButton: {
    backgroundColor: '#FFF7ED',
    borderRadius: 9,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  duplicateButtonText: {
    color: '#C2410C',
    fontSize: 12,
    fontWeight: '700',
  },
  pdfButton: {
    backgroundColor: '#F0FDF4',
    borderRadius: 9,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  pdfButtonText: {
    color: '#15803D',
    fontSize: 12,
    fontWeight: '700',
  },
  // NOVO: Dugme za interni PDF
  internalPdfButton: {
    backgroundColor: '#F5F3FF',
    borderRadius: 9,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  internalPdfButtonText: {
    color: '#7C3AED',
    fontSize: 12,
    fontWeight: '700',
  },
  deleteButton: {
    backgroundColor: '#FEF2F2',
    borderRadius: 9,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  deleteButtonText: {
    color: '#DC2626',
    fontSize: 12,
    fontWeight: '700',
  },
});
