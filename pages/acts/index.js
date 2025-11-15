import { useState, useEffect } from "react";
import Link from "next/link";
import { supabase } from "../../lib/supabaseClient"; // заміни шлях

export default function ActsPage() {
  const [acts, setActs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadActs();
  }, []);

  async function loadActs() {
    setLoading(true);

    const { data, error } = await supabase
      .from("acts")
      .select("*")
      .order("date", { ascending: false });

    if (error) console.error(error);
    else setActs(data);

    setLoading(false);
  }

  if (loading) return <p className="p-6">Завантаження...</p>;

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Акти</h1>

        <Link
          href="/acts/add"
          className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg shadow"
        >
          Додати акт
        </Link>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-lg shadow">
        <table className="table-auto w-full text-left border border-gray-300">
          <thead className="bg-gray-100">
            <tr>
              <th className="border px-3 py-2">#</th>
              <th className="border px-3 py-2">Дата</th>
              <th className="border px-3 py-2">Номер</th>
              <th className="border px-3 py-2">Отримувач</th>
              <th className="border px-3 py-2">Сума</th>
              <th className="border px-3 py-2">PDF</th>
              <th className="border px-3 py-2">Фото</th>
              <th className="border px-3 py-2 text-center">Дії</th>
            </tr>
          </thead>

          <tbody>
            {acts.map((act, index) => (
              <tr key={act.id} className="hover:bg-gray-50">
                <td className="border px-3 py-2">{index + 1}</td>
                <td className="border px-3 py-2">{act.date}</td>
                <td className="border px-3 py-2">{act.act_number}</td>
                <td className="border px-3 py-2">{act.receiver}</td>
                <td className="border px-3 py-2">{act.amount}</td>

                {/* PDF */}
                <td className="border px-3 py-2">
                  {act.pdf_url ? (
                    <a
                      href={act.pdf_url}
                      target="_blank"
                      className="text-blue-600 underline"
                    >
                      PDF
                    </a>
                  ) : (
                    "-"
                  )}
                </td>

                {/* Photo */}
                <td className="border px-3 py-2">
                  {act.photo_url ? (
                    <a
                      href={act.photo_url}
                      target="_blank"
                      className="text-blue-600 underline"
                    >
                      Фото
                    </a>
                  ) : (
                    "-"
                  )}
                </td>

                {/* Edit button */}
                <td className="border px-3 py-2 text-center">
                  <Link
                    href={`/acts/${act.id}`}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded shadow"
                  >
                    Редагувати
                  </Link>
                </td>
              </tr>
            ))}

            {acts.length === 0 && (
              <tr>
                <td
                  colSpan="8"
                  className="text-center py-6 text-gray-500 border"
                >
                  Немає записів
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
