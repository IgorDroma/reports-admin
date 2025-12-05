// pages/admin/act/[id].js

import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";

export default function ActEdit() {
  const router = useRouter();
  const { id } = router.query;

  const [user, setUser] = useState(null);

  const [act, setAct] = useState(null);
  const [items, setItems] = useState([]);
  const [products, setProducts] = useState([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  // Додавання нового товару
  const [newItem, setNewItem] = useState({
    product_id: "",
    qty: "",
    price: "",
  });

  // ---------------------------
  // AUTH
  // ---------------------------
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data?.user ?? null));
    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, session) => setUser(session?.user ?? null)
    );
    return () => listener?.subscription?.unsubscribe?.();
  }, []);

  // ---------------------------
  // LOAD ACT + ITEMS
  // ---------------------------
  useEffect(() => {
    if (!user || !id) return;
    loadAct();
    loadProducts();
  }, [user, id]);

  async function loadAct() {
    setLoading(true);
    setError(null);

    try {
      const { data: actData, error: actError } = await supabase
        .from("acts")
        .select("*")
        .eq("id", id)
        .single();

      if (actError) throw actError;

      // load items with JOIN → products + categories
      const { data: itemsData, error: itemErr } = await supabase
        .from("act_items")
        .select(
          `
          id,
          qty,
          price,
          sum,
          products (
            id,
            name,
            product_categories ( name )
          )
        `
        )
        .eq("act_id", id)
        .order("created_at", { ascending: true });

      if (itemErr) throw itemErr;

      actData.photo_urls = actData.photo_urls || [];

      const mapped = (itemsData || []).map((i) => ({
        id: i.id,
        qty: i.qty,
        price: i.price,
        sum: i.sum,
        product_id: i.products?.id,
        product_name: i.products?.name,
        category: i.products?.product_categories?.name || "",
      }));

      setAct(actData);
      setItems(mapped);
    } catch (err) {
      console.error(err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function loadProducts() {
    const { data } = await supabase
      .from("products")
      .select("id, name")
      .order("name");

    setProducts(data || []);
  }

  // ---------------------------
  // DELETE ACT
  // ---------------------------
  async function deleteAct() {
    if (!confirm("Видалити акт разом з товарами?")) return;

    const { error } = await supabase.from("acts").delete().eq("id", id);
    if (error) {
      alert("Помилка");
      return;
    }
    router.push("/admin/acts");
  }

  // ---------------------------
  // SAVE ACT
  // ---------------------------
  async function saveAct(e) {
    e.preventDefault();
    setSaving(true);

    const { error } = await supabase
      .from("acts")
      .update({
        act_date: act.act_date,
        receiver: act.receiver,
        total_sum: act.total_sum,
        photo_urls: act.photo_urls,
      })
      .eq("id", id);

    if (error) setError(error.message);

    setSaving(false);
    loadAct();
  }

  // ---------------------------
  // UPLOAD MULTIPLE PHOTOS
  // ---------------------------
  async function handleMultiPhotoUpload(e) {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploadingPhoto(true);

    try {
      const urls = [...act.photo_urls];

      for (const f of files) {
        const ext = f.name.split(".").pop();
        const name = `${id}-${Date.now()}-${Math.random()
          .toString(36)
          .slice(2)}.${ext}`;
        const path = `${id}/${name}`;

        const { error: uploadErr } = await supabase.storage
          .from("acts-files")
          .upload(path, f);

        if (uploadErr) throw uploadErr;

        const { data } = supabase.storage
          .from("acts-files")
          .getPublicUrl(path);

        urls.push(data.publicUrl);
      }

      await supabase.from("acts").update({ photo_urls: urls }).eq("id", id);
      loadAct();
    } catch (err) {
      setError(err.message);
    }

    setUploadingPhoto(false);
  }

  // ---------------------------
  // DELETE PHOTO
  // ---------------------------
  async function deletePhoto(url) {
    if (!confirm("Видалити фото?")) return;

    const path = url.split("/storage/v1/object/public/acts-files/")[1];
    await supabase.storage.from("acts-files").remove([path]);

    const newUrls = act.photo_urls.filter((u) => u !== url);
    await supabase.from("acts").update({ photo_urls: newUrls }).eq("id", id);

    loadAct();
  }

  // ---------------------------
  // ADD ITEM
  // ---------------------------
  async function addItem(e) {
    e.preventDefault();

    if (!newItem.product_id || !newItem.qty) {
      setError("Оберіть товар та введіть кількість");
      return;
    }

    const price = Number(newItem.price || 0);
    const qty = Number(newItem.qty);
    const sum = price * qty;

    const { error } = await supabase.from("act_items").insert({
      act_id: id,
      product_id: newItem.product_id,
      qty,
      price,
      sum,
    });

    if (error) {
      setError(error.message);
      return;
    }

    setNewItem({ product_id: "", qty: "", price: "" });
    loadAct();
  }

  // ---------------------------
  // DELETE ITEM
  // ---------------------------
  async function deleteItem(itemId) {
    if (!confirm("Видалити товар?")) return;

    await supabase.from("act_items").delete().eq("id", itemId);
    loadAct();
  }

  // ---------------------------
  // UI
  // ---------------------------
  if (!user) return <div>Авторизація...</div>;
  if (loading || !act) return <div>Завантаження...</div>;

  return (
    <div className="max-w-3xl mx-auto p-6">
      <button onClick={() => router.back()} className="underline mb-4">
        ← Назад
      </button>

      <h1 className="text-2xl font-bold mb-4">Редагування акту {id}</h1>

      <button
        onClick={deleteAct}
        className="bg-red-500 text-white px-4 py-2 rounded mb-6"
      >
        Видалити акт
      </button>

      {/* --- ACT INFO FORM --- */}
      <form onSubmit={saveAct} className="space-y-3 mb-6">

        <div>
          <label>Дата</label>
          <input
            type="date"
            value={act.act_date || ""}
            onChange={(e) => setAct({ ...act, act_date: e.target.value })}
            className="w-full border rounded px-2 py-1"
          />
        </div>

        <div>
          <label>Отримувач</label>
          <input
            type="text"
            value={act.receiver || ""}
            onChange={(e) => setAct({ ...act, receiver: e.target.value })}
            className="w-full border rounded px-2 py-1"
          />
        </div>

        <button
          className="bg-blue-500 text-white px-4 py-2 rounded"
          disabled={saving}
        >
          {saving ? "Збереження..." : "Зберегти"}
        </button>
      </form>

      {/* --- PHOTOS --- */}

      <h2 className="text-lg font-semibold mb-2">Фото акту</h2>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
        {act.photo_urls.map((url, i) => (
          <div key={i} className="border rounded p-2">
            <a href={url} target="_blank">
              <img src={url} className="max-h-40 w-full object-cover" />
            </a>
            <button
              className="text-red-500 underline text-sm mt-1"
              onClick={() => deletePhoto(url)}
            >
              Видалити
            </button>
          </div>
        ))}
      </div>

      <input
        type="file"
        multiple
        onChange={handleMultiPhotoUpload}
        disabled={uploadingPhoto}
      />

      {/* --- ITEMS --- */}
      <h2 className="text-lg font-semibold mt-6 mb-2">Товари</h2>

      <table className="w-full text-sm border mb-4">
        <thead>
          <tr className="bg-gray-100">
            <th className="px-2 py-1 text-left">Назва</th>
            <th className="px-2 py-1 text-left">Категорія</th>
            <th className="px-2 py-1 text-right">Кількість</th>
            <th className="px-2 py-1 text-right">Сума</th>
            <th className="px-2 py-1 text-right">Дії</th>
          </tr>
        </thead>
        <tbody>
          {items.map((it) => (
            <tr key={it.id} className="border-t">
              <td className="px-2 py-1">{it.product_name}</td>
              <td className="px-2 py-1">{it.category}</td>
              <td className="px-2 py-1 text-right">{it.qty}</td>
              <td className="px-2 py-1 text-right">{it.sum}</td>
              <td className="px-2 py-1 text-right">
                <button
                  className="text-red-500 underline text-xs"
                  onClick={() => deleteItem(it.id)}
                >
                  Видалити
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* --- ADD ITEM --- */}
      <form onSubmit={addItem} className="grid grid-cols-1 md:grid-cols-4 gap-3">

        <div>
          <label>Товар</label>
          <select
            className="w-full border rounded px-2 py-1"
            value={newItem.product_id}
            onChange={(e) =>
              setNewItem({ ...newItem, product_id: e.target.value })
            }
          >
            <option value="">Оберіть товар</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label>Кількість</label>
          <input
            type="number"
            className="w-full border rounded px-2 py-1"
            value={newItem.qty}
            onChange={(e) => setNewItem({ ...newItem, qty: e.target.value })}
          />
        </div>

        <div>
          <label>Ціна</label>
          <input
            type="number"
            className="w-full border rounded px-2 py-1"
            value={newItem.price}
            onChange={(e) => setNewItem({ ...newItem, price: e.target.value })}
          />
        </div>

        <div className="flex items-end">
          <button className="bg-green-600 text-white px-4 py-2 rounded w-full">
            Додати
          </button>
        </div>
      </form>
    </div>
  );
}
