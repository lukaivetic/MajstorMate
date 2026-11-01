const multer = require('multer');

const DOZVOLJENI_FORMATI = [
  'image/jpeg',
  'image/png',
  'image/webp',
];

const uploadFotografije = multer({
  storage: multer.memoryStorage(),

  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 1,
  },

  fileFilter: (req, file, callback) => {
    if (!DOZVOLJENI_FORMATI.includes(file.mimetype)) {
      return callback(
        new Error('Dozvoljeni su samo JPG, PNG i WEBP formati.')
      );
    }

    callback(null, true);
  },
});

module.exports = uploadFotografije;