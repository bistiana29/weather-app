import { Cpu } from 'lucide-react'
import { Trans, useTranslation } from 'react-i18next'
import { useFormat } from '../../lib/format'
import Dialog from '../ui/Dialog'
import Skeleton from '../ui/Skeleton'
import GrafikPrakiraan from './GrafikPrakiraan'
import '../../styles/components/peta.css'

// Dialog grafik 48 jam (24 jam observasi + 24 jam prediksi + garis ambang) dan info model aktif
export default function DialogGrafik({ open, onOpenChange, namaKelurahan, parameter, prakiraan, memuat }) {
  const { t } = useTranslation()
  const f = useFormat()
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      lebar
      judul={t('peta.grafik.judulDialog', { kelurahan: namaKelurahan ?? '', parameter: f.parameterJudul(parameter) })}
    >
      {memuat || !prakiraan ? (
        <Skeleton height={260} radius={16} />
      ) : (
        <>
          <GrafikPrakiraan parameter={parameter} observasi={prakiraan.observasi} prediksi={prakiraan.prediksi} ambang={prakiraan.ambang} />
          <p className="panel-model">
            <Cpu size={16} aria-hidden="true" />
            <span>
              <Trans
                i18nKey="peta.panel.model"
                values={{
                  nama: prakiraan.model.nama,
                  versi: prakiraan.model.versi,
                  tanggal: f.tanggalPanjang(prakiraan.dibuat.slice(0, 10)),
                  jam: f.jam(prakiraan.dibuat.slice(11, 16)),
                }}
                components={{ tebal: <strong /> }}
              />
            </span>
          </p>
        </>
      )}
    </Dialog>
  )
}
