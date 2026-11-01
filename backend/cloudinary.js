require('dotenv').config();

const cloudinary = require('cloudinary').v2;

const obaveznaPolja = [
  'CLOUDINARY_CLOUD_NAME',
  'CLOUDINARY_API_KEY',
  'CLOUDINARY_API_SECRET',
];

const nedostaju = obaveznaPolja.filter(
  (polje) => !process.env[polje]
);

if (nedostaju.length > 0) {
  throw new Error(
    `Nedostaju Cloudinary podešavanja: ${nedostaju.join(', ')}`
  );
}

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

module.exports = cloudinary;