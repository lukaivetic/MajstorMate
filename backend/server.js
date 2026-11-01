require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const { initializeApp, getApps, cert } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { getFirestore } = require('firebase-admin/firestore');

const serviceAccount = require('./serviceAccountKey.json');
const uploadFotografije = require('./uploadFotografije');
const { proveriFotografiju } = require('./proveraFotografije');
const { uploadPrivatneFotografije } = require('./cloudinaryUpload');
const {
  proveriTipFotografije,
  sacuvajPodatkeFotografije,
} = require('./fotografije');
const cloudinary = require('./cloudinary');

if (getApps().length === 0) {
  initializeApp({
    credential: cert(serviceAccount),
  });
}

const db = getFirestore();
const auth = getAuth();

const app = express();
const PORT = process.env.PORT || 3001;

app.disable('x-powered-by');

app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '1mb' }));

app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 100,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
  })
);

// Provera Firebase tokena
async function proveriKorisnika(req, res, next) {
  const authorization = req.headers.authorization || '';
  const match = authorization.match(/^Bearer (.+)$/i);

  if (!match) {
    return res.status(401).json({
      error: 'Nedostaje Firebase token.',
    });
  }

  try {
    const decodedToken = await auth.verifyIdToken(match[1], true);

    req.korisnik = {
      uid: decodedToken.uid,
    };

    next();
  } catch (error) {
    return res.status(401).json({
      error: 'Nevažeći ili istekao Firebase token.',
    });
  }
}

// Provera da li radni nalog pripada prijavljenom majstoru
async function proveriVlasnistvoNaloga(req, res, next) {
  const { nalogId } = req.params;

  if (
    typeof nalogId !== 'string' ||
    !/^[A-Za-z0-9]{1,128}$/.test(nalogId)
  ) {
    return res.status(400).json({
      error: 'Neispravan ID radnog naloga.',
    });
  }

  try {
    const referenca = db
      .collection('korisnici')
      .doc(req.korisnik.uid)
      .collection('nalozi')
      .doc(nalogId);

    const dokument = await referenca.get();

    if (!dokument.exists) {
      return res.status(404).json({
        error: 'Radni nalog nije pronađen.',
      });
    }

    req.nalogRef = referenca;
    next();
  } catch (error) {
    console.error('Greška pri proveri radnog naloga:', error);

    return res.status(500).json({
      error: 'Nije uspela provera radnog naloga.',
    });
  }
}

// Provera rada servera
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    message: 'MajstorMate backend radi!',
    firebase: getApps().length > 0 ? 'Povezan' : 'Nije povezan',
  });
});

// Provera prijavljenog korisnika
app.get('/api/me', proveriKorisnika, (req, res) => {
  res.json({
    status: 'OK',
    uid: req.korisnik.uid,
    message: 'Firebase korisnik je uspešno potvrđen!',
  });
});

// Zaštićena provera vlasništva nad nalogom
app.get(
  '/api/nalozi/:nalogId/provera',
  proveriKorisnika,
  proveriVlasnistvoNaloga,
  (req, res) => {
    res.json({
      status: 'OK',
      nalogId: req.params.nalogId,
      vlasnik: true,
      message: 'Radni nalog pripada prijavljenom korisniku!',
    });
  }
);

app.get(
  '/api/nalozi/:nalogId/fotografije',
  proveriKorisnika,
  proveriVlasnistvoNaloga,
  async (req, res) => {
    try {
      const snapshot = await req.nalogRef
        .collection('fotografije')
        .orderBy('kreirano', 'desc')
        .limit(50)
        .get();

      const fotografije = snapshot.docs.map((doc) => ({
        id: doc.id,
        tip: doc.data().tip,
        kreirano: doc.data().kreirano,
        sirina: doc.data().sirina,
        visina: doc.data().visina,
      }));

      return res.json({
        status: 'OK',
        nalogId: req.params.nalogId,
        fotografije,
      });
    } catch (error) {
      console.error('Greška pri učitavanju fotografija:', error);

      return res.status(500).json({
        error: 'Nije uspelo učitavanje fotografija.',
      });
    }
  }
);

