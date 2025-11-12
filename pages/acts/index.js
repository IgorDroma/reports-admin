import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabaseClient";
import Link from "next/link";

export default function ActsPage() {
  const [acts, setActs] = useState([]);

  useEffect(() => {
    fetchActs();
  }, []);

  async function fetchActs() {
    const { data, error } = await supabase
      .from("acts")
      .select("*")
      .order("id", { ascending: false });
    if (error) console.error(error);
    else setActs(data);
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Акти</h1>

      <table className="table-auto w-full border border-gray-300">
        <thead>
          <tr>
            <th className="border px-2 py-1">№</th>
            <th className="border px-2 py-1">Дата</th>
            <th className="border px-2 py-1">Номер акту</th>
            <th className="border px-2 py-1">Отримувач</th>
            <th className="border px-2 py-1">Сума</th>
            <th className="border px-2 py-1">PDF</th>
            <th className="border px-2 py-1">Фото</th>
            <th className="border px-2 py-1">Дії</th>
          </tr>
        </thead>
        <tbody>
          {acts.map((act, idx) => (
            <tr key={act.id}>
              <td className="border px-2 py-1">{idx + 1}</td>
              <td className="border px-2 py-1">{act.date}</td>
              <td className="border px-2 py-1">{act.act_number}</td>
              <td className="border px-2 py-1">{act.receiver}</td>
              <td className="border px-2 py-1">{act.amount}</td>
              <td className="border px-2 py-1">
                {act.pdf_url ? (
                  <a
                    href={supabase.storage.from("acts-files").getPublicUrl(act.pdf_url).data.publicUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-500 underline"
                  >
                    PDF
                  </a>
                ) : "-"}
              </td>
              <td className="border px-2 py-1">
                {act.photo_url ? (
                  <a
                    href={supabase.storage.from("acts-files").getPublicUrl(act.photo_url).data.publicUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-500 underline"
                  >
                    Фото
                  </a>
                ) : "-"}
              </td>
              <td className="border px-2 py-1">
                <Link
                  href={`/acts/${act.id}`}
                  className="bg-blue-500 text-white px-3 py-1 rounded"
                >
                  Редагувати
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
