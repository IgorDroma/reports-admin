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

  const getFileUrl = (path) =>
    path ? supabase.storage.from("acts-files").getPublicUrl(path).data.publicUrl : null;

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">Акти</h1>
        <Link
          href="/acts/add"
          className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded"
        >
          Додати акт
        </Link>
      </div>

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
                    href={act.pdf_url}
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
                    href={act.photo_url}
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
