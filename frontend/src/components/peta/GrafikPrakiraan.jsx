import { useReducedMotion } from 'motion/react'
import { useTranslation } from 'react-i18next'
import { CartesianGrid, ComposedChart, Line, ReferenceArea, ReferenceLine, ResponsiveContainer, Tooltip as RTooltip, XAxis, YAxis } from 'recharts'
import { useFormat } from '../../lib/format'
import { SUMBU_GRAFIK, WARNA } from '../../lib/warna'
import '../../styles/components/peta.css'

// Label sumbu waktu: nama hari pada pukul 00, selebihnya jam saja
function buatLabelWaktu(f) {
  return (waktu) => {
    const [tanggal, jam] = waktu.split('T')
    return jam === '00:00' ? `${f.hariPendek(tanggal)} ${f.jam(jam)}` : f.jam(jam)
  }
}

// Isi tooltip saat titik grafik disorot
function IsiTooltip({ active, payload, parameter, f, t }) {
  if (!active || !payload?.length) return null
  const titik = payload[0].payload
  const nilai = titik.obs ?? titik.pred
  return (
    <div className="grafik-tooltip">
      <p className="teks-sekunder">
        {buatLabelWaktu(f)(titik.waktu)} WIB · {t(titik.obs != null ? 'peta.grafik.observasi' : 'peta.grafik.prediksi')}
      </p>
      <p className="grafik-tooltip-nilai">{f.nilaiLengkap(parameter, nilai)}</p>
    </div>
  )
}

// Grafik 24 jam observasi (garis solid) + 24 jam prediksi (garis putus-putus) + garis ambang
export default function GrafikPrakiraan({ parameter, observasi, prediksi, ambang }) {
  const { t } = useTranslation()
  const f = useFormat()
  const labelWaktu = buatLabelWaktu(f)
  const kurangiGerak = useReducedMotion()
  const data = [
    ...observasi.map((titik, i) => ({
      waktu: titik.waktu,
      obs: titik.nilai,
      pred: i === observasi.length - 1 ? titik.nilai : null,
    })),
    ...prediksi.map((titik) => ({ waktu: titik.waktu, obs: null, pred: titik.nilai })),
  ]
  const semuaNilai = [...observasi, ...prediksi].map((titik) => titik.nilai)
  const atas = Math.max(...semuaNilai, ambang ?? -Infinity)
  const bawah = parameter === 'suhu' ? Math.floor(Math.min(...semuaNilai) - 1) : 0
  const domain = [bawah, Math.ceil(atas * 1.12)]
  const ticks = data.filter((titik) => Number(titik.waktu.slice(11, 13)) % 12 === 0).map((titik) => titik.waktu)
  const formatSumbuY = (v) => (parameter === 'jarak-pandang' ? f.angka(v / 1000, 1) : f.angka(v, 1))
  const satuanSumbu = parameter === 'jarak-pandang' ? t('satuan.km') : null
  const puncak = Math.max(...prediksi.map((titik) => titik.nilai))

  return (
    <figure className="grafik">
      <figcaption className="grafik-legenda">
        <span><i className="garis-observasi" aria-hidden="true" />{t('peta.grafik.observasi')}</span>
        <span><i className="garis-prediksi" aria-hidden="true" />{t('peta.grafik.prediksi')}</span>
        {ambang != null && <span><i className="garis-ambang" aria-hidden="true" />{t(`peta.grafik.ambang.${parameter}`)}</span>}
        {satuanSumbu && <span className="teks-sekunder">{t('peta.grafik.sumbuY', { satuan: satuanSumbu })}</span>}
      </figcaption>
      <div
        className="grafik-area"
        role="img"
        aria-label={t(ambang != null ? 'peta.grafik.ariaAmbang' : 'peta.grafik.aria', {
          parameter: f.parameterJudul(parameter),
          puncak: f.nilaiLengkap(parameter, puncak),
          ambang: f.nilaiLengkap(parameter, ambang),
        })}
      >
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 12, right: 8, bottom: 0, left: -8 }}>
            <CartesianGrid vertical={false} stroke={WARNA.gridGrafik} />
            <ReferenceArea x1={prediksi[0].waktu} x2={prediksi.at(-1).waktu} fill={WARNA.areaPrediksi} fillOpacity={0.55} />
            <XAxis
              dataKey="waktu"
              ticks={ticks}
              tickFormatter={labelWaktu}
              tick={SUMBU_GRAFIK}
              tickLine={false}
              axisLine={{ stroke: WARNA.garis }}
              interval={0}
            />
            <YAxis
              domain={domain}
              tickFormatter={formatSumbuY}
              tick={SUMBU_GRAFIK}
              tickLine={false}
              axisLine={false}
              width={44}
            />
            <ReferenceLine x={prediksi[0].waktu} stroke={WARNA.teksSekunder} strokeDasharray="3 3" />
            {ambang != null && (
              <ReferenceLine y={ambang} stroke={WARNA.ambang} strokeDasharray="2 4" strokeWidth={1.5} ifOverflow="extendDomain" />
            )}
            <RTooltip content={<IsiTooltip parameter={parameter} f={f} t={t} />} cursor={{ stroke: WARNA.garisKuat, strokeWidth: 1 }} />
            <Line
              dataKey="obs"
              type="monotone"
              stroke={WARNA.navy}
              strokeWidth={2}
              dot={false}
              isAnimationActive={!kurangiGerak}
              animationDuration={350}
            />
            <Line
              dataKey="pred"
              type="monotone"
              stroke={WARNA.biru}
              strokeWidth={2.5}
              strokeDasharray="6 4"
              dot={false}
              isAnimationActive={!kurangiGerak}
              animationDuration={350}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </figure>
  )
}
