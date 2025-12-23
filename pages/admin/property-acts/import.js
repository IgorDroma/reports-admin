import { useState } from 'react'
import { supabase } from '../../../lib/supabaseClient'

export default function ImportPropertyActsPage() {
  const [file, setFile] = useState(null)
  const [acts, setActs] = useState([])
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  function validate(data) {
    return Array.isArray(data) && data.every(a =>
      a.act_number &&
      a.act_date &&
      a.donor &&
      Array.isArray(a.items) &&
      a.items.length > 0
    )
  }

  function handleFile(e) {
    const f = e.target.files[0]
    if (!f) return

    const reader = new FileReader()
    reader.onload = e => {
      try {
        const json = JSON.parse(e.target.result)
        if (!validate(json)) {
          setError('Невірна структура JSON')
          return
        }
        setActs(json)
        setFile(f)
        setError(null)
      } catch {
        setError('JSON не валідний')
      }
    }
    reader.readAsText(f)
  }

  async function importData() {
    setLoading(true)

    const totalAmount = acts.reduce((s, a) => s + a.total_amount, 0)

    const { data: batch, error: batchError } = await supabase
      .from('property_import_batches')
      .insert({
        source: 'BAS',
        total_acts: acts.length,
        total_amount: totalAmount,
        original_filename: file.name
      })
      .select()
      .single()

    if (batchError) {
      setError(batchError.message)
      setLoading(false)
      return
    }

    const rows = acts.map(a => ({
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
      .insert(rows)

    if (insertError) setError(insertError.message)
    else alert('Імпорт завершено')

    setLoading(false)
  }

  return (
    <div>
      <h1>Імпорт майнових актів</h1>

      <input type="file" accept=".json" onChange={handleFile} />

      {error && <p style={{ color: 'red' }}>{error}</p>}

      {acts.length > 0 && (
        <>
          <p>Актів: {acts.length}</p>
          <p>
            Сума: {acts.reduce((s,a)=>s+a.total_amount,0)}
          </p>
          <button onClick={importData} disabled={loading}>
            {loading ? 'Імпорт...' : 'Імпортувати'}
          </button>
        </>
      )}
    </div>
  )
}
