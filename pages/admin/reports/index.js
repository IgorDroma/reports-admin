import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { supabase } from "../../../lib/supabaseClient";

export default function ReportsMonths() {
  const router = useRouter();

  const [user, setUser] = useState(null);
  const [months, setMonths] = useState([]);
  const [loading, setLoading] = useState(true);

  const [newMonth, setNewMonth] = useState(
    new Date().toISOString().slice(0, 7)
  );

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data?.user ?? null);
    });

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_e, session) => setUser(session?.user ?? null)
    );

    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (user) loadMonths();
  }, [user]);

  async function loadMonths() {
    setLoading(true);

    const { data, error } = await supabase
      .from("reports_months")
      .select("*")
      .order("month", { ascending: false });

    if (error) {
      alert(error.message);
      setLoading(false);
      return;
    }

    setMonths(data);
    setLoading(false);
  }

  async function toggle(row) {
    const { error } = await supabase
      .from("reports_months")
      .update({
        is_published: !row.is_published,
        published_at: !row.is_published
          ? new Date().toISOString()
          : null,
      })
      .eq("month", row.month);

    if (error) {
      alert(error.message);
      return;
    }

    loadMonths();
  }

  async function addMonth() {
    if (!newMonth) return;

    const month = newMonth + "-01";

    const { data: exists } = await supabase
      .from("reports_months")
      .select("month")
      .eq("month", month)
      .maybeSingle();

    if (exists) {
      alert("Такий місяць вже існує");
      return;
    }

    const { error } = await supabase
      .from("reports_months")
      .insert({
        month,
        is_published: false,
      });

    if (error) {
      alert(error.message);
      return;
    }

    loadMonths();
  }

  function monthName(date) {
    return new Date(date).toLocaleDateString("uk-UA", {
      month: "long",
      year: "numeric",
    });
  }

  if (!user) {
    return <div className="page">Будь ласка, увійдіть.</div>;
  }

  return (
    <div className="page">

      <button
        className="underline mb-4"
        onClick={() => router.back()}
      >
        ← Назад
      </button>

      <h1 className="title mb-6">
        Публікація звітів
      </h1>

      <div
        style={{
          display: "flex",
          gap: 10,
          marginBottom: 30,
          alignItems: "center",
        }}
      >
        <input
          type="month"
          value={newMonth}
          onChange={(e) => setNewMonth(e.target.value)}
        />

        <button
          className="btn-primary"
          onClick={addMonth}
        >
          Додати місяць
        </button>
      </div>

      {loading ? (
        <p>Завантаження...</p>
      ) : (
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
          }}
        >
          <thead>
            <tr>
              <th align="left">Місяць</th>
              <th align="center">Статус</th>
              <th align="center">Опубліковано</th>
              <th></th>
            </tr>
          </thead>

          <tbody>
            {months.map((row) => (
              <tr key={row.month}>
                <td style={{ padding: "12px 0" }}>
                  {monthName(row.month)}
                </td>

                <td align="center">
                  {row.is_published ? "✅ Так" : "❌ Ні"}
                </td>

                <td align="center">
                  {row.published_at
                    ? new Date(row.published_at).toLocaleString("uk-UA")
                    : "—"}
                </td>

                <td align="right">
                  <button
                    className="btn-primary"
                    onClick={() => toggle(row)}
                  >
                    {row.is_published
                      ? "Приховати"
                      : "Опублікувати"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

    </div>
  );
}
