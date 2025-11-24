// pages/api/import-acts.js
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY // НЕ публікувати

const supabaseAdmin = createClient(supabaseUrl, serviceKey)

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const body = req.body

    if (!Array.isArray(body)) {
      return res.status(400).json({ error: 'JSON має бути масивом актів' })
    }

    let insertedActs = 0
    let insertedItems = 0

    // використаємо транзакцію через RPC або просто послідовно (простий варіант)
    for (const act of body) {
      // підтримка різних назв полів: date / act_date, receiver, act_number
      const actDate = act.date || act.act_date
      const actNumber = act.act_number || act.number || null
      const receiver = act.receiver || act.recipient || null

      if (!actDate || !receiver || !actNumber) {
        // пропускаємо акт без обовʼязкових полів
        continue
      }

      // вставляємо акт
      const { data: actInsert, error: actError } = await supabaseAdmin
        .from('acts')
        .insert({
          act_date: actDate,
          act_number: actNumber,
          receiver: receiver,
        })
        .select('id')
        .single()

      if (actError) throw actError
      insertedActs++

      const actId = actInsert.id

      if (Array.isArray(act.items)) {
        const itemsPayload = act.items.map(item => ({
          act_id: actId,
          product_name: item.product_name || item.name || '',
          category: item.category || null,
          quantity: Number(item.quantity ?? item.qty ?? 0),
          amount: Number(item.amount ?? item.sum ?? 0),
        })).filter(i => i.product_name && i.quantity && i.amount)

        if (itemsPayload.length > 0) {
          const { error: itemsError } = await supabaseAdmin
            .from('act_items')
            .insert(itemsPayload)

          if (itemsError) throw itemsError
          insertedItems += itemsPayload.length
        }
      }
    }

    return res.status(200).json({ insertedActs, insertedItems })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: err.message })
  }
}
