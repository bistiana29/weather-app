import FormMasuk from '../components/auth/FormMasuk'
import JudulHalaman from '../components/JudulHalaman'
import KartuAuth from '../components/layout/KartuAuth'

// Halaman masuk khusus admin; tidak ditautkan dari halaman publik dan tidak diindeks mesin pencari
export default function LoginAdmin() {
  return (
    <KartuAuth varian="admin" judul="Masuk Panel Admin" subjudul="Khusus pengelola sistem pengambilan data, model, dan notifikasi.">
      <JudulHalaman judul="Masuk Panel Admin" tanpaIndeks />
      <FormMasuk role="admin" />
    </KartuAuth>
  )
}
