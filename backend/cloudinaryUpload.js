const cloudinary = require('./cloudinary');
const { randomUUID } = require('node:crypto');

function uploadPrivatneFotografije(buffer, { uid, nalogId, tip, format }) {
  return new Promise((resolve, reject) => {
    if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
      return reject(new Error('Fotografija nije poslata.'));
    }

    if (!/^[A-Za-z0-9_-]{1,128}$/.test(uid) ||
        !/^[A-Za-z0-9]{1,128}$/.test(nalogId)) {
      return reject(new Error('Neispravan korisnik ili radni nalog.'));
    }

    if (!['pre', 'posle'].includes(tip)) {
      return reject(new Error('Neispravan tip fotografije.'));
    }

    if (!['jpg', 'png', 'webp'].includes(format)) {
      return reject(new Error('Nepodržan format fotografije.'));
    }

    const publicId = randomUUID();

    const stream = cloudinary.uploader.upload_stream(
      {
        resource_type: 'image',
        type: 'authenticated',
        folder: `majstormate/korisnici/${uid}/nalozi/${nalogId}`,
        public_id: publicId,
        overwrite: false,
        unique_filename: true,
        invalidate: true,
      },
      (error, rezultat) => {
        if (error) {
          return reject(error);
        }

        if (!rezultat || rezultat.type !== 'authenticated') {
          return reject(
            new Error('Cloudinary nije potvrdio privatni upload.')
          );
        }

        resolve({
          publicId: rezultat.public_id,
          format: rezultat.format,
          sirina: rezultat.width,
          visina: rezultat.height,
        });
      }
    );

    stream.on('error', reject);
    stream.end(buffer);
  });
}

module.exports = {
  uploadPrivatneFotografije,
};