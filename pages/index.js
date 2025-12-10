import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

export default function Home() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data?.user ?? null);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => listener?.subscription?.unsubscribe?.();
  }, []);

  const signIn = async () => {
    await supabase.auth.signInWithOAuth({ provider: "google" });
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
  };

  return (
    <div className="page">

      {/* HEADER */}
      <div className="header">
        <div className="title">MCORP Reports Admin</div>

        {user && (
          <div className="user-box">
            <span className="user-email">{user.email}</span>
            <button onClick={signOut} className="btn-light btn-sm">Вийти</button>
          </div>
        )}
      </div>

      {/* LOGIN SCREEN */}
      {!user ? (
        <div className="card center">
          <p className="text-lg mb-2">Увійдіть, щоб продовжити:</p>

          <button onClick={signIn} className="btn-primary btn-lg">
            Увійти через Google
          </button>
        </div>
      ) : (
        <div className="card">
          <p className="section-title">Розділи</p>

          <div className="nav-grid">
            <a href="/admin/acts" className="nav-card">📄 Переглянути акти</a>
            <a href="/admin/donations" className="nav-card">💰 Переглянути донати</a>
          </div>
        </div>
      )}
    </div>
  );
}
