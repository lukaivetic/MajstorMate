
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from './firebase';

export type ProfilMajstora = {
  ime: string;
  firma: string;
  telefon: string;
  adresa: string;
  usluga: string;
};

const prazanProfil: ProfilMajstora = {
  ime: '',
  firma: '',
  telefon: '',
  adresa: '',
  usluga: '',
};

// Ucitavanje profila trenutno prijavljenog korisnika
export const ucitajFirebaseProfil =
  async (): Promise<ProfilMajstora> => {
    const korisnik = auth.currentUser;

    if (!korisnik) {
      throw new Error('Korisnik nije prijavljen.');
    }

    const referenca = doc(
      db,
      'korisnici',
      korisnik.uid
    );

    const dokument = await getDoc(referenca);

    if (!dokument.exists()) {
      return { ...prazanProfil };
    }

    const podaci = dokument.data();

    return {
      ime: podaci.ime ?? '',
      firma: podaci.firma ?? '',
      telefon: podaci.telefon ?? '',
      adresa: podaci.adresa ?? '',
      usluga: podaci.usluga ?? '',
    };
  };

// Cuvanje profila trenutno prijavljenog korisnika
export const sacuvajFirebaseProfil = async (
  profil: ProfilMajstora
): Promise<void> => {
  const korisnik = auth.currentUser;

  if (!korisnik) {
    throw new Error('Korisnik nije prijavljen.');
  }

  const referenca = doc(
    db,
    'korisnici',
    korisnik.uid
  );

  await setDoc(referenca, profil, { merge: true });
};
