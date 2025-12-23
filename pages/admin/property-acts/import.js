import { useState } from 'react'
import Link from 'next/link'
import { supabase } from '../../../lib/supabaseClient'

export default function ImportPropertyActs() {
  const [file, setFile] = useState(null)
  const [report, setReport] = useState({
    total: 0,
    valid: [],
    invalid: []
  })
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  function validateActsWithReport(data) {
    const report = { total: data.length, valid: [], invalid: [] }

    data.forEach((act, index) => {
      const errors = []

      if (!act.act_number) errors.push('Відсутній номер акту')
      if (!act.act_date) errors.push('Відсутня дата акту')
      if (!act.donor) errors.push('Відсутній дарувальник')
      if (!Array.isArray(act.items) || act.items.length === 0)
        errors.push('Порожня номенклатура')

      if (errors.length) report.invalid.push({ index, act_number: act.act_number || '', errors })
      else report.valid.push(act)
    })

    return report
  }

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
        const r = validateActsWithReport(json)
        setReport(r)
        setError(null)
        setFile(f)
      } catch {
        setError('JSON не валідний')
      }
    }
    reader.readAsText(f)
  }

  async function importData() {
    if (report.valid.length === 0) {
      setError('Немає валідних актів для імпорту')
      return
    }

    setLoading(true)
    setError(null)

    const totalAmount = report.valid.reduce((sum, act) => sum + Number(act.total_amount || 0), 0)

    const { data: batchData, error: batchError } = await supabase
      .from('property_import_batches')
      .insert({
        source: 'BAS',
        total_acts: report.valid.length,
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

    const rows = report.valid.map(act => ({
      batch_id: batchData.id,
      act_id: act.act_id || act.act_number,
      act_number: act.act_number,
      act_date: act.act_date,
      donor: act.donor,
      total_amount: act.total_amount,
      items: act.items
    }))

    const { error: insertError } = await supabase.from('property_acts').insert(rows)

    if (insertError) setError(insertError.message)
    else alert(`Імпортовано ${rows.length} актів`)

    setLoading(false)
  }

  return (
    <div className="container mx-auto p-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Імпорт майнових актів</h1>
        <Link href="/admin/property-acts">← Повернутись до актів</Link>
      </div>

      <div className="mb-4">
        <input type="file" accept=".json" onChange={handleFileChange} />
      </div>

      {error && <p className="text-red-500 text-sm mb-4">{error}</p>}

      {report.total > 0 && (
        <div className="bg-gray-50 border border-gray-200 p-4 rounded mb-4">
          <p className="font-medium">Всього актів у файлі: <b>{report.total}</b></p>
          <p className="text-green-600">Валідні: {report.valid.length}</p>
          <p className="text-red-600">Невалідні: {report.invalid.length}</p>

          {report.invalid.length > 0 && (
            <ul className="list-disc list-inside mt-2 text-sm text-red-700">
              {report.invalid.map((item, idx) => (
                <li key={idx}>
                  <span className="font-semibold">Акт {item.act_number || '(без номера)'}</span>: {item.errors.join('; ')}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {report.valid.length > 0 && (
        <div className="mt-4">
          <button
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
            onClick={importData}
            disabled={loading}
          >
            {loading ? 'Імпорт...' : 'Імпортувати'}
          </button>
        </div>
      )}
    </div>
  )
}
