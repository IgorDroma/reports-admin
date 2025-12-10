import { useEffect, useState } from "react";
import { supabase } from '../../../lib/supabaseClient';
import { useRouter } from 'next/router'

export default function DonationsImportsPage() {
    const router = useRouter()
    
    const [imports, setImports] = useState([]);
    const [loading, setLoading] = useState(true);
    const [deleting, setDeleting] = useState(null);

    async function loadImports() {
        setLoading(true);

        const { data, error } = await supabase
            .from("donations_imports")
            .select("*")
            .order("created_at", { ascending: false });

        if (error) console.error("Error loading imports", error);

        setImports(data || []);
        setLoading(false);
    }

    async function deleteImport(batchId) {
        if (!confirm("Видалити цей імпорт і всі пов'язані донати?")) return;

        setDeleting(batchId);

        // 1. Викликаємо RPC
        const { error: rpcError } = await supabase.rpc("delete_donation_import", {
            p_batch_id: batchId
        });

        if (rpcError) {
            alert("Помилка RPC: " + rpcError.message);
            console.error(rpcError);
            setDeleting(null);
            return;
        }

        // 2. Видаляємо запис імпорту
        const { error: delError } = await supabase
            .from("donations_imports")
            .delete()
            .eq("batch_id", batchId);

        if (delError) {
            alert("Помилка видалення запису імпорту");
            console.error(delError);
        }

        await loadImports();
        setDeleting(null);
    }

    useEffect(() => {
        loadImports();
    }, []);

    return (
        <div style={{ padding: "30px", maxWidth: "900px", margin: "0 auto" }}>
    <button className="mb-4 underline" onClick={() => router.back()}>
        ← Назад
      </button>
            <h1>Імпорти донатів</h1>

            {loading && <p>Завантаження...</p>}

            {!loading && imports.length === 0 && <p>Імпортів поки немає.</p>}

            {!loading && imports.length > 0 && (
                <table style={{ width: "100%", borderCollapse: "collapse", marginTop: "20px" }}>
                    <thead>
                        <tr>
                            <th style={{ textAlign: "left", padding: "8px" }}>Дата</th>
                            <th style={{ textAlign: "left", padding: "8px" }}>Файл</th>
                            <th style={{ padding: "8px" }}>Успішні</th>
                            <th style={{ padding: "8px" }}>Пропущені</th>
                            <th style={{ padding: "8px" }}>Дія</th>
                        </tr>
                    </thead>
                    <tbody>
                        {imports.map((imp) => (
                            <tr key={imp.id} style={{ borderBottom: "1px solid #ddd" }}>
                                <td style={{ padding: "8px" }}>
                                    {new Date(imp.created_at).toLocaleString("uk-UA")}
                                </td>
                                <td style={{ padding: "8px" }}>{imp.file_name || "-"}</td>
                                <td style={{ padding: "8px", textAlign: "center" }}>{imp.success_count}</td>
                                <td style={{ padding: "8px", textAlign: "center" }}>{imp.failed_count}</td>
                                <td style={{ padding: "8px" }}>
                                    <button
                                        onClick={() => deleteImport(imp.batch_id)}
                                        disabled={deleting === imp.batch_id}
                                        style={{
                                            background: deleting === imp.batch_id ? "#999" : "red",
                                            color: "white",
                                            padding: "6px 12px",
                                            border: "none",
                                            borderRadius: "4px",
                                            cursor: "pointer",
                                        }}
                                    >
                                        {deleting === imp.batch_id ? "Видалення…" : "Видалити"}
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
