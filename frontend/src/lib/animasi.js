// Varian motion untuk grid kartu yang muncul berurutan
export const VARIAN_GRID = {
  awal: {},
  tampil: { transition: { staggerChildren: 0.05 } },
}

export const VARIAN_KARTU = {
  awal: { opacity: 0, y: 12 },
  tampil: { opacity: 1, y: 0, transition: { duration: 0.3, ease: [0.22, 1, 0.36, 1] } },
}
