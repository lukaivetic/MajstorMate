const cloudinary = require('./cloudinary');

async function testirajPrivatnuSliku() {
  try {
    const rezultat = await cloudinary.uploader.upload(
      'data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=',
      {
        resource_type: 'image',
        type: 'authenticated',
        folder: 'majstormate/test',
        public_id: 'test-privatna-slika',
        overwrite: true,
      }
    );

    console.log('UPLOAD USPEŠAN');
    console.log('Tip pristupa:', rezultat.type);
    console.log('Public ID:', rezultat.public_id);
  } catch (error) {
    console.error('Greška:', error.message);
    process.exitCode = 1;
  }
}

testirajPrivatnuSliku();