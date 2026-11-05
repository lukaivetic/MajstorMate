import { File } from 'expo-file-system';
import { Platform } from 'react-native';
import { auth } from './firebase';

const BACKEND_URL =
  Platform.OS === 'web'
    ? 'http://localhost:3001'
    : 'http://192.168.0.21:3001';

export async function proveriBackendKorisnika() {
  const korisnik = auth.currentUser;

  if (!korisnik) {
    throw new Error('Korisnik nije prijavljen.');
  }

  const token = await korisnik.getIdToken();

  const odgovor = await fetch(`${BACKEND_URL}/api/me`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const podaci = await odgovor.json();

  if (!odgovor.ok) {
    throw new Error(podaci.error || 'Greška pri povezivanju sa backendom.');
  }

  return podaci;
}

export async function proveriVlasnistvoNaloga(nalogId: string) {
  const korisnik = auth.currentUser;

  if (!korisnik) {
    throw new Error('Korisnik nije prijavljen.');
  }

  const token = await korisnik.getIdToken();

  const odgovor = await fetch(
    `${BACKEND_URL}/api/nalozi/${encodeURIComponent(nalogId)}/provera`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  const podaci = await odgovor.json();

  if (!odgovor.ok) {
    throw new Error(podaci.error || 'Provera vlasništva nije uspela.');
  }

  return podaci;
}

export async function ucitajFotografijeNaloga(nalogId: string) {
  const korisnik = auth.currentUser;

  if (!korisnik) {
    throw new Error('Korisnik nije prijavljen.');
  }

  const token = await korisnik.getIdToken();

  const odgovor = await fetch(
    `${BACKEND_URL}/api/nalozi/${encodeURIComponent(nalogId)}/fotografije`,
    {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  const podaci = await odgovor.json();

  if (!odgovor.ok) {
    throw new Error(podaci.error || 'Nije uspelo učitavanje fotografija.');
  }

  return podaci;
}

export async function testirajUploadNepostojecegNaloga() {
  const korisnik = auth.currentUser;

  if (!korisnik) {
    throw new Error('Korisnik nije prijavljen.');
  }

  const token = await korisnik.getIdToken();

  const odgovor = await fetch(
    `${BACKEND_URL}/api/nalozi/NepostojeciNalog123/fotografije`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  const podaci = await odgovor.json();

  console.log('HTTP STATUS:', odgovor.status);
  console.log('ODGOVOR:', podaci);

  return odgovor.status === 404;
}

export async function testirajUploadFotografije(nalogId: string) {
  const korisnik = auth.currentUser;

  if (!korisnik) {
    throw new Error('Korisnik nije prijavljen.');
  }

  const token = await korisnik.getIdToken();

  // Ovaj test se pokreće samo u web pregledaču.
  if (Platform.OS !== 'web') {
    throw new Error('Test sa canvas fotografijom dostupan je samo na webu.');
  }

  const canvas = document.createElement('canvas');
  canvas.width = 100;
  canvas.height = 100;

  const context = canvas.getContext('2d');

  if (!context) {
    throw new Error('Canvas nije dostupan.');
  }

  context.fillStyle = '#2563eb';
  context.fillRect(0, 0, 100, 100);

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (rezultat) => {
        if (rezultat) resolve(rezultat);
        else reject(new Error('Nije moguće napraviti probnu sliku.'));
      },
      'image/png'
    );
  });

  const podaci = new FormData();

  podaci.append('tip', 'pre');
  podaci.append('fotografija', blob, 'test-fotografija.png');

  const odgovor = await fetch(
    `${BACKEND_URL}/api/nalozi/${encodeURIComponent(nalogId)}/fotografije`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: podaci,
    }
  );

  const rezultat = await odgovor.json();

  console.log('UPLOAD HTTP STATUS:', odgovor.status);
  console.log('UPLOAD ODGOVOR:', rezultat);

  return {
    uspesno: odgovor.status === 201,
    status: odgovor.status,
    podaci: rezultat,
  };
}

// Pravi upload fotografije iz galerije (iPhone / Android / web).
export async function posaljiFotografijuNaloga(
  nalogId: string,
  tip: 'pre' | 'posle',
  uri: string,
  mimeType = 'image/jpeg'
) {
  const korisnik = auth.currentUser;

  if (!korisnik) {
    throw new Error('Korisnik nije prijavljen.');
  }

  if (!nalogId.trim() || !uri.trim()) {
    throw new Error('Nedostaje radni nalog ili fotografija.');
  }

  const token = await korisnik.getIdToken();
  const podaci = new FormData();
  podaci.append('tip', tip);

  if (Platform.OS === 'web') {
    const slikaOdgovor = await fetch(uri);
    if (!slikaOdgovor.ok) {
      throw new Error('Nije moguće učitati izabranu fotografiju.');
    }
    const blob = await slikaOdgovor.blob();
    podaci.append('fotografija', blob, 'fotografija.jpg');
  } else {
    // Expo SDK 58: File je podržan Blob objekat za multipart upload.
    const fotografija = new File(uri);
    podaci.append('fotografija', fotografija, `fotografija-${Date.now()}.${mimeType === 'image/png' ? 'png' : mimeType === 'image/heic' ? 'heic' : 'jpg'}`);
  }

  const odgovor = await fetch(
    `${BACKEND_URL}/api/nalozi/${encodeURIComponent(nalogId)}/fotografije`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        // Ne postavljati Content-Type ručno: fetch dodaje multipart boundary.
      },
      body: podaci,
    }
  );

  const rezultat = await odgovor.json().catch(() => null);

  if (!odgovor.ok) {
    throw new Error(
      (rezultat && typeof rezultat.error === 'string' && rezultat.error) ||
        `Slanje fotografije nije uspelo (HTTP ${odgovor.status}).`
    );
  }

  return rezultat;
}

export async function ucitajUrlFotografije(
  nalogId: string,
  fotografijaId: string
): Promise<string> {
  const korisnik = auth.currentUser;

  if (!korisnik) {
    throw new Error('Korisnik nije prijavljen.');
  }

  const token = await korisnik.getIdToken();

  const odgovor = await fetch(
    `${BACKEND_URL}/api/nalozi/${encodeURIComponent(nalogId)}/fotografije/${encodeURIComponent(fotografijaId)}/slika`,
    {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  const podaci = await odgovor.json();

  if (!odgovor.ok) {
    throw new Error(
      podaci.error || 'Nije uspelo učitavanje fotografije.'
    );
  }

  if (typeof podaci.url !== 'string' || !podaci.url) {
    throw new Error('Backend nije vratio URL fotografije.');
  }

  return podaci.url;
}

// Briše fotografiju sa naloga preko zaštićene DELETE rute.
export async function obrisiFotografiju(
  nalogId: string,
  fotografijaId: string
): Promise<void> {
  const korisnik = auth.currentUser;

  if (!korisnik) {
    throw new Error('Korisnik nije prijavljen.');
  }

  if (!nalogId.trim() || !fotografijaId.trim()) {
    throw new Error('Nedostaje radni nalog ili ID fotografije.');
  }

  const token = await korisnik.getIdToken();

  const odgovor = await fetch(
    `${BACKEND_URL}/api/nalozi/${encodeURIComponent(nalogId)}/fotografije/${encodeURIComponent(fotografijaId)}`,
    {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  const podaci = await odgovor.json().catch(() => null);

  if (!odgovor.ok) {
    throw new Error(
      (podaci && typeof podaci.error === 'string' && podaci.error) ||
        `Brisanje fotografije nije uspelo (HTTP ${odgovor.status}).`
    );
  }
}