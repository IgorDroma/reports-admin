import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { supabase } from "../../../lib/supabaseClient";

/* ================= HELPERS ================= */

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function mapReceiver(rec, recGroup) {
  switch (recGroup) {
    case "Отримувачі благодійної допомоги юр. лица":
      return { allowed: true, receiver: rec };

    case "Індивідуальні ВЧ":
    case "Индивидуальные ВЧ":
      return { allowed: true, receiver: "Військовослужбовець індивідуально" };

    case "Дети и мед. гражданские, старики":
      return { allowed: true, receiver: "Допомога цивільним" };

    default:
      return { allowed: false, receiver: null };
  }
}

function buildActId(rawId, actDate) {
  if (!rawId || !actDate) return rawId;
  const year = new Date(actDate).getFullYear();
  if (String(rawId).startsWith(`${year}-`)) return rawId;
  return `${year}-${rawId}`;
}

/* ================= COMPONENT ================= */

export default function ActsImport() {
  const router = useRouter();

  const [user, setUser] = useState(null);

  const [fileName, setFileName] = useState("");
  const [jsonData, setJsonData] = useState(null);

  const [importing, setImporting] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

  const [progress, setProgress] = useState({
    current: 0,
    total: 0,
    actId: null,
  });

  /* ================= AUTH ================= */

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data?.user ?? null);
    });

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_e, session) => setUser(session?.user ?? null)
    );

    return () => listener?.subscription?.unsubscribe?.();
  }, []);

  if (!user) {
    return <div className="page">Будь ласка, увійдіть у систему.</div>;
  }

  /* ================= FILE ================= */

  async function handleFileChange(e) {
    const file = e.target.files?.[0];
    setError("");
    setResult(null);

    if (!file) {
      setFileName("");
      setJsonData(null);
      return;
    }

    setFileName(file.name);

    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      setJsonData(Array.isArray(parsed) ? parsed : [parsed]);
    } catch (err) {
      setError("Не вдалося прочитати JSON: " + err.message);
      setJsonData(null);
    }
  }

  /* ================= DB HELPERS ================= */

  async function findOrCreateCategory(name) {
  if (!name?.trim()) return null;

  const { data, error } = await supabase
    .from("product_categories")
    .upsert(
      { name: name.trim() },
      { onConflict: "name" }
    )
    .select("id")
    .single();

  if (error) throw error;
  return data.id;
}


  async function findOrCreateProduct(item) {
  const { data, error } = await supabase
    .from("products")
    .upsert(
      {
        id: item.product_id,
        name: item.product_name,
        category_id: item.product_cat
          ? await findOrCreateCategory(item.product_cat)
          : null,
      },
      { onConflict: "id" }
    )
    .select("id")
    .single();

  if (error) throw error;
  return data.id;
}


  /* ================= IMPORT ACT ================= */

  async function importAct(actJson, batchId) {
    const mapped = mapReceiver(actJson.receiver, actJson.receiver_group);
    if (!mapped.allowed) return { skipped: true };

    const actId = buildActId(actJson.id, actJson.date);
    const items = actJson.items || [];

    const total_sum =
      actJson.total_sum ??
      items.reduce((s, it) => s + Number(it.sum || 0), 0);

    const actPayload = {
      id: actId,
      act_date: actJson.date,
      receiver: mapped.receiver,
      total_sum,
      items_count: items.length,
      imported_batch_id: batchId,
    };

    const { data: existing } = await supabase
      .from("acts")
      .select("id")
      .eq("id", actId)
      .limit(1);

    if (!existing?.length) {
      const { error } = await supabase.from("acts").insert(actPayload);
      if (error) throw error;
    } else {
      const { error } = await supabase
        .from("acts")
        .update(actPayload)
        .eq("id", actId);
      if (error) throw error;

      await supabase.from("act_items").delete().eq("act_id", actId);
    }

    /* ===== batch insert items ===== */

    const itemsPayload = [];

    for (const item of items) {
      const productId = await findOrCreateProduct(item);
      const qty = Number(item.qty || 0);
      const sum = Number(item.sum || 0);
      const price = qty ? sum / qty : 0;

      itemsPayload.push({
        act_id: actId,
        product_id: productId,
        qty,
        price,
        sum,
      });
    }

    const CHUNK = 100;
    for (let i = 0; i < itemsPayload.length; i += CHUNK) {
      const chunk = itemsPayload.slice(i, i + CHUNK);
      const { error } = await supabase.from("act_items").insert(chunk);
      if (error) throw error;
    }

    return { skipped: false };
  }

  /* ================= MAIN IMPORT ================= */

  async function handleImport() {
    if (!jsonData?.length) {
      setError("Спочатку завантаж файл JSON");
      return;
    }

    setError("");
    setResult(null);
    setImporting(true);

    setProgress({
      current: 0,
      total: jsonData.length,
      actId: null,
    });

    const batchId = crypto.randomUUID();
    let imported = 0;
    const skipped = [];

    try {
      let index = 0;

      for (const act of jsonData) {
        index++;

        setProgress({
          current: index,
          total: jsonData.length,
          actId: act.id,
        });

        const res = await importAct(act, batchId);
        if (res.skipped) skipped.push(act.id);
        else imported++;

        if (index % 5 === 0) {
          await sleep(100);
        }
      }

      await supabase.from("acts_imports").insert({
        batch_id: batchId,
        file_name: fileName,
        user_id: user.id,
        inserted_count: imported,
        skipped_count: skipped.length,
      });

      setResult({
        imported,
        skipped,
        skipped_count: skipped.length,
      });
    } catch (err) {
      console.error(err);
      setError("Помилка імпорту: " + err.message);
    } finally {
      setImporting(false);
    }
  }

  /* ================= UI ================= */

  return (
    <div className="page">
      <button className="underline mb-3" onClick={() => router.back()}>
        ← Назад
      </button>

      <h1 className="title mb-4">Імпорт актів (JSON)</h1>

      {error && <p className="text-red-600 mb-3">Помилка: {error}</p>}

      <input type="file" accept=".json" onChange={handleFileChange} />
      {fileName && <p className="text-sm">Файл: {fileName}</p>}
      {jsonData && <p className="text-sm">Актів: {jsonData.length}</p>}

      <button
        className="btn-primary mt-3"
        disabled={importing || !jsonData}
        onClick={handleImport}
      >
        {importing ? "Імпорт..." : "Імпортувати"}
      </button>

      {importing && (
        <div className="mt-4 p-3 border rounded bg-gray-50">
          <p>
            Імпорт: {progress.current} / {progress.total}
          </p>
          {progress.actId && <code>{progress.actId}</code>}
          <div className="w-full bg-gray-200 h-2 mt-2 rounded">
            <div
              className="bg-blue-600 h-2 rounded"
              style={{
                width: `${Math.round(
                  (progress.current / progress.total) * 100
                )}%`,
              }}
            />
          </div>
        </div>
      )}

      {result && (
        <div className="mt-4">
          <p>Імпортовано: {result.imported}</p>
          <p>Пропущено: {result.skipped_count}</p>
        </div>
      )}
    </div>
  );
}
