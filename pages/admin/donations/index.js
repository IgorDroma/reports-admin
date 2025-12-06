// pages/admin/donations/index.js
import { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";
import { useRouter } from "next/router";

export default function DonationsList() {
  const router = useRouter();

  const [user, setUser] = useState(null);

  const [donations, setDonations] = useState([]);
  const [sources, setSources] = useState([]);

  const [loading, setLoading] = useState(true);

  // Pagination
  const pageSize = 50;
  const [page, setPage] = useState(0);
  const [totalRows, setTotalRows] = useState(0);

  // Filters
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [amountFrom, setAmountFrom] = useState("");
  const [amountTo, setAmountTo] = useState("");
  const [currency, setCurrency] = useState("");
  const [sourceId, setSourceId] = useState("");

  // Totals
  const [totalAmountUAH, setTotalAmountUAH] = useState(0);
  const [totalCount, setTotalCount] = useState(0);

  // Auth
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data?.user ?? null));
    const { data: listener } = supabase.auth.onAuthStateChange((_e, session) =>
      setUser(session?.user ?? null)
    );
    return () => listener?.subscription?.unsubscribe?.();
  }, []);

  useEffect(() => {
    if (!user) return;
    loadSources();
    loadDonations();
  }, [user, page]);

  async function loadSources() {
    const { data } = await supabase
      .from("donations_sources")
      .select("*")
      .order("name");
    setSources(data || []);
  }

  async function loadDonations() {
    setLoading(true);

    let query = supabase
      .from("donations")
      .select("*", { count: "exact" })
      .order("donated_at", { ascending: false })
      .range(page * pageSize, page * pageSize + pageSize - 1);

    // Filters
    if (dateFrom) query = query.gte("donated_at", dateFrom);
    if (dateTo) query = query.lte("donated_at", dateTo + " 23:59:59");

    if (amountFrom)
      query = query.or(
        `amount_uah.gte.${amountFrom},amount_currency.gte.${amountFrom}`
      );

    if (amountTo)
      query = query.or(
        `amount_uah.lte.${amountTo},amount_currency.lte.${amountTo}`
      );

    if (currency) query = query.eq("currency", currency);
    if (sourceId) query = query.eq("source_id", sourceId);

    const { data, count, error } = await query;
    if (!error) {
      setDonations(data || []);
      setTotalRows(count || 0);
      calculateTotals();
    }

    setLoading(false);
  }

  async function calculateTotals() {
    let totalQuery = supabase
      .from("donations")
      .select("amount_uah", { count: "exact" });

    if (dateFrom) totalQuery = totalQuery.gte("donated_at", dateFrom);
    if (dateTo) totalQuery = totalQuery.lte("donated_at", dateTo + " 23:59:59");

    if (amountFrom)
      totalQuery = totalQuery.or(
        `amount_uah.gte.${amountFrom},amount_currency.gte.${amountFrom}`
      );

    if (amountTo)
      totalQuery = totalQuery.or(
        `amount_uah.lte.${amountTo},amount_currency.lte.${amountTo}`
      );

    if (currency) totalQuery = totalQuery.eq("currency", currency);
    if (sourceId) totalQuery = totalQuery.eq("source_id", sourceId);

    const { data, count } = await totalQuery;

    const total = (data || []).reduce((s, d) => s + (d.amount_uah || 0), 0);
    setTotalAmountUAH(total);
    setTotalCount(count || 0);
  }

  async function deleteDonation(id) {
    if (!confirm("Видалити донат?")) return;
    const { error } = await supabase.from("donations").delete().eq("id", id);
    if (!error) loadDonations();
  }

  if (!user) {
    return (
      <div className="flex text-center" style={{ paddingTop: "40px" }}>
        <p>
          Please sign in → <a href="/" style={{ color: "#2563eb" }}>Login</a>
        </p>
      </div>
    );
  }

  const sourceMap = Object.fromEntries(
    sources.map((s) => [String(s.id), s.name])
  );

  return (
    <div className="page">
      <div className="header">
        <h1 className="title">Список донатів</h1>
        <button className="btn-light" onClick={() => router.push("/admin/donations/import")}>
          Імпорт
        </button>
      </div>

      {/* FILTERS */}
      <div className="filters-grid">
        <div>
          <label className="label">Дата від</label>
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="input" />
        </div>

        <div>
          <label className="label">Дата до</label>
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="input" />
        </div>

        <div>
          <label className="label">Сума від</label>
          <input type="number" value={amountFrom} onChange={(e) => setAmountFrom(e.target.value)} className="input" />
        </div>

        <div>
          <label className="label">Сума до</label>
          <input type="number" value={amountTo} onChange={(e) => setAmountTo(e.target.value)} className="input" />
        </div>

        <div>
          <label className="label">Валюта</label>
          <select value={currency} onChange={(e) => setCurrency(e.target.value)} className="input">
            <option value="">Всі</option>
            <option value="UAH">UAH</option>
            <option value="USD">USD</option>
            <option value="EUR">EUR</option>
          </select>
        </div>

        <div>
          <label className="label">Джерело</label>
          <select value={sourceId} onChange={(e) => setSourceId(e.target.value)} className="input">
            <option value="">Всі</option>
            {sources.map((src) => (
              <option key={src.id} value={src.id}>{src.name}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="filters-buttons">
        <button className="btn-primary" onClick={() => { setPage(0); loadDonations(); }}>
          Застосувати
        </button>

        <button
          className="btn-gray"
          onClick={() => {
            setDateFrom("");
            setDateTo("");
            setAmountFrom("");
            setAmountTo("");
            setCurrency("");
            setSourceId("");
            setPage(0);
            loadDonations();
          }}
        >
          Скинути фільтри
        </button>
      </div>

      {/* TOTALS */}
      <div className="totals-box">
        <div>Загальна сума: <b>{totalAmountUAH.toLocaleString("uk-UA")} грн</b></div>
        <div>Кількість донатів: <b>{totalCount}</b></div>
      </div>

      {/* TABLE */}
      <table className="table">
        <thead>
          <tr>
            <th>Дата</th>
            <th className="text-right">Сума</th>
            <th>Валюта</th>
            <th>Джерело</th>
            <th className="text-right">Дії</th>
          </tr>
        </thead>

        <tbody>
          {donations.map((d) => (
            <tr key={d.id}>
              <td>{new Date(d.donated_at).toLocaleString("uk-UA", { timeZone: "UTC" })}</td>

              <td className="text-right">
                {d.amount_uah.toLocaleString("uk-UA")} грн{" "}
                {d.amount_currency ? `(${d.amount_currency} ${d.currency})` : ""}
              </td>

              <td>{d.currency}</td>
              <td>{sourceMap[String(d.source_id)] || ""}</td>

              <td className="text-right">
                <button className="btn-delete" onClick={() => deleteDonation(d.id)}>
                  Видалити
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* PAGINATION */}
      <div className="pagination">
        <button disabled={page === 0} onClick={() => setPage((p) => p - 1)} className="btn-gray">
          ← Назад
        </button>

        <span>Сторінка {page + 1} / {Math.ceil(totalRows / pageSize)}</span>

        <button
          disabled={(page + 1) * pageSize >= totalRows}
          onClick={() => setPage((p) => p + 1)}
          className="btn-gray"
        >
          Вперед →
        </button>
      </div>
    </div>
  );
}
