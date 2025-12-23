import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '../../../lib/supabaseClient'

export default function PropertyActsImport() {
  const router = useRouter()

  const [user, setUser] = useState(null)
  const [loadingUser, setLoadingUser] = useState(true)

  const [fileName, setFileName] = useState('')
  const [validActs, setValidActs] = useState([])
  const [skippedActs, setSkippedActs] = useState([])

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

  // ---------- VALIDATION ----------
  function validateActs(data) {
    const valid = []
    const skipped = []

    data.forEach((act) => {
      const errors = []

      if (!act.act_number) errors.push('Відсутній номер акту')
      if (!act.act_date) errors.push('Відсутня дата акту')
      if (!act.donor) errors.push('Відсутній дарувальник')
      if (!Array.isArray(act.items) || act.items.length === 0) {
        errors.push('Порожня номенклатура')
      }

      if (errors.length) {
        skipped.push({
          act_number: act.act_number || '(без номера)',
          errors,
          raw: act
        })
      } else {
        valid.push(act)
      }
    })

    return { valid, skipped }
  }

  // ---------- PARSE JSON ----------
  async function handleFileChange(e) {
    const file = e.target.files?.[0]

    setValidActs([])
    setSkippedActs([])
    setError('')
    setSuccess('')
    setFileName('')

    if (!file) return

    setFileName(file.name)
    setParsing(true)

    try {
      const text = await file.text()
      const json = JSON.parse(text)

      if (!Array.isArray(json)) {
        setError('JSON має бути масивом актів')
        return
      }

      const { valid, skipped } = validateActs(json)

      setValidActs(valid)
      setSkippedActs(skipped)
    } catch (err) {
      console.error(err)
      setError('Файл не є валідним JSON')
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

    if (!validActs.length) {
      setError('Немає валідних актів для імпорту.')
      return
    }

    setImporting(true)

    try {
      const totalAmount = validActs.reduce(
        (sum, a) => sum + Number(a.total_amount || 0),
        0
      )

      // 1️⃣ batch
      const { data: batch, error: batchError } = await supabase
        .from('property_import_batches')
        .insert({
          source: 'BAS',
          total_acts: validActs.length,
          total_amount: totalAmount,
          original_filename: fileName
        })
        .select()
        .single()

      if (batchError) throw batchError

      // 2️⃣ acts
      const payload = validActs.map(a => ({
        batch_id: batch.id,
        act_id: a.act_id || a.act_number,
        act_number: a.act_number,
        act_date: a.act_date,
        donor: a.donor,
        total_amount: a.total_amount,
        items: a.items
      }))

      const { error: insertError } = await supabase
        .from('property_acts')
        .insert(payload)

      if (insertError) throw insertError

      setSuccess(
        `Успішно імпортовано ${payload.length} актів. Пропущено: ${skippedActs.length}.`
      )
      setValidActs([])
      setSkippedActs([])
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

      <h1 className="text-2xl font-bold mb-4">
        Імпорт майнових надходжень (акти отримання)
      </h1>

      {error && <p className="mb-3" style={{ color: 'red' }}>Помилка: {error}</p>}
      {success && <p className="mb-3" style={{ color: 'green' }}>{success}</p>}

      <div className="mb-4">
        <label className="block mb-1 font-medium">JSON файл</label>
        <input type="file" accept=".json" onChange={handleFileChange} />
        {fileName && (
          <p className="text-sm mt-1" style={{ color: '#4b5563' }}>
            Обраний файл: {fileName}
          </p>
        )}
      </div>

      <div className="mb-4 text-sm" style={{ color: '#374151' }}>
        <p>Валідних актів: {validActs.length}</p>
        <p>Пропущено: {skippedActs.length}</p>
      </div>

      <div className="mb-4">
        <button
          className="bg-blue-600 text-white px-4 py-2 rounded"
          disabled={parsing || importing || !validActs.length}
          onClick={handleImport}
          style={{ opacity: parsing || importing || !validActs.length ? 0.6 : 1 }}
        >
          {importing ? 'Імпорт...' : 'Імпортувати в базу'}
        </button>
      </div>

      {parsing && <p>Розбір JSON...</p>}

      {/* Preview valid */}
      {validActs.length > 0 && (
        <div className="mt-6">
          <h2 className="text-lg font-semibold mb-2">
            Попередній перегляд (перші 20 актів)
          </h2>
          <div className="border rounded overflow-auto text-sm">
            <table className="w-full border-collapse">
              <thead style={{ background: '#f3f4f6' }}>
                <tr>
                  <th className="border px-2 py-1 text-left">Дата</th>
                  <th className="border px-2 py-1 text-left">Номер</th>
                  <th className="border px-2 py-1 text-left">Дарувальник</th>
                  <th className="border px-2 py-1 text-right">Сума</th>
                </tr>
              </thead>
              <tbody>
                {validActs.slice(0, 20).map((a, idx) => (
                  <tr key={idx}>
                    <td className="border px-2 py-1">{a.act_date}</td>
                    <td className="border px-2 py-1">{a.act_number}</td>
                    <td className="border px-2 py-1">{a.donor}</td>
                    <td className="border px-2 py-1 text-right">{a.total_amount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Skipped */}
      {skippedActs.length > 0 && (
        <div className="mt-6">
          <h2 className="text-lg font-semibold mb-2">Пропущені акти</h2>
          <div
            className="border rounded overflow-auto text-sm"
            style={{ background: '#fef2f2', borderColor: '#fecaca' }}
          >
            <table className="w-full border-collapse">
              <thead style={{ background: '#fee2e2' }}>
                <tr>
                  <th className="border px-2 py-1 text-left">Акт</th>
                  <th className="border px-2 py-1 text-left">Причини</th>
                </tr>
              </thead>
              <tbody>
                {skippedActs.map((a, idx) => (
                  <tr key={idx}>
                    <td className="border px-2 py-1">{a.act_number}</td>
                    <td className="border px-2 py-1">
                      {a.errors.join(', ')}
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
