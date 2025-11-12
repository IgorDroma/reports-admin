import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

export default function ActsPage() {
  const [acts, setActs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedAct, setSelectedAct] = useState(null);
  const [pdfFile, setPdfFile] = useState(null);
  const [photoFile, setPhotoFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    loadActs();
  }, []);

  const loadActs = async () => {
    setLoading(true);
    const { data, error } = await supabase.from("acts").select("*").order("date", { ascending: false });
    if (error) console.error(error);
    else setActs(data);
    setLoading(false);
  };

  const handleEdit = (act) => {
    setSelectedAct({ ...act });
    setPdfFile(null);
    setPhotoFile(null);
  };

  const handleSave = async () => {
    if (!selectedAct) return;
    setSaving(true);

    let pdfUrl = selectedAct.pdf_url;
    let photoUrl = selectedAct.photo_url;

    // якщо завантажено новий PDF
    if (pdfFile) {
      const { data, error } = await supabase.storage
        .from("acts-files")
        .upload(`pdfs/${Date.now()}_${pdfFile.name}`, pdfFile, { upsert: true });
      if (error) alert(error.message);
      else pdfUrl = data.path;
    }

    // якщо завантажено нове фото
    if (photoFile) {
      const { data, error } = await supabase.storage
        .from("acts-files")
        .upload(`photos/${Date.now()}_${photoFile.name}`, photoFile, { upsert: true });
      if (error) alert(error.message);
      else photoUrl = data.path;
    }

    const { error } = await supabase
      .from("acts")
      .update({
        date: selectedAct.date,
        amount: selectedAct.amount,
        receiver: selectedAct.receiver,
        act_number: selectedAct.act_number,
        pdf_url: pdfUrl,
        photo_url: photoUrl,
      })
      .eq("id", selectedAct.id);

    if (error) alert(error.message);
    else {
      await loadActs();
      setSelectedAct(null);
    }

    setSaving(false);
  };

  const handleDelete = async () => {
    if (!selectedAct) return;
    if (!confirm("Видалити цей акт?")) return;
    setDeleting(true);

    const { error } = await supabase.from("acts").delete().eq("id", selectedAct.id);
    if (error) alert(error.message);
    else {
      await loadActs();
      setSelectedAct(null);
    }

    setDeleting(false);
  };

  const publicUrl = (path) => {
    if (!path) return null;
    const { data } = supabase.storage.from("acts-files").getPublicUrl(path);
    return data.publicUrl;
  };

  if (loading) return <p className="p-4">Завантаження...</p>;

  return (
    <div className="p-6">
      <h1 className="text-2xl mb-4">Акти видачі</h1>
      <table className="min-w-full border">
        <thead>
          <tr className="bg-gray-100">
            <th className="border p-2">Дата</th>
            <th className="border p-2">Сума</th>
            <th className="border p-2">Отримувач</th>
            <th className="border p-2">№ Акту</th>
            <th className="border p-2">PDF</th>
            <th className="border p-2">Фото</th>
            <th className="border p-2">Дії</th>
          </tr>
        </thead>
        <tbody>
          {acts.map((act) => (
            <tr key={act.id}>
              <td className="border p-2">{act.date}</td>
              <td className="border p-2">{act.amount}</td>
              <td className="border p-2">{act.receiver}</td>
              <td className="border p-2">{act.act_number}</td>
              <td className="border p-2 text-center">
                {act.pdf_url ? (
                  <a href={publicUrl(act.pdf_url)} target="_blank" className="text-blue-600 hover:underline">
                    PDF
                  </a>
                ) : (
                  "-"
                )}
              </td>
              <td className="border p-2 text-center">
                {act.photo_url ? (
                  <img src={publicUrl(act.photo_url)} alt="Фото" className="h-12 mx-auto rounded" />
                ) : (
                  "-"
                )}
              </td>
              <td className="border p-2 text-center">
                <button
                  onClick={() => handleEdit(act)}
                  className="text-blue-600 hover:underline"
                >
                  Редагувати
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* МОДАЛЬНЕ ВІКНО */}
      {selectedAct && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
          <div className="bg-white p-6 rounded-lg shadow-lg w-full max-w-lg relative">
            <h2 className="text-xl mb-4">Редагування акту #{selectedAct.act_number}</h2>

            <div className="space-y-3">
              <input
                type="date"
                value={selectedAct.date || ""}
                onChange={(e) => setSelectedAct({ ...selectedAct, date: e.target.value })}
                className="border p-2 w-full"
              />
              <input
                type="number"
                placeholder="Сума"
                value={selectedAct.amount || ""}
                onChange={(e) => setSelectedAct({ ...selectedAct, amount: e.target.value })}
                className="border p-2 w-full"
              />
              <input
                type="text"
                placeholder="Отримувач"
                value={selectedAct.receiver || ""}
                onChange={(e) => setSelectedAct({ ...selectedAct, receiver: e.target.value })}
                className="border p-2 w-full"
              />
              <input
                type="text"
                placeholder="№ Акту"
                value={selectedAct.act_number || ""}
                onChange={(e) => setSelectedAct({ ...selectedAct, act_number: e.target.value })}
                className="border p-2 w-full"
              />

              <div>
                <label className="block font-medium">PDF файл:</label>
                {selectedAct.pdf_url && (
                  <a
                    href={publicUrl(selectedAct.pdf_url)}
                    target="_blank"
                    className="text-blue-600 underline"
                  >
                    Переглянути
                  </a>
                )}
                <input type="file" accept="application/pdf" onChange={(e) => setPdfFile(e.target.files[0])} />
              </div>

              <div>
                <label className="block font-medium">Фото:</label>
                {selectedAct.photo_url && (
                  <img
                    src={publicUrl(selectedAct.photo_url)}
                    alt="Фото"
                    className="h-20 rounded mb-2"
                  />
                )}
                <input type="file" accept="image/*" onChange={(e) => setPhotoFile(e.target.files[0])} />
              </div>
            </div>

            <div className="mt-5 flex justify-between">
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
              >
                {deleting ? "Видалення..." : "Видалити акт"}
              </button>

              <div className="flex gap-2">
                <button
                  onClick={() => setSelectedAct(null)}
                  className="bg-gray-300 px-4 py-2 rounded hover:bg-gray-400"
                >
                  Закрити
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
                >
                  {saving ? "Збереження..." : "Зберегти"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
