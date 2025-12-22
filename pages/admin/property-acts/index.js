import { useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabaseClient'

export default function PropertyActsPage() {
  const [acts, setActs] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadActs()
  }, [])

  async function loadActs() {
    setLoading(true)

    const { data, error } = await supabase
      .from('property_acts')
      .select(`
        id,
        act_date,
        act_number,
        donor,
        total_amount,
        items,
        batch_id
      `)
      .order('act_date', { ascending: false })

    if (!error) setActs(data || [])
    setLoading(false)
  }

  if (loading) return <p>Завантаження...</p>

  return (
    <div>
      <h1>Майнові надходження — акти отримання</h1>

      <table border="1" cellPadding="6">
        <thead>
          <tr>
            <th>Дата</th>
            <th>Номер</th>
            <th>Дарувальник</th>
            <th>Сума</th>
            <th>Номенклатура</th>
          </tr>
        </thead>
        <tbody>
          {acts.map(act => (
            <tr key={act.id}>
              <td>{act.act_date}</td>
              <td>{act.act_number}</td>
              <td>{act.donor}</td>
              <td>{act.total_amount}</td>
              <td>
                <details>
                  <summary>Показати</summary>
                  <ul>
                    {act.items.map((item, idx) => (
                      <li key={idx}>
                        {item.item_name} — {item.qty} × {item.price} = {item.amount}
                      </li>
                    ))}
                  </ul>
                </details>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
