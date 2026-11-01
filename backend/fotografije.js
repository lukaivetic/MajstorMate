const DOZVOLJENI_TIPOVI = ['pre', 'posle'];

function proveriTipFotografije(tip) {
  return DOZVOLJENI_TIPOVI.includes(tip);
}

function napraviPodatkeFotografije({
  publicId,
  tip,
  format,
  sirina,
  visina,
}) {
  if (!proveriTipFotografije(tip)) {
    throw new Error('Neispravan tip fotografije.');
  }

  if (
    typeof publicId !== 'string' ||
    !/^majstormate\/[A-Za-z0-9/_-]+$/.test(publicId)
  ) {
    throw new Error('Neispravan Cloudinary public ID.');
  }

  if (
    typeof format !== 'string' ||
    !['jpg', 'jpeg', 'png', 'webp'].includes(format.toLowerCase())
  ) {
    throw new Error('Nepodržan format fotografije.');
  }

  if (
    !Number.isInteger(sirina) ||
    !Number.isInteger(visina) ||
    sirina <= 0 ||
    visina <= 0
  ) {
    throw new Error('Neispravne dimenzije fotografije.');
  }

  return {
    publicId,
    tip,
    format: format.toLowerCase(),
    sirina,
    visina,
    kreirano: new Date().toISOString(),
  };
}

async function sacuvajPodatkeFotografije(nalogRef, podaci) {
  if (!nalogRef || typeof nalogRef.collection !== 'function') {
    throw new Error('Neispravna referenca radnog naloga.');
  }

  const fotografija = napraviPodatkeFotografije(podaci);

  const referenca = await nalogRef
    .collection('fotografije')
    .add(fotografija);

  return {
    id: referenca.id,
    ...fotografija,
  };
}

module.exports = {
  proveriTipFotografije,
  napraviPodatkeFotografije,
  sacuvajPodatkeFotografije,
};