app.post(
  '/api/nalozi/:nalogId/fotografije',
  proveriKorisnika,
  proveriVlasnistvoNaloga,

  (req, res, next) => {
    uploadFotografije.single('fotografija')(req, res, (error) => {
      if (error) {
        return res.status(400).json({
          error: error.message,
        });
      }

      next();
    });
  },

  async (req, res) => {
    let otpremljeniPublicId = null;

    try {
      const tip = req.body?.tip;

      if (!proveriTipFotografije(tip)) {
        return res.status(400).json({
          error: 'Tip fotografije mora biti pre ili posle.',
        });
      }

      if (!req.file?.buffer) {
        return res.status(400).json({
          error: 'Fotografija nije poslata.',
        });
      }

     const provera = await proveriFotografiju(req.file.buffer);

const rezultat = await uploadPrivatneFotografije(
  provera.buffer,
  {
    uid: req.korisnik.uid,
    nalogId: req.params.nalogId,
    tip,
    format: provera.format,
  }
);
      otpremljeniPublicId = rezultat.publicId;

      const sacuvana = await sacuvajPodatkeFotografije(
        req.nalogRef,
        {
          publicId: rezultat.publicId,
          tip,
          format: rezultat.format,
          sirina: rezultat.sirina,
          visina: rezultat.visina,
        }
      );

      return res.status(201).json({
        status: 'OK',
        fotografija: {
          id: sacuvana.id,
          tip: sacuvana.tip,
          kreirano: sacuvana.kreirano,
          sirina: sacuvana.sirina,
          visina: sacuvana.visina,
        },
      });
    } catch (error) {
      console.error('Greška pri otpremanju fotografije:', error);

      if (otpremljeniPublicId) {
        try {
          await cloudinary.uploader.destroy(otpremljeniPublicId, {
            resource_type: 'image',
            type: 'authenticated',
          });
        } catch (cleanupError) {
          console.error(
            'Nije uspelo uklanjanje neuspešno sačuvane fotografije:',
            cleanupError
          );
        }
      }

      return res.status(500).json({
        error: 'Nije uspelo otpremanje fotografije.',
      });
    }
  }
);

// Zasticeno preuzimanje fotografije
app.get(
  '/api/nalozi/:nalogId/fotografije/:fotografijaId/slika',
  proveriKorisnika,
  proveriVlasnistvoNaloga,
  async (req, res) => {
    try {
      const { fotografijaId } = req.params;

      if (!/^[A-Za-z0-9]{1,128}$/.test(fotografijaId)) {
        return res.status(400).json({
          error: 'Neispravan ID fotografije.',
        });
      }

      const dokument = await req.nalogRef
        .collection('fotografije')
        .doc(fotografijaId)
        .get();

      if (!dokument.exists) {
        return res.status(404).json({
          error: 'Fotografija nije pronadjena.',
        });
      }

      const publicId = dokument.data().publicId;

      const ocekivaniFolder =
        `majstormate/korisnici/${req.korisnik.uid}` +
        `/nalozi/${req.params.nalogId}/`;

      if (
        typeof publicId !== 'string' ||
        !publicId.startsWith(ocekivaniFolder)
      ) {
        return res.status(500).json({
          error: 'Neispravni podaci fotografije.',
        });
      }

      const url = cloudinary.url(publicId, {
        resource_type: 'image',
        type: 'authenticated',
        sign_url: true,
        secure: true,
        expires_at: Math.floor(Date.now() / 1000) + 60,
      });

      res.set('Cache-Control', 'no-store');

      return res.json({
        status: 'OK',
        url,
      });
    } catch (error) {
      console.error('Greska pri preuzimanju fotografije:', error);

      return res.status(500).json({
        error: 'Nije uspelo preuzimanje fotografije.',
      });
    }
  }
);
app.listen(PORT, '127.0.0.1', () => {
  console.log(`MajstorMate backend radi na http://localhost:${PORT}`);
});