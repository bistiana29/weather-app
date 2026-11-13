// Mode mock aktif kecuali VITE_USE_MOCK=false (tanpa backend, default tetap mock)
export const PAKAI_MOCK = String(import.meta.env.VITE_USE_MOCK ?? 'true').trim().toLowerCase() !== 'false'
const API_URL = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '')
export const KUNCI_SESI = 'pce-sesi'
const LATENSI_MOCK = 600

// Kembalikan data mock setelah jeda agar skeleton terlihat
export function tundaMock(data, ms = LATENSI_MOCK) {
  return new Promise((resolve) => setTimeout(() => resolve(structuredClone(data)), ms))
}

export function tolakMock(pesan, status = 400, ms = LATENSI_MOCK) {
  return new Promise((_, reject) =>
    setTimeout(() => {
      const galat = new Error(pesan)
      galat.status = status
      reject(galat)
    }, ms),
  )
}

function bacaToken() {
  try {
    return JSON.parse(localStorage.getItem(KUNCI_SESI))?.token ?? null
  } catch {
    return null
  }
}

// Panggil backend (dipakai saat VITE_USE_MOCK=false)
export async function request(path, { method = 'GET', body } = {}) {
  const token = bacaToken()
  const respons = await fetch(`${API_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!respons.ok) {
    const data = await respons.json().catch(() => ({}))
    const galat = new Error(data.pesan ?? `Permintaan gagal (${respons.status})`)
    galat.status = respons.status
    throw galat
  }
  return respons.status === 204 ? null : respons.json()
}
