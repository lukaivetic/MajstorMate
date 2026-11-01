import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  setDoc,
  updateDoc,
} from 'firebase/firestore';

import { auth, db } from './firebase';
import type { RadniNalog, StatusNaloga } from './nalozi';

function putanjaNaloga() {
  const korisnik = auth.currentUser;

  if (!korisnik) {
    throw new Error('Korisnik nije prijavljen.');
  }

  return collection(db, 'korisnici', korisnik.uid, 'nalozi');
}

export async function ucitajFirebaseNaloge(): Promise<RadniNalog[]> {
  const rezultat = await getDocs(putanjaNaloga());

  return rezultat.docs.map((dokument) => {
    const podaci = dokument.data() as Omit<RadniNalog, 'id'>;

    return {
      ...podaci,
      id: dokument.id,
      status: podaci.status || 'Zakazan',
      adresa: podaci.adresa ?? '',
      trosakMaterijala: podaci.trosakMaterijala ?? '0',
      uplaceno: podaci.uplaceno ?? '0',
      ...(Array.isArray(podaci.uplate)
        ? { uplate: podaci.uplate }
        : { uplate: undefined }),
    };
  });
}

export async function sacuvajFirebaseNalog(
  nalog: Omit<RadniNalog, 'id'>
): Promise<RadniNalog> {
  const referenca = doc(putanjaNaloga());

  const noviNalog: RadniNalog = {
    ...nalog,
    id: referenca.id,
    status: 'Zakazan',
    adresa: nalog.adresa ?? '',
    trosakMaterijala: nalog.trosakMaterijala ?? '0',
    uplaceno: nalog.uplaceno ?? '0',
  };

  const { uplate, ...ostaliPodaci } = noviNalog;

  await setDoc(referenca, {
    ...ostaliPodaci,
    ...(uplate !== undefined ? { uplate } : {}),
  });

  return noviNalog;
}

export async function izmeniFirebaseNalog(
  id: string,
  podaci: Omit<RadniNalog, 'id'>
): Promise<void> {
  const referenca = doc(putanjaNaloga(), id);
  const { uplate, uplaceno, ...ostaliPodaci } = podaci;

  await updateDoc(referenca, {
    ...ostaliPodaci,
    trosakMaterijala: podaci.trosakMaterijala ?? '0',
    ...(uplaceno !== undefined ? { uplaceno } : {}),
    ...(uplate !== undefined ? { uplate } : {}),
  });
}

export async function promeniFirebaseStatus(
  id: string,
  status: StatusNaloga
): Promise<void> {
  const referenca = doc(putanjaNaloga(), id);

  await updateDoc(referenca, { status });
}

export async function obrisiFirebaseNalog(
  id: string
): Promise<void> {
  const referenca = doc(putanjaNaloga(), id);

  await deleteDoc(referenca);
}
