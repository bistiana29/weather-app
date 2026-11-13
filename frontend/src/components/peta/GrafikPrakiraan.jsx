import { useReducedMotion } from 'motion/react'
import { CartesianGrid, ComposedChart, Line, ReferenceArea, ReferenceLine, ResponsiveContainer, Tooltip as RTooltip, XAxis, YAxis } from 'recharts'
import { formatNilai, labelAmbang } from '../../lib/kategori'
import { namaHariPendek } from '../../lib/tanggal'
import '../../styles/components/peta.css'

const WARNA_OBSERVASI = '#1B365D'
const WARNA_PREDIKSI = '#005A9C'
const WARNA_AMBANG = '#C21F3A'
const WARNA_SUMBU = '#4A5D78'

function labelWaktu(waktu) {
  const [tanggal, jam] = waktu.split('T')
  const teksJam = jam.replace(':', '.')
  return jam === '00:00' ? `${namaHariPendek(tanggal)} ${teksJam}` : teksJam
}

// Isi tooltip saat titik grafik disorot
function IsiTooltip({ active, payload, parameter }) {
  if (!active || !payload?.length) return null
  const titik = payload[0].payload
  const nilai = titik.obs ?? titik.pred
  return (
    <div className="grafik-tooltip">
      <p className="teks-sekunder">{labelWaktu(titik.waktu)} WIB · {titik.obs != null ? 'Observasi' : 'Prediksi'}</p>
      <p className="grafik-tooltip-nilai">{formatNilai(parameter, nilai)}</p>
    </div>
  )
}

// Grafik 24 jam observasi (garis solid) + 24 jam prediksi (garis putus-putus) + garis ambang
export default function GrafikPrakiraan({ parameter, observasi, prediksi, ambang }) {
  const kurangiGerak = useReducedMotion()
  const data = [
    ...observasi.map((t, i) => ({
      waktu: t.waktu,
      obs: t.nilai,
      pred: i === observasi.length - 1 ? t.nilai : null,
    })),
    ...prediksi.map((t) => ({ waktu: t.waktu, obs: null, pred: t.nilai })),
  ]
  const semuaNilai = [...observasi, ...prediksi].map((t) => t.nilai)
  const atas = Math.max(...semuaNilai, ambang ?? -Infinity)
  const bawah = parameter === 'suhu' ? Math.floor(Math.min(...semuaNilai) - 1) : 0
  const domain = [bawah, Math.ceil(atas * 1.12)]
  const ticks = data.filter((t) => Number(t.waktu.slice(11, 13)) % 12 === 0).map((t) => t.waktu)
  const formatSumbuY = (v) => (parameter === 'jarak-pandang' ? `${v / 1000}` : `${v}`)
  const satuanSumbu = parameter === 'jarak-pandang' ? 'km' : null
  const puncak = Math.max(...prediksi.map((t) => t.nilai))

  return (
    <figure className="grafik">
      <figcaption className="grafik-legenda">
        <span><i className="garis-observasi" aria-hidden="true" />Observasi</span>
        <span><i className="garis-prediksi" aria-hidden="true" />Prediksi</span>
        {ambang != null && <span><i className="garis-ambang" aria-hidden="true" />{labelAmbang(parameter)}</span>}
        {satuanSumbu && <span className="teks-sekunder">Sumbu Y dalam {satuanSumbu}</span>}
      </figcaption>
      <div
        className="grafik-area"
        role="img"
        aria-label={`Grafik ${parameter}: 24 jam observasi dan 24 jam prediksi, puncak prediksi ${formatNilai(parameter, puncak)}${ambang != null ? `, ambang ${formatNilai(parameter, ambang)}` : ''}.`}
      >
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 12, right: 8, bottom: 0, left: -8 }}>
            <CartesianGrid vertical={false} stroke="#D7E4EE" />
            <ReferenceArea x1={prediksi[0].waktu} x2={prediksi.at(-1).waktu} fill="#DCEFF7" fillOpacity={0.55} />
            <XAxis
              dataKey="waktu"
              ticks={ticks}
              tickFormatter={labelWaktu}
              tick={{ fontSize: 11, fill: WARNA_SUMBU }}
              tickLine={false}
              axisLine={{ stroke: '#C9DBE8' }}
              interval={0}
            />
            <YAxis
              domain={domain}
              tickFormatter={formatSumbuY}
              tick={{ fontSize: 11, fill: WARNA_SUMBU }}
              tickLine={false}
              axisLine={false}
              width={44}
            />
            <ReferenceLine x={prediksi[0].waktu} stroke={WARNA_SUMBU} strokeDasharray="3 3" />
            {ambang != null && (
              <ReferenceLine y={ambang} stroke={WARNA_AMBANG} strokeDasharray="2 4" strokeWidth={1.5} ifOverflow="extendDomain" />
            )}
            <RTooltip content={<IsiTooltip parameter={parameter} />} cursor={{ stroke: '#8FA8BF', strokeWidth: 1 }} />
            <Line
              dataKey="obs"
              type="monotone"
              stroke={WARNA_OBSERVASI}
              strokeWidth={2}
              dot={false}
              isAnimationActive={!kurangiGerak}
              animationDuration={350}
            />
            <Line
              dataKey="pred"
              type="monotone"
              stroke={WARNA_PREDIKSI}
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
