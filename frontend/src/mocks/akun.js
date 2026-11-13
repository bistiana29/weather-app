// Dua akun contoh untuk mock login (fiktif)
export const AKUN_CONTOH = [
  {
    email: 'pengguna@contoh.id',
    password: 'contoh123',
    pengguna: { id: 'u-contoh-1', nama: 'Pengguna Contoh', email: 'pengguna@contoh.id', no_wa: '+6281200000000', role: 'user' },
  },
  {
    email: 'admin@contoh.id',
    password: 'contoh123',
    pengguna: { id: 'a-contoh-1', nama: 'Admin Contoh', email: 'admin@contoh.id', no_wa: null, role: 'admin' },
  },
]

// Kode OTP yang selalu diterima di mode mock
export const OTP_CONTOH = '123456'

// Token reset password contoh yang selalu diterima di mode mock
export const TOKEN_RESET_CONTOH = 'contoh'

// Token reset password yang dianggap kedaluwarsa di mode mock
export const TOKEN_KEDALUWARSA = 'kedaluwarsa'
