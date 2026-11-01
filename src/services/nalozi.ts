export type StatusNaloga = 'Zakazan' | 'U toku' | 'Završen';

export type StatusNaplate =
  | 'Neplaćeno'
  | 'Delimično plaćeno'
  | 'Plaćeno';

export type Uplata = {
  id: string;
  datum: string;
  iznos: string;
};

export type RadniNalog = {
  id: string;
  ime: string;
  telefon: string;
  adresa?: string;
  opis: string;
  datum: string;
  vreme: string;
  cena: string;
  trosakMaterijala?: string;
  uplaceno?: string;
  uplate?: Uplata[];
  status?: StatusNaloga;
};

const STORAGE_KEY = 'majstormate_nalozi';

export function procitajNovcaniIznos(tekst: string): number {
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

// Ako istorija postoji, ona je izvor istine za ukupnu uplatu.
// Stari nalozi bez istorije i dalje koriste polje "uplaceno".
export function ukupnoUplaceno(nalog: RadniNalog): number {
  if (nalog.uplate !== undefined) {
    return Math.round(
      nalog.uplate.reduce(
        (zbir, uplata) => zbir + procitajNovcaniIznos(uplata.iznos),
        0
      ) * 100
    ) / 100;
  }

  return procitajNovcaniIznos(nalog.uplaceno ?? '0');
}

export function izracunajNaplatu(nalog: RadniNalog): {
  cena: number;
  uplaceno: number;
  preostalo: number;
  statusNaplate: StatusNaplate;
} {
  const cena = procitajNovcaniIznos(nalog.cena);
  const uplaceno = ukupnoUplaceno(nalog);
  const preostalo = Math.max(0, Math.round((cena - uplaceno) * 100) / 100);

  let statusNaplate: StatusNaplate = 'Neplaćeno';
  if (cena > 0 && uplaceno >= cena) {
    statusNaplate = 'Plaćeno';
  } else if (uplaceno > 0) {
    statusNaplate = 'Delimično plaćeno';
  }

  return { cena, uplaceno, preostalo, statusNaplate };
}

export function sacuvajRadniNalog(
  nalog: Omit<RadniNalog, 'id'>
): RadniNalog {
  const noviNalog: RadniNalog = {
    ...nalog,
    id: Date.now().toString(),
    trosakMaterijala: nalog.trosakMaterijala ?? '0',
    uplaceno: nalog.uplaceno ?? '0',
    status: 'Zakazan',
  };

  const postojeciNalozi = ucitajRadneNaloge();
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify([...postojeciNalozi, noviNalog])
  );
  return noviNalog;
}

export function ucitajRadneNaloge(): RadniNalog[] {
  const podaci = localStorage.getItem(STORAGE_KEY);
  if (!podaci) return [];

  try {
    const nalozi = JSON.parse(podaci) as RadniNalog[];
    return nalozi.map((nalog) => ({
      ...nalog,
      trosakMaterijala: nalog.trosakMaterijala ?? '0',
      uplaceno: nalog.uplaceno ?? '0',
      status: nalog.status || 'Zakazan',
    }));
  } catch {
    return [];
  }
}

export function obrisiRadniNalog(id: string): void {
  const postojeciNalozi = ucitajRadneNaloge();
  const preostaliNalozi = postojeciNalozi.filter(
    (nalog) => nalog.id !== id
  );
  localStorage.setItem(STORAGE_KEY, JSON.stringify(preostaliNalozi));
}

export function izmeniRadniNalog(
  id: string,
  izmenjeniPodaci: Omit<RadniNalog, 'id'>
): void {
  const postojeciNalozi = ucitajRadneNaloge();
  const azuriraniNalozi = postojeciNalozi.map((nalog) => {
    if (nalog.id === id) {
      return { ...nalog, ...izmenjeniPodaci, id: nalog.id };
    }
    return nalog;
  });
  localStorage.setItem(STORAGE_KEY, JSON.stringify(azuriraniNalozi));
}

export function promeniStatusNaloga(
  id: string,
  noviStatus: StatusNaloga
): void {
  const postojeciNalozi = ucitajRadneNaloge();
  const azuriraniNalozi = postojeciNalozi.map((nalog) => {
    if (nalog.id === id) {
      return { ...nalog, status: noviStatus };
    }
    return nalog;
  });
  localStorage.setItem(STORAGE_KEY, JSON.stringify(azuriraniNalozi));
}
