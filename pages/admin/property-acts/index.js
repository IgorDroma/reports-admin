import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { supabase } from "../../../lib/supabaseClient";

export default function PropertyActsList() {
  const router = useRouter();

  const [user, setUser] = useState(null);

  const [acts, setActs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [page, setPage] = useState(0);
  const pageSize = 50;

  // Filters
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [donor, setDonor] = useState("");
  const [actNumber, setActNumber] = useState("");

  // Modal: Items
  const [itemsModalOpen, setItemsModalOpen] = useState(false);
  const [itemsModalAct, setItemsModalAct] = useState(null);
  const [itemsModalItems, setItemsModalItems] = useState([]);

  // ---------- AUTH ----------
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data?.user ?? null));
    const { data: listener } = supabase.auth.onAuthStateChange(
      (_e, session) => setUser(session?.user ?? null)
    );
    return () => listener?.subscription?.unsubscribe?.();
  }, []);

  // ---------- LOAD ACTS ----------
  useEffect(() => {
    if (!user) return;
    loadActs();
  }, [user, page]);

  async function loadActs() {
    setLoading(true);
    setError(null);

    try {
      let query = supabase
        .from("property_acts")
        .select("*", { count: "exact" })
        .order("act_date", { ascending: false })
        .range(page * pageSize, page * pageSize + pageSize - 1);

      if (dateFrom) query = query.gte("act_date", dateFrom);
      if (dateTo) query = query.lte("act_date", dateTo);
      if (donor) query = query.ilike("donor", `%${donor}%`);
      if (actNumber) query = query.ilike("act_number", `%${actNumber}%`);

      const { data, error } = await query;
      if (error) throw error;

      setActs(data || []);
    } catch (err) {
      console.error(err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function resetFilters() {
    setDateFrom("");
    setDateTo("");
    setDonor("");
    setActNumber("");
    setPage(0);
    loadActs();
  }

  function openItemsModal(act) {
    setItemsModalAct(act);
    setItemsModalItems(act.items || []);
    setItemsModalOpen(true);
  }

  if (!user) {
    return (
      <div className="page">
        <p>
          Please sign in →{" "}
          <a href="/" style={{ color: "#2563eb" }}>
            Login
          </a>
        </p>
      </div>
    );
  }

  return (
    <div className="page">
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <h1 className="title">Майнові надходження</h1>

        <div>
          <button className="secondary" onClick={() => router.push("/")}>
            На головну
          </button>
          <button
            className="secondary"
            onClick={() => router.push("/admin/property-acts/import")}
          >
            Імпорт JSON
          </button>
          <button
            className="secondary"
            onClick={() => router.push("/admin/property-acts/imports")}
          >
            Список імпортів
          </button>
        </div>
      </div>

      {/* FILTERS */}
      <div className="grid grid-5" style={{ marginTop: 20 }}>
        <div>
          <label className="label">Дата від</label>
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
        </div>

        <div>
          <label className="label">Дата до</label>
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
        </div>

        <div>
          <label className="label">Дарувальник</label>
          <input value={donor} onChange={(e) => setDonor(e.target.value)} />
        </div>

        <div>
          <label className="label">Номер акту</label>
          <input value={actNumber} onChange={(e) => setActNumber(e.target.value)} />
        </div>

        <div style={{ display: "flex", alignItems: "flex-end", gap: 8 }}>
          <button onClick={() => { setPage(0); loadActs(); }}>
            Застосувати
          </button>
          <button className="bg-gray-300 px-3 py-2 rounded" onClick={resetFilters}>
            Скинути
          </button>
        </div>
      </div>

      {/* TABLE */}
      <table style={{ marginTop: 20 }}>
        <thead className="bg-gray-100">
          <tr>
            <th className="px-2 py-2 text-left">Дата</th>
            <th className="px-2 py-2 text-left">Номер акту</th>
            <th className="px-2 py-2 text-left">Дарувальник</th>
            <th className="px-2 py-2 text-right">Сума</th>
            <th className="px-2 py-2 text-left">Номенклатура</th>
          </tr>
        </thead>

        <tbody>
          {loading ? (
            <tr>
              <td colSpan={5} style={{ textAlign: "center" }}>
                Завантаження...
              </td>
            </tr>
          ) : acts.length === 0 ? (
            <tr>
              <td colSpan={5} style={{ textAlign: "center" }}>
                Немає актів
              </td>
            </tr>
          ) : (
            acts.map((act) => (
              <tr key={act.id}>
                <td>
                  {act.act_date
                    ? new Date(act.act_date).toLocaleDateString("uk-UA")
                    : ""}
                </td>
                <td>{act.act_number}</td>
                <td>{act.donor}</td>
                <td className="px-2 py-1 text-right">
                  {act.total_amount?.toLocaleString("uk-UA")} грн
                </td>
                <td>
                  <button
                    className="secondary"
                    onClick={() => openItemsModal(act)}
                  >
                    Товари ({Array.isArray(act.items) ? act.items.length : 0})
                  </button>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>

      {/* PAGINATION */}
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 20 }}>
        <button disabled={page === 0} onClick={() => setPage(p => p - 1)}>
          ← Назад
        </button>

        <div>Сторінка {page + 1}</div>

        <button onClick={() => setPage(p => p + 1)}>
          Вперед →
        </button>
      </div>

      {/* ITEMS MODAL */}
      {itemsModalOpen && (
        <div className="modal-bg">
          <div className="modal-box">
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <h2>Номенклатура акту {itemsModalAct?.act_number}</h2>
              <button className="modal-close" onClick={() => setItemsModalOpen(false)}>
                ×
              </button>
            </div>

            {itemsModalItems.length === 0 ? (
              <p>Немає товарів</p>
            ) : (
              <table style={{ marginTop: 10 }}>
                <thead>
                  <tr>
                    <th>Назва</th>
                    <th>Кількість</th>
                    <th>Ціна</th>
                    <th>Сума</th>
                  </tr>
                </thead>
                <tbody>
                  {itemsModalItems.map((it, idx) => (
                    <tr key={idx}>
                      <td>{it.item_name}</td>
                      <td>{it.qty}</td>
                      <td>{it.price}</td>
                      <td>{it.amount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
