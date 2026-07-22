import React, { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";
import { useRouter } from "next/router";

export default function AdminGallery() {
  const router = useRouter();

  const [user, setUser] = useState(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const [month, setMonth] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [caption, setCaption] = useState("");
  const [sortOrder, setSortOrder] = useState(0);
  const [editingId, setEditingId] = useState(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data?.user) router.push("/login");
      setUser(data?.user ?? null);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_e, session) => {
      if (!session?.user) router.push("/login");
      setUser(session?.user ?? null);
    });

    return () => listener?.subscription?.unsubscribe?.();
  }, [router]);

  useEffect(() => {
    if (user) loadData();
  }, [user]);

  async function loadData() {
    setLoading(true);

    const { data } = await supabase
      .from("report_monthly_gallery")
      .select("*")
      .order("month", { ascending: false })
      .order("sort_order", { ascending: true });

    setItems(data || []);
    setLoading(false);
  }

  function resetForm() {
    setEditingId(null);
    setMonth("");
    setImageUrl("");
    setCaption("");
    setSortOrder(0);
  }

  function startEdit(row) {
    setEditingId(row.id);
    setMonth(row.month.slice(0, 7));
    setImageUrl(row.image_url);
    setCaption(row.caption || "");
    setSortOrder(row.sort_order || 0);

    window.scrollTo({
      top: document.body.scrollHeight,
      behavior: "smooth"
    });
  }

  async function handleSubmit(e) {
    e.preventDefault();

    const payload = {
      month: `${month}-01`,
      image_url: imageUrl,
      caption,
      sort_order: Number(sortOrder)
    };

    let error;

    if (editingId) {
      ({ error } = await supabase
        .from("report_monthly_gallery")
        .update(payload)
        .eq("id", editingId));
    } else {
      ({ error } = await supabase
        .from("report_monthly_gallery")
        .insert(payload));
    }

    if (error) {
      alert(error.message);
      return;
    }

    resetForm();
    loadData();
  }

  async function handleDelete(id) {
    if (!confirm("Видалити зображення?")) return;

    await supabase
      .from("report_monthly_gallery")
      .delete()
      .eq("id", id);

    loadData();
  }

  if (!user) return null;
  if (loading) return <p>Завантаження...</p>;

  return (
    <div className="admin-container">

      <h1 className="admin-title">
        Галерея щомісячних звітів
      </h1>

      <div style={{ marginBottom: 16 }}>
        <button
          className="btn-primary"
          onClick={() => router.push("/")}
        >
          На головну
        </button>
      </div>

      <section className="admin-card">

        <div className="admin-card-header">
          <h2>Зображення</h2>
        </div>

        <table className="admin-table">
          <thead>
            <tr>
              <th>Місяць</th>
              <th>Sort</th>
              <th>Caption</th>
              <th>URL</th>
              <th></th>
            </tr>
          </thead>

          <tbody>
            {items.map(row => (
              <tr key={row.id}>
                <td>
                  {new Date(row.month).toLocaleDateString("uk-UA", {
                    month: "2-digit",
                    year: "numeric"
                  })}
                </td>

                <td>{row.sort_order}</td>

                <td>{row.caption}</td>

                <td style={{maxWidth:350}}>
                  <a
                    href={row.image_url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {row.image_url}
                  </a>
                </td>

                <td className="actions">
                  <button onClick={() => startEdit(row)}>
                    ✏️
                  </button>

                  <button onClick={() => handleDelete(row.id)}>
                    🗑
                  </button>
                </td>

              </tr>
            ))}
          </tbody>
        </table>

      </section>

      <section className="admin-card">

        <h2>
          {editingId
            ? "Редагування"
            : "Додати зображення"}
        </h2>

        <form
          className="admin-form"
          onSubmit={handleSubmit}
        >

          <div className="form-row">
            <label>Місяць</label>
            <input
              type="month"
              value={month}
              onChange={e => setMonth(e.target.value)}
              required
            />
          </div>

          <div className="form-row">
            <label>URL</label>
            <input
              type="text"
              value={imageUrl}
              onChange={e => setImageUrl(e.target.value)}
              required
            />
          </div>

          <div className="form-row">
            <label>Підпис</label>
            <textarea
              value={caption}
              onChange={e => setCaption(e.target.value)}
            />
          </div>

          <div className="form-row">
            <label>Порядок</label>
            <input
              type="number"
              value={sortOrder}
              onChange={e => setSortOrder(e.target.value)}
            />
          </div>

          <div className="form-actions">

            <button type="submit">
              {editingId ? "Оновити" : "Додати"}
            </button>

            {editingId && (
              <button
                type="button"
                onClick={resetForm}
              >
                Скасувати
              </button>
            )}

          </div>

        </form>

      </section>

    </div>
  );
}
