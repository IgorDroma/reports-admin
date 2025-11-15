import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient"; // заміни шлях якщо інший

export default function EditActPage() {
  const router = useRouter();
  const { id } = router.query;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [act, setAct] = useState({
    date: "",
    amount: "",
    act_number: "",
    receiver: "",
    pdf_url: "",
    photo_url: "",
  });

  // -------------------------------
  // LOAD DATA
  // -------------------------------
  useEffect(() => {
    if (!id) return;
    loadAct();
  }, [id]);

  async function loadAct() {
    setLoading(true);
    const { data, error } = await supabase
      .from("acts")
      .select("*")
      .eq("id", id)
      .single();

    if (error) console.error(error);
    else setAct(data);

    setLoading(false);
  }

  // -----------------------------------
  // UPDATE ACT
  // -----------------------------------
  async function handleUpdate() {
    setSaving(true);

    const { error } = await supabase
      .from("acts")
      .update({
        date: act.date,
        amount: act.amount,
        act_number: act.act_number,
        receiver: act.receiver,
        pdf_url: act.pdf_url,
        photo_url: act.photo_url,
      })
      .eq("id", id);

    setSaving(false);

    if (error) {
      console.error(error);
      alert("Помилка при оновленні");
    } else {
      router.push("/acts");
    }
  }

  // -----------------------------------
  // DELETE ACT
  // -----------------------------------
  async function handleDelete() {
    if (!confirm("Точно видалити документ?")) return;

    setDeleting(true);

    const { error } = await supabase.from("acts").delete().eq("id", id);

    setDeleting(false);

    if (error) {
      console.error(error);
      alert("Помилка при видаленні");
    } else {
      router.push("/acts");
    }
  }

  // -----------------------------------
  // FILE UPLOAD HANDLER
  // -----------------------------------
  async function handleFileUpload(e, type) {
    const file = e.target.files[0];
    if (!file) return;

    const fileExt = file.name.split(".").pop();
    const fileName = `${id}-${type}.${fileExt}`;
    const filePath = `${type}/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from("acts-files")
      .upload(filePath, file, {
        upsert: true,
      });

    if (uploadError) {
      console.error(uploadError);
      alert("Помилка завантаження файлу");
      return;
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from("acts-files").getPublicUrl(filePath);

    setAct((prev) => ({ ...prev, [`${type}_url`]: publicUrl }));
  }

  if (loading) return <p className="p-4">Завантаження...</p>;

  return (
    <div className="max-w-2xl mx-auto p-5">
      <h1 className="text-2xl font-bold mb-5">Редагувати акт</h1>

      {/* Date */}
      <div className="mb-4">
        <label className="block mb-1 font-medium">Дата</label>
        <input
          type="date"
          className="border p-2 rounded w-full"
          value={act.date || ""}
          onChange={(e) => setAct({ ...act, date: e.target.value })}
        />
      </div>

      {/* Act number */}
      <div className="mb-4">
        <label className="block mb-1 font-medium">Номер акту</label>
        <input
          type="text"
          className="border p-2 rounded w-full"
          value={act.act_number || ""}
          onChange={(e) => setAct({ ...act, act_number: e.target.value })}
        />
      </div>

      {/* Receiver */}
      <div className="mb-4">
        <label className="block mb-1 font-medium">Отримувач</label>
        <input
          type="text"
          className="border p-2 rounded w-full"
          value={act.receiver || ""}
          onChange={(e) => setAct({ ...act, receiver: e.target.value })}
        />
      </div>

      {/* Amount */}
      <div className="mb-4">
        <label className="block mb-1 font-medium">Сума</label>
        <input
          type="number"
          className="border p-2 rounded w-full"
          value={act.amount || ""}
          onChange={(e) => setAct({ ...act, amount: e.target.value })}
        />
      </div>

      {/* File: PDF */}
      <div className="mb-4">
        <label className="block mb-1 font-medium">PDF</label>

        {act.pdf_url && (
          <a
            href={act.pdf_url}
            target="_blank"
            className="text-blue-600 underline block mb-2"
          >
            Переглянути PDF
          </a>
        )}

        <input
          type="file"
          accept="application/pdf"
          onChange={(e) => handleFileUpload(e, "pdf")}
          className="block"
        />
      </div>

      {/* File: Photo */}
      <div className="mb-4">
        <label className="block mb-1 font-medium">Фото</label>

        {act.photo_url && (
          <img
            src={act.photo_url}
            className="max-h-40 rounded mb-2 border"
            alt="preview"
          />
        )}

        <input
          type="file"
          accept="image/*"
          onChange={(e) => handleFileUpload(e, "photo")}
          className="block"
        />
      </div>

      {/* Buttons */}
      <div className="flex gap-4 mt-6">
        <button
          onClick={handleUpdate}
          disabled={saving}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          {saving ? "Збереження..." : "Зберегти"}
        </button>

        <button
          onClick={handleDelete}
          disabled={deleting}
          className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
        >
          {deleting ? "Видалення..." : "Видалити"}
        </button>
      </div>
    </div>
  );
}
