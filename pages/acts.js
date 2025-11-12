import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

export default function Acts() {
  const [user, setUser] = useState(null)
  const [acts, setActs] = useState([])
  const [page, setPage] = useState(1)
  const [perPage] = useState(50)
  const [total, setTotal] = useState(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data?.user ?? null))
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })
    return () => listener?.subscription?.unsubscribe?.()
  }, [])

  useEffect(() => {
    fetchPage()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page])

  async function fetchPage() {
    const from = (page-1)*perPage
    const to = from + perPage - 1
    const { data, error, count } = await supabase
      .from('acts')
      .select('*', { count: 'exact' })
      .order('date', { ascending: false })
      .range(from, to)
    if (error) { alert(error.message); return }
    setActs(data || [])
    setTotal(count)
  }

  if (!user) return <div className="container"><p>Please sign in on <a href="/">login</a></p></div>

  const totalPages = total ? Math.ceil(total / perPage) : null

  return (
    <div className="container">
      <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
        <h2>Acts</h2>
        <div>
          <a href="/add">Add act</a>
        </div>
      </div>

      <table className="table" style={{marginTop:12}}>
        <thead><tr><th>Date</th><th>Amount</th><th>Receiver</th><th>Act#</th><th>PDF</th><th>Photo</th></tr></thead>
        <tbody>
          {acts.map(a => (
            <tr key={a.id}>
              <td>{a.date}</td>
              <td>{a.amount}</td>
              <td>{a.receiver}</td>
              <td>{a.act_number}</td>
              <td>{a.pdf_url ? <a href={a.pdf_url} target="_blank" rel="noreferrer">PDF</a> : '-'}</td>
              <td>{a.photo_url ? <a href={a.photo_url} target="_blank" rel="noreferrer">Photo</a> : '-'}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {totalPages ? (
        <div style={{marginTop:12}}>
          <button onClick={() => setPage(p => Math.max(1, p-1))} disabled={page===1}>Prev</button>
          <span style={{margin:'0 8px'}}>Page {page} of {totalPages}</span>
          <button onClick={() => setPage(p => Math.min(totalPages, p+1))} disabled={page===totalPages}>Next</button>
        </div>
      ) : null}
    </div>
  )
}
