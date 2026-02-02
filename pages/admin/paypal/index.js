import { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";
import { useRouter } from "next/router";

export default function AdminPaypal() {
  const router = useRouter();

  const [user, setUser] = useState(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const [year, setYear] = useState("");
  const [month, setMonth] = useState("");
  const [currency, setCurrency] = useState("");

  const [total, setTotal] = useState(0);

  /* ---------- AUTH ---------- */
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data?.user) router.push("/login");
      setUser(data?.user ?? null);
    });
  }, [router]);

  useEffect(() => {
    if (user) loadData();
  }, [user, year, month, currency]);

  /* ---------- DATA ---------- */
  async function loadData() {
    setLoading(true);

    let q = supabase
      .from("paypal_donations")
      .select("id, paid_at, amount, currency")
      .order("paid_at", { ascending: false });

    if (year) {
      q = q
        .gte("paid_at", `${year}-01-01`)
        .lte("paid_at", `${year}-12-31`);
    }

    if (year && month) {
      q = q
        .gte("paid_at", `${year}-${month}-01`)
        .lt("paid_at", `${year}-${month}-01::date + interval '1 month'`);
    }

    if (currency) {
      q = q.eq("currency", currency);
    }

    const { data, error } = await q;

    if (!error && data) {
      setItems(data);

      const sum = data.reduce((s, r) => s + Number(r.amount), 0);
      setTotal(sum);
    }

    setLoading(false);
  }

  if (!user) return null;
  if (loading) return <p>Завантаження…</p>;

  return (
    <div className="admin-container">
      <h1>PAYPAL надходження</h1>

      <div className="filters">
        <select value={year} onChange={e => setYear(e.target.value)}>
          <option value="">Рік</option>
          {[2025, 2024, 2023].map(y => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>

        <select value={month} onChange={e => setMonth(e.target.value)}>
          <option value="">Місяць</option>
          {Array.from({ length: 12 }, (_, i) => {
            const m = String(i + 1).padStart(2, "0");
            return <option key={m} value={m}>{m}</option>;
          })}
        </select>

        <select value={currency} onChange={e => setCurrency(e.target.value)}>
          <option value="">Валюта</option>
          <option value="USD">USD</option>
          <option value="EUR">EUR</option>
        </select>
      </div>

      <div className="stats-card">
        Загальна сума: <strong>{total.toLocaleString()} </strong>
      </div>

      <table className="admin-table">
        <thead>
          <tr>
            <th>Дата</th>
            <th>Сума</th>
            <th>Валюта</th>
          </tr>
        </thead>
        <tbody>
          {items.map(r => (
            <tr key={r.id}>
              <td>{new Date(r.paid_at).toLocaleString("uk-UA")}</td>
              <td>{Number(r.amount).toLocaleString()}</td>
              <td>{r.currency}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
