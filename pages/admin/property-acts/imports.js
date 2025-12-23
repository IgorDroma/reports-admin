import { useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabaseClient'

export default function PropertyImportsPage() {
  const [batches, setBatches] = useState([])

  useEffect(() => {
    load()
  }, [])

  async function load() {
    const { data } = await supabase
      .from('property_import_batches')
      .select('*')
      .order('created_at', { ascending: false })

    setBatches(data || [])
  }

  async function remove(id) {
    if (!confirm('Видалити імпорт?')) return

    await supabase
      .from('property_import_batches')
      .delete()
      .eq('id', id)

    load()
  }

  return (
    <div>
      <h1>Імпорти майнових актів</h1>

      <table border="1" cellPadding="6">
        <thead>
          <tr>
            <th>Дата</th>
            <th>Файл</th>
            <th>Актів</th>
            <th>Сума</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {batches.map(b => (
            <tr key={b.id}>
              <td>{new Date(b.created_at).toLocaleString()}</td>
              <td>{b.original_filename}</td>
              <td>{b.total_acts}</td>
              <td>{b.total_amount}</td>
              <td>
                <button onClick={() => remove(b.id)}>❌</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
