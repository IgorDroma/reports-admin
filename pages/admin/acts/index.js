import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { supabase } from "../../../lib/supabaseClient";

export default function ActsList() {
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
  const [receiver, setReceiver] = useState("");
  const [actId, setActId] = useState("");

  // Modal: Items
  const [itemsModalOpen, setItemsModalOpen] = useState(false);
  const [itemsModalAct, setItemsModalAct] = useState(null);
  const [itemsModalItems, setItemsModalItems] = useState([]);
  const [itemsModalLoading, setItemsModalLoading] = useState(false);

  // Modal: Photos
  const [photoModalOpen, setPhotoModalOpen] = useState(false);
  const [photoModalImages, setPhotoModalImages] = useState([]);

  // AUTH
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data?.user ?? null));
    const { data: listener } = supabase.auth.onAuthStateChange(
      (_e, session) => setUser(session?.user ?? null)
    );
    return () => listener?.subscription?.unsubscribe?.();
  }, []);

  // LOAD ACTS
  useEffect(() => {
    if (!user) return;
    loadActs();
  }, [user, page]);

  async function loadActs() {
    setLoading(true);
    setError(null);

    try {
      let query = supabase
        .from("acts")
        .select("*", { count: "exact" })
        .order("act_date", { ascending: false })
        .range(page * pageSize, page * pageSize + pageSize - 1);

      if (dateFrom) query = query.gte("act_date", dateFrom);
      if (dateTo) query = query.lte("act_date", dateTo + " 23:59:59");
      if (receiver) query = query.ilike("receiver", `%${receiver}%`);
      if (actId) query = query.ilike("id", `%${actId}%`);

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

  function openPhotoModal(images) {
    setPhotoModalImages(images);
    setPhotoModalOpen(true);
  }

  async function openItemsModal(act) {
    setItemsModalAct(act);
    setItemsModalItems([]);
    setItemsModalLoading(true);
    setItemsModalOpen(true);

    const { data, error } = await supabase
      .from("act_items")
      .select(
        `
        id,
        qty,
        price,
        sum,
        products (
          name,
          category_id,
          product_categories(name)
        )
      `
      )
      .eq("act_id", act.id)
      .order("id", { ascending: true });

    if (error) {
      console.error(error);
      setItemsModalItems([]);
    } else {
      setItemsModalItems(
        data.map((it) => ({
          id: it.id,
          qty: it.qty,
          price: it.price,
          sum: it.sum,
          product_name: it.products?.name || "",
          category: it.products?.product_categories?.name || "",
        }))
      );
    }

    setItemsModalLoading(false);
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
        <h1 className="title">Акти</h1>

        <button
          className="secondary"
          onClick={() => router.push("/admin/import-json")}
        >
          Імпорт JSON
        </button>
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
          <label className="label">Отримувач</label>
          <input value={receiver} onChange={(e) => setReceiver(e.target.value)} />
        </div>

        <div>
          <label className="label">ID акту</label>
          <input value={actId} onChange={(e) => setActId(e.target.value)} />
        </div>

        <div style={{ display: "flex", alignItems: "flex-end" }}>
          <button onClick={() => { setPage(0); loadActs(); }}>
            Застосувати
          </button>
        </div>
      </div>

      {/* TABLE */}
      <table style={{ marginTop: 20 }}>
        <thead>
          <tr>
            <th>Дата</th>
            <th>ID</th>
            <th>Отримувач</th>
            <th>Фото</th>
            <th>Дії</th>
          </tr>
        </thead>

        <tbody>
          {loading ? (
            <tr><td colSpan={5} style={{ textAlign: "center" }}>Завантаження...</td></tr>
          ) : acts.length === 0 ? (
            <tr><td colSpan={5} style={{ textAlign: "center" }}>Немає актів</td></tr>
          ) : (
            acts.map((act) => (
              <tr key={act.id}>
                <td>{act.act_date ? new Date(act.act_date).toLocaleDateString("uk-UA") : ""}</td>
                <td>{act.id}</td>
                <td>{act.receiver}</td>

                <td>
                  {Array.isArray(act.photo_urls) && act.photo_urls.length > 0 && (
                    <button className="secondary" onClick={() => openPhotoModal(act.photo_urls)}>
                      Фото ({act.photo_urls.length})
                    </button>
                  )}
                </td>

                <td>
                  <button
                    className="secondary"
                    onClick={() => openItemsModal(act)}
                  >
                    Товари
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
              <h2>Товари акту {itemsModalAct?.id}</h2>
              <button className="modal-close" onClick={() => setItemsModalOpen(false)}>×</button>
            </div>

            {itemsModalLoading ? (
              <p>Завантаження...</p>
            ) : itemsModalItems.length === 0 ? (
              <p>Немає товарів</p>
            ) : (
              <table style={{ marginTop: 10 }}>
                <thead>
                  <tr>
                    <th>Назва</th>
                    <th>Категорія</th>
                    <th>Кількість</th>
                    <th>Сума</th>
                  </tr>
                </thead>

                <tbody>
                  {itemsModalItems.map((it) => (
                    <tr key={it.id}>
                      <td>{it.product_name}</td>
                      <td>{it.category}</td>
                      <td>{it.qty}</td>
                      <td>{it.sum.toLocaleString("uk-UA")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* PHOTO MODAL */}
      {photoModalOpen && (
        <div className="modal-bg">
          <div className="modal-box">
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <h2>Фото акту</h2>
              <button className="modal-close" onClick={() => setPhotoModalOpen(false)}>
                ×
              </button>
            </div>

            <div className="photo-grid" style={{ marginTop: 20 }}>
              {photoModalImages.map((url, i) => (
                <img key={i} src={url} />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
