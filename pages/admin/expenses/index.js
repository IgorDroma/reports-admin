import { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";
import { useRouter } from "next/router";

export default function AdminExpenses() {
  const router = useRouter();

  const [user, setUser] = useState(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const [month, setMonth] = useState("");
  const [amount, setAmount] = useState("");
  const [comment, setComment] = useState("");
  const [editingId, setEditingId] = useState(null);

  const [yearTotal, setYearTotal] = useState(0);

  // auth
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

    const { data, error } = await supabase
      .from("admin_expenses")
      .select("id, month, amount, comment")
      .order("month", { ascending: false });

    if (!error && data) {
      setItems(data);

      // підсумок за поточний рік
      const currentYear = new Date().getFullYear();
      const total = data
        .filter(i => new Date(i.month).getFullYear() === currentYear)
        .reduce((sum, i) => sum + Number(i.amount), 0);

      setYearTotal(total);
    }

    setLoading(false);
  }

  function startEdit(row) {
    setEditingId(row.id);
    setMonth(row.month.slice(0, 7));
    setAmount(row.amount);
    setComment(row.comment || "");
  }

  function resetForm() {
    setEditingId(null);
    setMonth("");
    setAmount("");
    setComment("");
  }

  async function handleSubmit(e) {
    e.preventDefault();

    const payload = {
      month: `${month}-01`,
      amount: Number(amount),
      comment
    };

    const { error } = editingId
      ? await supabase.from("admin_expenses").update(payload).eq("id", editingId)
      : await supabase
          .from("admin_expenses")
          .upsert(payload, { onConflict: "month" });

    if (error) {
      alert(error.message);
      return;
    }

    resetForm();
    loadData();
  }

  async function handleDelete(id) {
    if (!confirm("Видалити запис?")) return;

    const { error } = await supabase
      .from("admin_expenses")
      .delete()
      .eq("id", id);

    if (!error) loadData();
  }

  if (!user) return null;
  if (loading) return <p>Завантаження...</p>;

  return (
    <div className="admin-container">
      <h1 className="admin-title">Адміністративні витрати</h1>

      {/* FORM */}
      <form className="admin-form" onSubmit={handleSubmit}>
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
          <label>Сума</label>
          <input
            type="number"
            value={amount}
            onChange={e => setAmount(e.target.value)}
            required
          />
        </div>

        <div className="form-row">
          <label>Коментар</label>
          <textarea
            value={comment}
            onChange={e => setComment(e.target.value)}
          />
        </div>

        <div className="form-actions">
          <button type="submit">
            {editingId ? "Оновити" : "Додати"}
          </button>

          {editingId && (
            <button type="button" onClick={resetForm}>
              Скасувати
            </button>
          )}
        </div>
      </form>

      {/* SUMMARY */}
      <div className="admin-summary">
        <strong>
          Сума за {new Date().getFullYear()} рік: {yearTotal.toLocaleString()} грн
        </strong>
      </div>

      {/* TABLE */}
      <table className="admin-table">
        <thead>
          <tr>
            <th>Місяць</th>
            <th>Сума</th>
            <th>Коментар</th>
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
              <td>{Number(row.amount).toLocaleString()} грн</td>
              <td>{row.comment}</td>
              <td>
                <button onClick={() => startEdit(row)}>✏️</button>
                <button onClick={() => handleDelete(row.id)}>🗑</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
