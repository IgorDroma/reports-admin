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

  // Auth load
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data?.user ?? null));
    const { data: listener } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null);
    });
    return () => listener?.subscription?.unsubscribe?.();
  }, []);

  useEffect(() => {
    if (!user) return;
    loadSources();
    loadDonations();
  }, [user, page]); // pagination refresh

  async function loadSources() {
    const { data } = await supabase.from("donations_sources").select("*").order("name");
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
    let totalQuery = supabase.from("donations").select("amount_uah", { count: "exact" });

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
      <div className="flex items-center justify-center h-screen">
        <p>
          Please sign in →{" "}
          <a href="/" className="underline text-blue-600">
            Login
          </a>
        </p>
      </div>
    );
  }

const sourceMap = Object.fromEntries(
  sources.map((s) => [String(s.id), s.name])
);
  
  return (
    <div className="max-w-6xl mx-auto p-6">

      <h1 className="text-2xl font-bold mb-4">Список донатів</h1>

      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-6 gap-3 mb-6">

        <div>
          <label className="text-sm">Дата від</label>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="w-full border rounded px-2 py-1"
          />
        </div>

        <div>
          <label className="text-sm">Дата до</label>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="w-full border rounded px-2 py-1"
          />
        </div>

        <div>
          <label className="text-sm">Сума від</label>
          <input
            type="number"
            value={amountFrom}
            onChange={(e) => setAmountFrom(e.target.value)}
            className="w-full border rounded px-2 py-1"
          />
        </div>

        <div>
          <label className="text-sm">Сума до</label>
          <input
            type="number"
            value={amountTo}
            onChange={(e) => setAmountTo(e.target.value)}
            className="w-full border rounded px-2 py-1"
          />
        </div>

        <div>
          <label className="text-sm">Валюта</label>
          <select
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
            className="w-full border rounded px-2 py-1"
          >
            <option value="">Всі</option>
            <option value="UAH">UAH</option>
            <option value="USD">USD</option>
            <option value="EUR">EUR</option>
          </select>
        </div>

        <div>
          <label className="text-sm">Джерело</label>
          <select
            value={sourceId}
            onChange={(e) => setSourceId(e.target.value)}
            className="w-full border rounded px-2 py-1"
          >
            <option value="">Всі</option>
            {sources.map((src) => (
              <option key={src.id} value={src.id}>
                {src.name}
              </option>
            ))}
          </select>
        </div>

      </div>

      <button
        onClick={() => {
          setPage(0);
          loadDonations();
        }}
        className="mb-6 bg-blue-500 text-white px-4 py-2 rounded"
      >
        Застосувати фільтри
      </button>

      {/* Totals */}
      <div className="mb-4 text-lg font-semibold">
        Загальна сума: {totalAmountUAH.toLocaleString("uk-UA")} грн  
        <br />
        Кількість донатів: {totalCount}
      </div>

      {/* Table */}
      <table className="w-full border text-sm">
        <thead className="bg-gray-100">
          <tr>
            <th className="px-2 py-1 text-left">Дата</th>
            <th className="px-2 py-1 text-right">Сума</th>
            <th className="px-2 py-1 text-left">Валюта</th>
            <th className="px-2 py-1 text-left">Джерело</th>
            <th className="px-2 py-1 text-right">Дії</th>
          </tr>
        </thead>

        <tbody>
          {donations.map((d) => (
            <tr key={d.id} className="border-t">
              <td className="px-2 py-1">
                {new Date(d.donated_at).toLocaleString("uk-UA")}
              </td>

              <td className="px-2 py-1 text-right">
                {d.amount_uah.toLocaleString("uk-UA")} грн{" "}
                {d.amount_currency
                  ? `(${d.amount_currency} ${d.currency})`
                  : ""}
              </td>

              <td className="px-2 py-1">{d.currency}</td>

              <td className="px-2 py-1">
                {sourceMap[String(d.source_id)] || ""}
              </td>

              <td className="px-2 py-1 text-right">
                <button
                  onClick={() => deleteDonation(d.id)}
                  className="text-red-500 underline text-xs"
                >
                  Видалити
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Pagination */}
      <div className="flex items-center gap-4 mt-4">
        <button
          disabled={page === 0}
          onClick={() => setPage(page - 1)}
          className="px-3 py-1 border rounded disabled:opacity-40"
        >
          ← Назад
        </button>

        <span>
          Сторінка {page + 1} / {Math.ceil(totalRows / pageSize)}
        </span>

        <button
          disabled={(page + 1) * pageSize >= totalRows}
          onClick={() => setPage(page + 1)}
          className="px-3 py-1 border rounded disabled:opacity-40"
        >
          Вперед →
        </button>
      </div>
    </div>
  );
}
