// pages/admin/donations/import.js
// npm install xlsx

import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '../../../lib/supabaseClient'
import * as XLSX from 'xlsx'

export default function DonationsImport() {
  const router = useRouter()

  const [user, setUser] = useState(null)
  const [loadingUser, setLoadingUser] = useState(true)

  const [sources, setSources] = useState([])
  const [selectedSourceId, setSelectedSourceId] = useState('')

  const [fileName, setFileName] = useState('')
  const [rows, setRows] = useState([])         // імпортовані рядки
  const [skippedRows, setSkippedRows] = useState([]) // пропущені рядки

  const [parsing, setParsing] = useState(false)
  const [importing, setImporting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // ---------- AUTH ----------
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data?.user ?? null)
      setLoadingUser(false)
    })

    const { data: listener } = supabase.auth.onAuthStateChange((_e, session) =>
      setUser(session?.user ?? null)
    )

    return () => listener?.subscription?.unsubscribe?.()
  }, [])

  // ---------- LOAD SOURCES ----------
  useEffect(() => {
    if (!user) return
    supabase
      .from('donations_sources')
      .select('*')
      .order('name')
      .then(({ data }) => setSources(data || []))
  }, [user])

  // ---------- HELPERS ----------

  function normalizeCurrency(raw) {
    if (!raw) return 'UAH'
    const s = String(raw).trim().toUpperCase()

    if (s.includes('UAH') || s.includes('ГРН')) return 'UAH'
    if (s.includes('USD') || s.includes('ДОЛ')) return 'USD'
    if (s.includes('EUR') || s.includes('ЄВРО')) return 'EUR'
    if (s.includes('PLN') || s.includes('ЗЛОТ')) return 'PLN'
    return s
  }

  function parseNumber(raw) {
    if (raw == null) return null
    if (typeof raw === 'number') return raw

    let s = String(raw).trim()
    if (!s) return null

    s = s.replace(/\s+/g, '').replace(',', '.')
    const n = parseFloat(s)
    return Number.isNaN(n) ? null : n
  }

  function parseDateTime(dateRaw, timeRaw) {
  if (!dateRaw) return null;

  // Якщо дата + час у одному полі: "DD.MM.YYYY HH:MM:SS"
  if (typeof dateRaw === 'string' && dateRaw.includes(' ')) {
    const [d, t] = dateRaw.split(' ');
    if (/^\d{2}\.\d{2}\.\d{4}$/.test(d) && /^\d{2}:\d{2}:\d{2}$/.test(t)) {
      const [dd, mm, yyyy] = d.split('.');
      return `${yyyy}-${mm}-${dd} ${t}`;
    }
  }

  // Якщо окремо: "11.11.2025" + "19:27:00"
  if (
    typeof dateRaw === 'string' &&
    /^\d{2}\.\d{2}\.\d{4}$/.test(dateRaw) &&
    typeof timeRaw === 'string' &&
    /^\d{2}:\d{2}:\d{2}$/.test(timeRaw)
  ) {
    const [dd, mm, yyyy] = dateRaw.split('.');
    return `${yyyy}-${mm}-${dd} ${timeRaw}`;
  }

  // Excel serial (одне число)
  if (typeof dateRaw === 'number') {
    const dt = XLSX.SSF.parse_date_code(dateRaw);
    if (!dt) return null;

    const yyyy = dt.y;
    const mm = String(dt.m).padStart(2, '0');
    const dd = String(dt.d).padStart(2, '0');
    const HH = String(dt.H).padStart(2, '0');
    const MM = String(dt.M).padStart(2, '0');
    const SS = String(dt.S).padStart(2, '0');

    return `${yyyy}-${mm}-${dd} ${HH}:${MM}:${SS}`;
  }

  // НЕКОРЕКТНО — якщо немає часу
  return null;
}


  function shouldSkipByPurpose(purposeRaw) {
    if (!purposeRaw) return false
    return String(purposeRaw).trim().toLowerCase().startsWith('перерахування')
  }

  // ---------- PARSE XLSX ----------
  async function handleFileChange(e) {
    const file = e.target.files?.[0]
    setError('')
    setSuccess('')
    setRows([])
    setSkippedRows([])

    if (!file) return setFileName('')

    setFileName(file.name)
    setParsing(true)

    try {
      const buf = await file.arrayBuffer()
      const wb = XLSX.read(buf, { type: 'array' })
      const sheet = wb.Sheets[wb.SheetNames[0]]
      const sheetData = XLSX.utils.sheet_to_json(sheet, { header: 1 })

      if (!sheetData || sheetData.length < 2) {
        setError('Файл порожній або невірний формат')
        return
      }

      const header = sheetData[0].map(h => (h ? String(h).trim() : ''))

      // Знаходимо колонки
      const dateIdx = header.findIndex(h => h.toLowerCase().includes('дата'))
      const amountIdxs = header
        .map((h, i) => ({ h: h.toLowerCase(), i }))
        .filter(col => col.h.startsWith('сума'))
        .map(col => col.i)

      const currencyIdxs = header
        .map((h, i) => ({ h: h.toLowerCase(), i }))
        .filter(col => col.h.startsWith('валют'))
        .map(col => col.i)

      const purposeIdx = header.findIndex(h => h.toLowerCase().includes('призн'))

      if (dateIdx === -1 || amountIdxs.length === 0 || currencyIdxs.length === 0) {
        setError('Не знайдено колонки дата / сума / валюта')
        return
      }

      const mainAmountIdx = amountIdxs[0]
      const mainCurrencyIdx = currencyIdxs[0]
      const secondAmountIdx = amountIdxs[1] ?? -1
      const secondCurrencyIdx = currencyIdxs[1] ?? -1

      const parsed = []
      const skipped = []

      for (let r = 1; r < sheetData.length; r++) {
        const row = sheetData[r]
        if (!row || row.length === 0) continue

        const dateRaw = row[dateIdx]
        const dateFull = parseDateTime(dateRaw)

        if (!dateFull) {
          skipped.push({ row, reason: 'Немає коректної дати/часу' })
          continue
        }

        const purposeRaw = purposeIdx >= 0 ? row[purposeIdx] : null
        if (shouldSkipByPurpose(purposeRaw)) {
          skipped.push({ row, reason: 'Перерахування' })
          continue
        }

        const amountUAH = parseNumber(row[mainAmountIdx])
        if (amountUAH == null) {
          skipped.push({ row, reason: 'Немає суми UAH' })
          continue
        }

        let currency = normalizeCurrency(row[mainCurrencyIdx])

        let amountCurrency = null
        if (secondAmountIdx >= 0) {
          const secondAmount = parseNumber(row[secondAmountIdx])
          const secondCurr = normalizeCurrency(row[secondCurrencyIdx])

          if (secondAmount != null && secondCurr !== 'UAH') {
            amountCurrency = secondAmount
            currency = secondCurr
          }
        }

        parsed.push({
          donated_at: dateFull,
          amount_uah: amountUAH,
          currency,
          amount_currency: amountCurrency,
          purpose: purposeRaw ?? '',
        })
      }

      setRows(parsed)
      setSkippedRows(skipped)
    } catch (err) {
      console.error(err)
      setError('Помилка читання XLSX: ' + err.message)
    } finally {
      setParsing(false)
    }
  }

  // ---------- IMPORT ----------
  async function handleImport() {
    setError('')
    setSuccess('')

    if (!rows.length) {
      setError('Немає даних для імпорту.')
      return
    }
    if (!selectedSourceId) {
      setError('Оберіть джерело надходження.')
      return
    }

    setImporting(true)

    try {
      const batch = rows.map(r => ({
        donated_at: r.donated_at,
        amount_uah: r.amount_uah,
        currency: r.currency,
        amount_currency: r.amount_currency,
        source_id: selectedSourceId,
      }))

      const chunk = 500
      for (let i = 0; i < batch.length; i += chunk) {
        const slice = batch.slice(i, i + chunk)
        const { error } = await supabase.from('donations').insert(slice)
        if (error) throw error
      }

      setSuccess(`Імпортовано ${batch.length}. Пропущено ${skippedRows.length}.`)
      setRows([])
      setFileName('')
    } catch (err) {
      setError('Помилка імпорту: ' + err.message)
    } finally {
      setImporting(false)
    }
  }

  // ---------- UI ----------
  if (loadingUser) return <div className="p-6">Перевірка авторизації...</div>

  if (!user)
    return (
      <div className="flex justify-center items-center h-screen">
        <p>Будь ласка, увійдіть</p>
      </div>
    )

  return (
    <div className="max-w-4xl mx-auto p-6">
      <button className="underline mb-4" onClick={() => router.back()}>
        ← Назад
      </button>

      <h1 className="text-2xl font-bold mb-4">Імпорт донатів</h1>

      {error && <p className="text-red-600 mb-3">{error}</p>}
      {success && <p className="text-green-600 mb-3">{success}</p>}

      {/* FILE + SOURCE */}
      <div className="space-y-4 mb-6">
        <div>
          <label className="font-medium">Файл XLSX</label>
          <input type="file" accept=".xlsx,.xls" onChange={handleFileChange} />
          {fileName && <p className="text-sm mt-1">{fileName}</p>}
        </div>

        <div>
          <label className="font-medium">Джерело надходження</label>
          <select
            className="border rounded px-2 py-1 w-full max-w-xs"
            value={selectedSourceId}
            onChange={(e) => setSelectedSourceId(e.target.value)}
          >
            <option value="">— оберіть —</option>
            {sources.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>

        <button
          className="bg-blue-600 text-white px-4 py-2 rounded disabled:opacity-50"
          disabled={!rows.length || importing}
          onClick={handleImport}
        >
          {importing ? 'Імпорт...' : 'Імпортувати'}
        </button>
      </div>

      {/* PREVIEW */}
      {rows.length > 0 && (
        <div className="mb-6">
          <h2 className="text-lg font-semibold mb-2">
            Попередній перегляд ({rows.length} рядків)
          </h2>
          <div className="max-h-96 overflow-auto border rounded">
            <table className="w-full text-sm">
              <thead className="bg-gray-100 sticky top-0">
                <tr>
                  <th className="px-2 py-1 border">Дата/час</th>
                  <th className="px-2 py-1 border">Сума грн</th>
                  <th className="px-2 py-1 border">Валюта</th>
                  <th className="px-2 py-1 border">Сума у валюті</th>
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 50).map((r, i) => (
                  <tr key={i} className="border-t">
                    <td className="px-2 py-1 border">{r.donated_at}</td>
                    <td className="px-2 py-1 border">{r.amount_uah}</td>
                    <td className="px-2 py-1 border">{r.currency}</td>
                    <td className="px-2 py-1 border">{r.amount_currency ?? ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SKIPPED ROWS */}
      {skippedRows.length > 0 && (
        <div className="mt-8">
          <h2 className="text-lg font-semibold text-red-600 mb-2">
            Пропущені рядки ({skippedRows.length})
          </h2>
          <div className="max-h-96 overflow-auto border rounded text-sm">
            <table className="w-full border-collapse">
              <thead className="bg-gray-100 sticky top-0">
                <tr>
                  <th className="border px-2 py-1">Причина</th>
                  <th className="border px-2 py-1">Рядок</th>
                </tr>
              </thead>
              <tbody>
                {skippedRows.map((s, idx) => (
                  <tr key={idx} className="border-t">
                    <td className="border px-2 py-1">{s.reason}</td>
                    <td className="border px-2 py-1">{JSON.stringify(s.row)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

    </div>
  )
}
