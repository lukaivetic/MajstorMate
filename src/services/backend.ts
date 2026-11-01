import { auth } from './firebase';

const BACKEND_URL = 'http://localhost:3001';

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
    throw new Error(
      podaci.error || 'Greška pri povezivanju sa backendom.'
    );
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
    `http://localhost:3001/api/nalozi/${encodeURIComponent(nalogId)}/provera`,
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
    throw new Error(
      podaci.error || 'Nije uspelo učitavanje fotografija.'
    );
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

  // Pravljenje male probne PNG fotografije
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