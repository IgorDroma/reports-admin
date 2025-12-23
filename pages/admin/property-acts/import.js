import { useState } from 'react'
import { supabase } from '../../../lib/supabaseClient'

export default function ImportPropertyActsPage() {
  const [file, setFile] = useState(null)
  const [validActs, setValidActs] = useState([])
  const [report, setReport] = useState({
    total: 0,
    valid: [],
    invalid: []
  })
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  // -------- VALIDATION --------
  function validateActsWithReport(data) {
    const report = {
      total: data.length,
      valid: [],
      invalid: []
    }

    data.forEach((act, index) => {
      const errors = []

      if (!act.act_number) errors.push('Відсутній номер акту')
      if (!act.act_date) errors.push('Відсутня дата акту')
      if (!act.donor) errors.push('Відсутній дарувальник')
      if (!Array.isArray(act.items) || act.items.length === 0)
        errors.push('Порожня або відсутня номенклатура')

      if (errors.length > 0) {
        report.invalid.push({
          index,
          act_number: act.act_number || '(без номера)',
          errors
        })
      } else {
        report.valid.push(act)
      }
    })

    return report
  }

  // -------- FILE HANDLER --------
  function handleFileChange(e) {
    const f = e.target.files[0]
    if (!f) return

    const reader = new FileReader()
    reader.onload = e => {
      try {
        const json = JSON.parse(e.target.result)

        if (!Array.isArray(json)) {
          setError('JSON має бути масивом актів')
          return
        }

        const validationReport = validateActsWithReport(json)

        setReport(validationReport)
        setValidActs(validationReport.valid)
        setFile(f)
        setError(null)
      } catch {
        setError('Файл не є валідним JSON')
      }
    }

    reader.readAsText(f)
  }

  // -------- IMPORT --------
  async function importData() {
    if (validActs.length === 0) {
      setError('Немає валідних актів для імпорту')
      return
    }

    setLoading(true)
    setError(null)

    const totalAmount = validActs.reduce(
      (sum, act) => sum + Number(act.total_amount || 0),
      0
    )

    // 1️⃣ create batch
    const { data: batch, error: batchError } = await supabase
      .from('property_import_batches')
      .insert({
        source: 'BAS',
        total_acts: validActs.length,
        total_amount: totalAmount,
        original_filename: file?.name
      })
      .select()
      .single()

    if (batchError) {
      setError(batchError.message)
      setLoading(false)
      return
    }

    // 2️⃣ prepare acts
    const rows = validActs.map(act => ({
      batch_id: batch.id,
      act_id: act.act_id || act.act_number,
      act_number: act.act_number,
      act_date: act.act_date,
      donor: act.donor,
      total_amount: act.total_amount,
      items: act.items
    }))

    // 3️⃣ insert acts
    const { error: insertError } = await supabase
      .from('property_acts')
      .insert(rows)

    if (insertError) {
      setError(insertError.message)
    } else {
      alert(`Імпорт завершено. Імпортовано актів: ${rows.length}`)
      setFile(null)
      setValidActs([])
      setReport({ total: 0, valid: [], invalid: [] })
    }

    setLoading(false)
  }

  // -------- UI --------
  return (
    <div>
      <h1>Імпорт майнових надходжень (акти отримання)</h1>

      <input
        type="file"
        accept=".json"
        onChange={handleFileChange}
      />

      {error && <p style={{ color: 'red' }}>{error}</p>}

      {report.total > 0 && (
        <div style={{ marginTop: 20 }}>
          <p>
            Всього актів у файлі: <b>{report.total}</b>
          </p>
          <p style={{ color: 'green' }}>
            Валідні (будуть імпортовані): {report.valid.length}
          </p>
          <p style={{ color: 'red' }}>
            Невалідні: {report.invalid.length}
          </p>

          {report.invalid.length > 0 && (
            <>
              <h3>Невалідні акти</h3>
              <ul>
                {report.invalid.map((item, idx) => (
                  <li key={idx}>
                    Акт {item.act_number}: {item.errors.join(', ')}
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}

      {validActs.length > 0 && (
        <div style={{ marginTop: 20 }}>
          <p>
            Загальна сума валідних актів:{' '}
            <b>
              {validActs.reduce(
                (sum, a) => sum + Number(a.total_amount || 0),
                0
              )}
            </b>
          </p>

          <button onClick={importData} disabled={loading}>
            {loading ? 'Імпорт...' : 'Імпортувати'}
          </button>
        </div>
      )}
    </div>
  )
}
