import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabaseClient";
import { FileHelper } from "../../lib/fileHelper";
import { useRouter } from "next/router";

export default function ActEditPage() {
  const router = useRouter();
  const { id } = router.query;
  const [act, setAct] = useState(null);

  useEffect(() => {
    if (id) fetchAct();
  }, [id]);

  async function fetchAct() {
    const { data, error } = await supabase.from("acts").select("*").eq("id", id).single();
    if (error) console.error(error);
    else setAct(data);
  }

  async function handleUpdateAct() {
    const { error } = await supabase
      .from("acts")
      .update({
        date: act.date,
        act_number: act.act_number,
        receiver: act.receiver,
        amount: act.amount,
      })
      .eq("id", act.id);
    if (error) console.error(error);
    else router.push("/acts");
  }

  async function handleUpload(type, file) {
    if (!file) return;
    try {
      const folder = type === "pdf" ? "pdfs" : "photos";
      const { url } = await FileHelper.uploadFile(file, folder, act.act_number);
      await supabase.from("acts").update({ [`${type}_url`]: url }).eq("id", act.id);
      setAct({ ...act, [`${type}_url`]: url });
    } catch (err) {
      alert(err.message);
    }
  }

  async function handleDelete(type) {
    const url = act[`${type}_url`];
    if (!url) return;
    try {
      await FileHelper.deleteFile(url);
      await supabase.from("acts").update({ [`${type}_url`]: null }).eq("id", act.id);
      setAct({ ...act, [`${type}_url`]: null });
    } catch (err) {
      alert(err.message);
    }
  }

  if (!act) return <div>Loading...</div>;

  return (
    <div className="p-6 max-w-lg mx-auto">
      <h1 className="text-2xl font-bold mb-4">Редагування акту №{act.act_number}</h1>

      {["date", "act_number", "receiver", "amount"].map((field) => (
        <div key={field} className="mb-2">
          <label className="block font-medium capitalize">{field}</label>
          <input
            type={field === "date" ? "date" : field === "amount" ? "number" : "text"}
            value={act[field] || ""}
            onChange={(e) => setAct({ ...act, [field]: e.target.value })}
            className="border p-1 w-full rounded"
          />
        </div>
      ))}

      {["pdf", "photo"].map((type) => (
        <div key={type} className="mb-2">
          <label className="block font-medium">{type.toUpperCase()}</label>
          {act[`${type}_url`] && (
            <div className="flex items-center space-x-2 mb-1">
              <a href={act[`${type}_url`]} target="_blank" rel="noopener noreferrer" className="text-blue-500 underline">
                Поточний {type}
              </a>
              <button onClick={() => handleDelete(type)} className="text-red-500 hover:text-red-700">
                Видалити
              </button>
            </div>
          )}
          <input
            type="file"
            accept={type === "pdf" ? "application/pdf" : "image/*"}
            onChange={(e) => handleUpload(type, e.target.files[0])}
            className="border p-1 w-full rounded"
          />
        </div>
      ))}

      <div className="flex space-x-2 mt-4">
        <button onClick={() => router.push("/acts")} className="bg-gray-300 hover:bg-gray-400 px-4 py-2 rounded">
          Назад
        </button>
        <button onClick={handleUpdateAct} className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded">
          Зберегти
        </button>
      </div>
    </div>
  );
}
