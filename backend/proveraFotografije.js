const sharp = require('sharp');

const DOZVOLJENI_FORMATI = [
  'image/jpeg',
  'image/png',
  'image/webp',
];

async function proveriFotografiju(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    throw new Error('Fotografija nije poslata.');
  }

  if (buffer.length > 5 * 1024 * 1024) {
    throw new Error('Fotografija ne sme biti veća od 5 MB.');
  }

  const { fileTypeFromBuffer } = await import('file-type');
  const rezultat = await fileTypeFromBuffer(buffer);

  if (!rezultat || !DOZVOLJENI_FORMATI.includes(rezultat.mime)) {
    throw new Error('Dozvoljeni su samo JPG, PNG i WEBP formati.');
  }

  try {
    const obradjena = await sharp(buffer, {
      limitInputPixels: 25_000_000,
      failOn: 'error',
      animated: false,
    })
      .rotate()
      .resize({
        width: 2000,
        height: 2000,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .jpeg({
        quality: 85,
        mozjpeg: true,
      })
      .toBuffer({ resolveWithObject: true });

    return {
      mime: 'image/jpeg',
      format: 'jpg',
      velicina: obradjena.data.length,
      sirina: obradjena.info.width,
      visina: obradjena.info.height,
      buffer: obradjena.data,
    };
  } catch {
    throw new Error('Fotografija je oštećena ili ne može da se obradi.');
  }
}

module.exports = {
  proveriFotografiju,
};