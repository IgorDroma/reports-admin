// pages/admin/donations/import.js
// ⚠ Не забудь: npm install xlsx

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
  const [rows, setRows] = useState([]) // parsed rows
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

  function parseDateTime(dateRaw, timeRaw) {
  // Якщо Excel серійне число (дата+час в одному числі)
  if (typeof dateRaw === 'number' && (!timeRaw || typeof timeRaw !== 'number')) {
    const dt = XLSX.SSF.parse_date_code(dateRaw);
    if (dt) {
      const yyyy = dt.y;
      const mm = String(dt.m).padStart(2, '0');
      const dd = String(dt.d).padStart(2, '0');
      const HH = String(dt.H).padStart(2, '0');
      const MM = String(dt.M).padStart(2, '0');
      const SS = String(dt.S || 0).padStart(2, '0');
      return `${yyyy}-${mm}-${dd} ${HH}:${MM}:${SS}`;
    }
  }

  // Якщо дата текстом у форматі MM/DD/YYYY
  if (typeof dateRaw === 'string' && dateRaw.includes('/')) {
    const parts = dateRaw.split('/');
    if (parts.length === 3) {
      const mm = parts[0].padStart(2, '0');
      const dd = parts[1].padStart(2, '0');
      const yyyy = parts[2];
      let time = '00:00:00';

      // Якщо timeRaw — число (частка доби Excel)
      if (typeof timeRaw === 'number') {
        const dt = XLSX.SSF.parse_date_code(timeRaw);
        if (dt) {
          const HH = String(dt.H).padStart(2, '0');
          const MM = String(dt.M).padStart(2, '0');
          const SS = String(dt.S || 0).padStart(2, '0');
          time = `${HH}:${MM}:${SS}`;
        }
      }

      return `${yyyy}-${mm}-${dd} ${time}`;
    }
  }

  // Якщо Excel-число у timeRaw
  if (typeof timeRaw === 'number') {
    const dt = XLSX.SSF.parse_date_code(timeRaw);
    if (dt) {
      const HH = String(dt.H).padStart(2, '0');
      const MM = String(dt.M).padStart(2, '0');
      const SS = String(dt.S || 0).padStart(2, '0');
      timeRaw = `${HH}:${MM}:${SS}`;
    }
  }

  // Нормалізація текстових дат:
  let dateStr = String(dateRaw).trim();

  // DD.MM.YYYY → YYYY-MM-DD
  if (/^\d{2}\.\d{2}\.\d{4}$/.test(dateStr)) {
    const [dd, mm, yyyy] = dateStr.split('.');
    dateStr = `${yyyy}-${mm}-${dd}`;
  }

  // MM/DD/YYYY → YYYY-MM-DD
  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(dateStr)) {
    const [mm, dd, yyyy] = dateStr.split('/');
    dateStr = `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
  }

  let timeStr = timeRaw ? String(timeRaw).trim() : '00:00:00';

  // Час у форматі HH:MM
  if (/^\d{2}:\d{2}$/.test(timeStr)) {
    timeStr = `${timeStr}:00`;
  }

  // Час у форматі DDDDD.xxxxx (Excel fraction)
  if (/^\d+(\.\d+)?$/.test(timeRaw)) {
    const dt = XLSX.SSF.parse_date_code(Number(timeRaw));
    if (dt) {
      const HH = String(dt.H).padStart(2, '0');
      const MM = String(dt.M).padStart(2, '0');
      const SS = String(dt.S || 0).padStart(2, '0');
      timeStr = `${HH}:${MM}:${SS}`;
    }
  }

  return `${dateStr} ${timeStr}`;
}


  function shouldSkipByPurpose(purposeRaw) {
  if (!purposeRaw) return false;

  const s = String(purposeRaw)
    .trim()
    .toLowerCase(); // робимо нижній регістр

  return s.startsWith('перерахування'); 
}


  // ---------- PARSE XLSX ----------
  async function handleFileChange(e) {
    const file = e.target.files?.[0]
    setRows([])
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

      // Визначаємо колонки
      const findIndex = (checkFn) => {
        for (let i = 0; i < header.length; i++) {
          const h = header[i].toLowerCase()
          if (checkFn(h)) return i
        }
        return -1
      }

      const dateIdx = findIndex(h => h.includes('дата'))
      const timeIdx = findIndex(h => h.includes('час'))
      // усі колонки "сума"
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

        if (shouldSkipByPurpose(purposeRaw)) {
          skipped++
          continue
        }

        const donated_at = parseDateTime(dateRaw, timeRaw)
        const amountMain = parseNumber(amountMainRaw)
        let currencyMain = normalizeCurrency(currencyMainRaw)

        let amountCurrency = null
        // Якщо є друга сума + валюта і валюта відрізняється від UAH
        if (amountSecondRaw != null && currencySecondRaw != null) {
          const secondAmount = parseNumber(amountSecondRaw)
          const secondCurrency = normalizeCurrency(currencySecondRaw)
          if (secondAmount !== null && secondCurrency && secondCurrency !== 'UAH') {
            amountCurrency = secondAmount
            // В цьому випадку вважаємо валюту саме іноземну
            currencyMain = secondCurrency
          }
        }

        if (!donated_at || amountMain === null) {
          // можна рахувати як пропущений або зберігати з помилкою
          skipped++
          continue
        }

        parsed.push({
          donated_at,
          amount_uah: amountMain,
          currency: currencyMain,
          amount_currency: amountCurrency,
          purpose: purposeRaw ?? '',
        })
      }

      setRows(parsed)
      setSkippedCount(skipped)
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

      setSuccess(`Успішно імпортовано ${payload.length} записів. Пропущено: ${skippedCount}.`)
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

      {error && <p className="mb-3 text-red-600">Помилка: {error}</p>}
      {success && <p className="mb-3 text-green-600">{success}</p>}

      <div className="mb-4 space-y-3">
        <div>
          <label className="block mb-1 font-medium">Файл XLSX</label>
          <input type="file" accept=".xlsx,.xls" onChange={handleFileChange} />
          {fileName && <p className="text-sm text-gray-600 mt-1">Обраний файл: {fileName}</p>}
        </div>

        <div>
          <label className="block mb-1 font-medium">Джерело надходження (банк / рахунок)</label>
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
          <p className="text-xs text-gray-500 mt-1">
            Список джерел редагується у Supabase в таблиці <code>donations_sources</code>.
          </p>
        </div>
      </div>

      <div className="mb-4">
        <button
          className="bg-blue-600 text-white px-4 py-2 rounded disabled:opacity-60"
          disabled={parsing || importing || !rows.length}
          onClick={handleImport}
        >
          {importing ? 'Імпорт...' : 'Імпортувати в базу'}
        </button>
      </div>

      <div className="mb-4 text-sm text-gray-700">
        <p>Розібрано рядків: {rows.length}</p>
        <p>Пропущено (\"Перерахування ...\" або некоректні): {skippedCount}</p>
      </div>

      {parsing && <p>Розбір XLSX...</p>}

      {rows.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-2">Попередній перегляд (перші 50 рядків)</h2>
          <div className="border rounded max-h-96 overflow-auto text-sm">
            <table className="w-full border-collapse">
              <thead className="bg-gray-100">
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
            <p className="text-xs text-gray-500 mt-1">
              Показано перші 50 рядків із {rows.length}.
            </p>
          )}
        </div>
      )}
    </div>
  )
}
