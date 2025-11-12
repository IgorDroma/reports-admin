// pages/acts/[id].js
import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabaseClient";
import { useRouter } from "next/router";
import { deleteFile } from "../../lib/fileHelper";

export default function ActEditPage() {
  const router = useRouter();
  const { id } = router.query;

  const [act, setAct] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (id) fetchAct();
  }, [id]);

  async function fetchAct() {
    const { data, error } = await supabase
      .from("acts")
      .select("*")
      .eq("id", id)
      .single();

    if (error) console.error("Error fetching act:", error);
    else setAct(data);
  }

  const uploadFile = async (file, folder) => {
    const fileName = `${folder}/${Date.now()}_${file.name.replaceAll(" ", "_")}`;
    const { error: uploadError } = await supabase.storage
      .from("acts-files")
      .upload(fileName, file, { upsert: true });

    if (uploadError) throw uploadError;

    const { data } = supabase.storage.from("acts-files").getPublicUrl(fileName);
    return data.publicUrl;
  };

  const handleFileUpload = async (type, file) => {
    if (!file) return;

    try {
      setLoading(true);
      const folder = type === "pdf" ? "pdfs" : "photos";

      // Якщо є старий файл — видаляємо
      if (act[`${type}_url`]) await deleteFile(act[`${type}_url`]);

      const newUrl = await uploadFile(file, folder);

      const { error } = await supabase
        .from("acts")
        .update({ [`${type}_url`]: newUrl })
        .eq("id", act.id);

      if (error) throw error;
      setAct({ ...act, [`${type}_url`]: newUrl });
    } catch (err) {
      console.error("Upload error:", err.message);
      alert("Помилка при завантаженні файлу");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteFile = async (type) => {
    try {
      if (!act[`${type}_url`]) return;
      await deleteFile(act[`${type}_url`]);

      const { error } = await supabase
        .from("acts")
        .update({ [`${type}_url`]: null })
        .eq("id", act.id);

      if (error) throw error;
      setAct({ ...act, [`${type}_url`]: null });
    } catch (err) {
      console.error("Delete error:", err.message);
      alert("Помилка при видаленні файлу");
    }
  };

  const handleUpdateAct = async () => {
    try {
      setLoading(true);
      const { error } = await supabase
        .from("acts")
        .update({
          date: act.date,
          act_number: act.act_number,
          receiver: act.receiver,
          amount: act.amount,
        })
        .eq("id", act.id);

      if (error) throw error;
      router.push("/acts");
    } catch (err) {
      console.error("Update error:", err.message);
      alert("Помилка при збереженні акту");
    } finally {
      setLoading(false);
    }
  };

  if (!act) return <div className="p-6">Loading...</div>;

  return (
    <div className="max-w-lg mx-auto p-6 bg-white shadow-lg rounded-lg mt-10">
      <h1 className="text-2xl font-bold mb-6 text-center">
        Редагування акту №{act.act_number}
      </h1>

      <div className="space-y-4">
        <div>
          <label className="block font-medium mb-1">Дата</label>
          <input
            type="date"
            value={act.date || ""}
            onChange={(e) => setAct({ ...act, date: e.target.value })}
            className="w-full border rounded px-3 py-2"
          />
        </div>

        <div>
          <label className="block font-medium mb-1">Номер акту</label>
          <input
            type="text"
            value={act.act_number || ""}
            onChange={(e) => setAct({ ...act, act_number: e.target.value })}
            className="w-full border rounded px-3 py-2"
          />
        </div>

        <div>
          <label className="block font-medium mb-1">Отримувач</label>
          <input
            type="text"
            value={act.receiver || ""}
            onChange={(e) => setAct({ ...act, receiver: e.target.value })}
            className="w-full border rounded px-3 py-2"
          />
        </div>

        <div>
          <label className="block font-medium mb-1">Сума</label>
          <input
            type="number"
            value={act.amount || ""}
            onChange={(e) => setAct({ ...act, amount: e.target.value })}
            className="w-full border rounded px-3 py-2"
          />
        </div>

        {/* PDF */}
        <div>
          <label className="block font-medium mb-1">PDF файл</label>
          {act.pdf_url ? (
            <div className="flex items-center justify-between mb-2">
              <a
                href={act.pdf_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 underline"
              >
                Відкрити PDF
              </a>
              <button
                onClick={() => handleDeleteFile("pdf")}
                className="text-red-500 hover:text-red-700 text-sm"
              >
                Видалити
              </button>
            </div>
          ) : (
            <p className="text-sm text-gray-500 mb-1">PDF не додано</p>
          )}
          <input
            type="file"
            accept="application/pdf"
            onChange={(e) => handleFileUpload("pdf", e.target.files[0])}
            className="w-full"
          />
        </div>

        {/* Фото */}
        <div>
          <label className="block font-medium mb-1">Фото</label>
          {act.photo_url ? (
            <div className="flex items-center justify-between mb-2">
              <a
                href={act.photo_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 underline"
              >
                Переглянути фото
              </a>
              <button
                onClick={() => handleDeleteFile("photo")}
                className="text-red-500 hover:text-red-700 text-sm"
              >
                Видалити
              </button>
            </div>
          ) : (
            <p className="text-sm text-gray-500 mb-1">Фото не додано</p>
          )}
          <input
            type="file"
            accept="image/*"
            onChange={(e) => handleFileUpload("photo", e.target.files[0])}
            className="w-full"
          />
        </div>
      </div>

      <div className="flex justify-between mt-6">
        <button
          onClick={() => router.push("/acts")}
          className="bg-gray-300 hover:bg-gray-400 text-gray-800 font-semibold py-2 px-4 rounded"
        >
          Назад
        </button>
        <button
          onClick={handleUpdateAct}
          disabled={loading}
          className="bg-blue-500 hover:bg-blue-600 text-white font-semibold py-2 px-4 rounded"
        >
          {loading ? "Збереження..." : "Зберегти"}
        </button>
      </div>
    </div>
  );
}
