// pages/admin/donations/import.js
// ⚠ Не забудь: npm in stall xlsx

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
  const [rows, setRows] = useState([])           // УСПІШНО розібрані рядки
  const [skippedRows, setSkippedRows] = useState([]) // ПРОПУЩЕНІ рядки з причиною
  const [skippedCount, setSkippedCount] = useState(0)

  const [parsing, setParsing] = useState(false)
  const [importing, setImporting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // ---------- AUTH ----------
  useEffect(() => {
    async function loadUser() {
      const { data } = await supabase.auth.getUser()
      setUser(data?.user ?? null)
      setLoadingUser(false)
    }

    loadUser()

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })

    return () => listener?.subscription?.unsubscribe?.()
  }, [])

  // ---------- LOAD SOURCES ----------
  useEffect(() => {
    if (!user) return

    async function loadSources() {
      const { data, error } = await supabase
        .from('donations_sources')
        .select('*')
        .order('name', { ascending: true })

      if (error) {
        console.error(error)
        setError('Помилка завантаження джерел (sources)')
      } else {
        setSources(data || [])
      }
    }

    loadSources()
  }, [user])

  // ---------- HELPERS ----------

  function normalizeCurrency(raw) {
    if (!raw) return 'UAH'
    const s = String(raw).trim().toUpperCase()

    if (s.startsWith('UAH') || s.startsWith('ГРН')) return 'UAH'
    if (s === 'USD' || s.includes('ДОЛ')) return 'USD'
    if (s === 'EUR' || s.includes('ЄВРО')) return 'EUR'
    if (s === 'PLN' || s.includes('ЗЛОТ')) return 'PLN'

    return s || 'UAH'
  }

  function parseNumber(raw) {
    if (raw === null || raw === undefined) return null
    if (typeof raw === 'number') return raw

    let s = String(raw).trim()
    if (!s) return null

    // прибираємо пробіли тисяч, замінюємо кому на крапку
    s = s.replace(/\s+/g, '').replace(',', '.')
    const n = parseFloat(s)
    return Number.isNaN(n) ? null : n
  }

  /**
   * Парсимо дату+час у формати:
   *  1) dateRaw = "30.11.2025", timeRaw = "20:37:00"
   *  2) dateRaw = "30.11.2025 20:37:00", timeRaw = null/порожнє
   *  3) dateRaw = Excel-serial (число: дата+час)
   * Якщо немає коректної дати+часу — повертаємо null.
   */
  function parseDateTime(dateRaw, timeRaw) {
    if (dateRaw === null || dateRaw === undefined || dateRaw === '') {
      return null
    }

    // -------- CASE 3: Excel-serial число в dateRaw --------
    if (typeof dateRaw === 'number') {
      const dt = XLSX.SSF.parse_date_code(dateRaw)
      if (!dt) return null

      const yyyy = dt.y
      const mm = String(dt.m).padStart(2, '0')
      const dd = String(dt.d).padStart(2, '0')
      const HH = String(dt.H).padStart(2, '0')
      const MM = String(dt.M).padStart(2, '0')
      const SS = String(dt.S || 0).padStart(2, '0')

      return `${yyyy}-${mm}-${dd} ${HH}:${MM}:${SS}`
    }

    // Далі працюємо з текстовою датою
    let dateStr = String(dateRaw).trim()
    let timeStr = timeRaw != null ? String(timeRaw).trim() : ''

    // -------- CASE 1: "DD.MM.YYYY HH:MM:SS" в одному полі --------
    // Наприклад: "30.11.2025 20:37:00"
    if (dateStr.includes(' ')) {
      const parts = dateStr.split(/\s+/)
      if (parts.length >= 2) {
        const dPart = parts[0]
        const tPart = parts[1]

        if (/^\d{2}\.\d{2}\.\d{4}$/.test(dPart) && /^\d{2}:\d{2}:\d{2}$/.test(tPart)) {
          const [dd, mm, yyyy] = dPart.split('.')
          return `${yyyy}-${mm}-${dd} ${tPart}`
        }
      }
    }

    // -------- CASE 2: окремі дата і час --------
    // Дата обов'язково DD.MM.YYYY
    if (/^\d{2}\.\d{2}\.\d{4}$/.test(dateStr)) {
      // Якщо timeRaw — Excel-serial частка доби
      if (typeof timeRaw === 'number') {
        const dt = XLSX.SSF.parse_date_code(timeRaw)
        if (!dt) return null
        const HH = String(dt.H).padStart(2, '0')
        const MM = String(dt.M).padStart(2, '0')
        const SS = String(dt.S || 0).padStart(2, '0')
        timeStr = `${HH}:${MM}:${SS}`
      }

      // Якщо час порожній — вважаємо некоректним
      if (!timeStr) {
        return null
      }

      // Підтримуємо HH:MM або HH:MM:SS
      if (/^\d{2}:\d{2}$/.test(timeStr)) {
        timeStr = `${timeStr}:00`
      }

      if (!/^\d{2}:\d{2}:\d{2}$/.test(timeStr)) {
        return null
      }

      const [dd, mm, yyyy] = dateStr.split('.')
      return `${yyyy}-${mm}-${dd} ${timeStr}`
    }

    // Якщо дійшли сюди — формат не підтримується
    return null
  }

  function shouldSkipByPurpose(purposeRaw) {
    if (!purposeRaw) return false
    const s = String(purposeRaw).trim().toLowerCase()
    return s.startsWith('перерахування')
  }

  // ---------- PARSE XLSX ----------
  async function handleFileChange(e) {
    const file = e.target.files?.[0]
    setRows([])
    setSkippedRows([])
    setSkippedCount(0)
    setError('')
    setSuccess('')

    if (!file) {
      setFileName('')
      return
    }

    setFileName(file.name)
    setParsing(true)

    try {
      const buffer = await file.arrayBuffer()
      const workbook = XLSX.read(buffer, { type: 'array' })
      const sheet = workbook.Sheets[workbook.SheetNames[0]]
      const sheetData = XLSX.utils.sheet_to_json(sheet, { header: 1 })

      if (!sheetData || sheetData.length < 2) {
        setError('Файл порожній або не розпізнаний')
        setParsing(false)
        return
      }

      const header = sheetData[0].map(h => (h ? String(h).trim() : ''))

      // Пошук колонок
      const findIndex = (checkFn) => {
        for (let i = 0; i < header.length; i++) {
          const h = header[i].toLowerCase()
          if (checkFn(h)) return i
        }
        return -1
      }

      const dateIdx = findIndex(h => h.includes('дата'))
      const timeIdx = findIndex(h => h.includes('час'))

      const amountIdxs = header
        .map((h, i) => ({ h: h.toLowerCase(), i }))
        .filter(col => col.h.startsWith('сума'))
        .map(col => col.i)

      const currencyIdxs = header
        .map((h, i) => ({ h: h.toLowerCase(), i }))
        .filter(col => col.h.startsWith('валют'))
        .map(col => col.i)

      const purposeIdx = findIndex(h => h.includes('признач'))

      if (dateIdx === -1 || amountIdxs.length === 0 || currencyIdxs.length === 0) {
        setError('Не вдалося знайти потрібні колонки (дата/сума/валюта)')
        setParsing(false)
        return
      }

      const mainAmountIdx = amountIdxs[0]
      const mainCurrencyIdx = currencyIdxs[0]
      const secondAmountIdx = amountIdxs.length > 1 ? amountIdxs[1] : -1
      const secondCurrencyIdx = currencyIdxs.length > 1 ? currencyIdxs[1] : -1

      const parsed = []
      const skippedList = []
      let skipped = 0

      for (let r = 1; r < sheetData.length; r++) {
        const row = sheetData[r]
        if (!row || row.length === 0) continue

        const dateRaw = row[dateIdx]
        const timeRaw = timeIdx >= 0 ? row[timeIdx] : null
        const amountMainRaw = row[mainAmountIdx]
        const currencyMainRaw = row[mainCurrencyIdx]
        const amountSecondRaw = secondAmountIdx >= 0 ? row[secondAmountIdx] : null
        const currencySecondRaw = secondCurrencyIdx >= 0 ? row[secondCurrencyIdx] : null
        const purposeRaw = purposeIdx >= 0 ? row[purposeIdx] : null

        // Пропускаємо "Перерахування..."
        if (shouldSkipByPurpose(purposeRaw)) {
          skipped++
          skippedList.push({
            reason: 'Перерахування (не імпортуємо за умовою)',
            raw: row
          })
          continue
        }

        const donated_at = parseDateTime(dateRaw, timeRaw)

        if (!donated_at) {
          skipped++
          skippedList.push({
            reason: 'Немає коректної дати/часу',
            raw: row
          })
          continue
        }

        const amountMain = parseNumber(amountMainRaw)
        if (amountMain === null) {
          skipped++
          skippedList.push({
            reason: 'Немає коректної суми (грн)',
            raw: row
          })
          continue
        }

        let currencyMain = normalizeCurrency(currencyMainRaw)
        let amountCurrency = null

        // Друга сума/валюта (якщо є)
        if (amountSecondRaw != null && currencySecondRaw != null) {
          const secondAmount = parseNumber(amountSecondRaw)
          const secondCurrency = normalizeCurrency(currencySecondRaw)
          if (secondAmount !== null && secondCurrency && secondCurrency !== 'UAH') {
            amountCurrency = secondAmount
            currencyMain = secondCurrency
          }
        }

        parsed.push({
          donated_at,          // вже у вигляді 'YYYY-MM-DD HH:MM:SS'
          amount_uah: amountMain,
          currency: currencyMain,
          amount_currency: amountCurrency,
          purpose: purposeRaw ?? '',
        })
      }

      setRows(parsed)
      setSkippedCount(skipped)
      setSkippedRows(skippedList)
    } catch (err) {
      console.error(err)
      setError('Помилка розбору XLSX: ' + err.message)
    } finally {
      setParsing(false)
    }
  }

  // ---------- IMPORT ----------
  async function handleImport() {
    setError('')
    setSuccess('')

    if (!user) {
      setError('Будь ласка, увійдіть у систему.')
      return
    }

    if (!rows.length) {
      setError('Немає даних для імпорту.')
      return
    }

    if (!selectedSourceId) {
      setError('Оберіть джерело надходження (банк/рахунок).')
      return
    }

    setImporting(true)

    try {
      const payload = rows.map(r => ({
        donated_at: r.donated_at,
        amount_uah: r.amount_uah,
        currency: r.currency,
        amount_currency: r.amount_currency,
        source_id: selectedSourceId,
      }))

      const chunkSize = 500
      for (let i = 0; i < payload.length; i += chunkSize) {
        const chunk = payload.slice(i, i + chunkSize)
        const { error } = await supabase.from('donations').insert(chunk)
        if (error) throw error
      }

      setSuccess(
        `Успішно імпортовано ${payload.length} записів. Пропущено: ${skippedCount}.`
      )
      setRows([])
      setFileName('')
    } catch (err) {
      console.error(err)
      setError('Помилка імпорту: ' + err.message)
    } finally {
      setImporting(false)
    }
  }

  // ---------- RENDER ----------

  if (loadingUser) {
    return (
      <div className="max-w-3xl mx-auto p-6">
        <p>Перевірка авторизації...</p>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-lg">
          Будь ласка, увійдіть на{' '}
          <a href="/" className="text-blue-500 underline">
            сторінці логіну
          </a>
        </p>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <button className="mb-4 underline" onClick={() => router.back()}>
        ← Назад
      </button>

      <h1 className="text-2xl font-bold mb-4">Імпорт донатів (XLSX)</h1>

      {error && <p className="mb-3" style={{ color: 'red' }}>Помилка: {error}</p>}
      {success && <p className="mb-3" style={{ color: 'green' }}>{success}</p>}

      <div className="mb-4" style={{ display: 'grid', gap: '12px' }}>
        <div>
          <label className="block mb-1" style={{ fontWeight: 500 }}>Файл XLSX</label>
          <input type="file" accept=".xlsx,.xls" onChange={handleFileChange} />
          {fileName && (
            <p className="text-sm" style={{ color: '#4b5563', marginTop: 4 }}>
              Обраний файл: {fileName}
            </p>
          )}
        </div>

        <div>
          <label className="block mb-1" style={{ fontWeight: 500 }}>
            Джерело надходження (банк / рахунок)
          </label>
          <select
            className="border rounded px-2 py-1 w-full max-w-xs"
            value={selectedSourceId}
            onChange={e => setSelectedSourceId(e.target.value)}
          >
            <option value="">— Оберіть джерело —</option>
            {sources.map(s => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <p className="text-xs" style={{ color: '#6b7280', marginTop: 4 }}>
            Список джерел редагується у Supabase в таблиці <code>donations_sources</code>.
          </p>
        </div>
      </div>

      <div className="mb-4">
        <button
          className="bg-blue-600 text-white px-4 py-2 rounded"
          disabled={parsing || importing || !rows.length}
          onClick={handleImport}
          style={{ opacity: parsing || importing || !rows.length ? 0.6 : 1 }}
        >
          {importing ? 'Імпорт...' : 'Імпортувати в базу'}
        </button>
      </div>

      <div className="mb-4 text-sm" style={{ color: '#374151' }}>
        <p>Розібрано рядків: {rows.length}</p>
        <p>Пропущено: {skippedCount}</p>
      </div>

      {parsing && <p>Розбір XLSX...</p>}

      {/* Попередній перегляд успішних рядків */}
      {rows.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <h2 className="text-lg font-semibold mb-2">Попередній перегляд (перші 50 рядків)</h2>
          <div
            className="border rounded max-h-96 overflow-auto text-sm"
            style={{ border: '1px solid #e5e7eb' }}
          >
            <table className="w-full border-collapse">
              <thead style={{ background: '#f3f4f6' }}>
                <tr>
                  <th className="border px-2 py-1 text-left">Дата/час</th>
                  <th className="border px-2 py-1 text-right">Сума грн</th>
                  <th className="border px-2 py-1 text-left">Валюта</th>
                  <th className="border px-2 py-1 text-right">Сума у валюті</th>
                  <th className="border px-2 py-1 text-left">Призначення</th>
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 50).map((r, idx) => (
                  <tr key={idx} className="border-t">
                    <td className="border px-2 py-1">{r.donated_at}</td>
                    <td className="border px-2 py-1 text-right">{r.amount_uah}</td>
                    <td className="border px-2 py-1">{r.currency}</td>
                    <td className="border px-2 py-1 text-right">
                      {r.amount_currency != null ? r.amount_currency : ''}
                    </td>
                    <td className="border px-2 py-1">{r.purpose}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {rows.length > 50 && (
            <p className="text-xs" style={{ color: '#6b7280', marginTop: 4 }}>
              Показано перші 50 рядків із {rows.length}.
            </p>
          )}
        </div>
      )}

      {/* Пропущені рядки */}
      {skippedRows.length > 0 && (
        <div style={{ marginTop: 24 }}>
          <h2 className="text-lg font-semibold mb-2">Пропущені рядки</h2>
          <div
            className="border rounded max-h-96 overflow-auto text-sm"
            style={{ border: '1px solid #fecaca', background: '#fef2f2' }}
          >
            <table className="w-full border-collapse">
              <thead style={{ background: '#fee2e2' }}>
                <tr>
                  <th className="border px-2 py-1 text-left">Причина</th>
                  <th className="border px-2 py-1 text-left">Сирі дані рядка</th>
                </tr>
              </thead>
              <tbody>
                {skippedRows.map((row, idx) => (
                  <tr key={idx} className="border-t">
                    <td className="border px-2 py-1">{row.reason}</td>
                    <td className="border px-2 py-1">
                      {JSON.stringify(row.raw)}
                    </td>
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
