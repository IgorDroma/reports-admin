import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

const styles = `
  .section-description {
    margin: 10px 0 10px;
    padding: 10px 20px;
    background: #f8f9fa;
    border: 1px solid #e5e7eb;
    border-radius: 10px;
    color: #4b5563;
    font-size: 14px;
    line-height: 1.5;
  }

  .section-description p {
    margin: 10px 0 5px;
  }

  .section-description ul {
    margin: 5px 0 10px;
    padding-left: 22px;
  }

  .section-description li {
    margin-bottom: 6px;
  }

  .section-description strong {
    color: #111827;
  }
`;

export default function Home() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data?.user ?? null);
    });

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user ?? null);
      }
    );

    return () => listener?.subscription?.unsubscribe?.();
  }, []);

  const signIn = async () => {
    await supabase.auth.signInWithOAuth({
      provider: "google",
    });
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
  };

  return (
    <div className="page">
      <style>{styles}</style>

      {/* HEADER */}
      <div className="header">
        <div className="title">MCORP Reports Admin</div>

        {user && (
          <div className="user-box">
            <span className="user-email">{user.email}</span>

            <button onClick={signOut} className="btn-light btn-sm">
              Вийти
            </button>
          </div>
        )}
      </div>

      {/* LOGIN SCREEN */}
      {!user ? (
        <div className="card center">
          <p className="text-lg mb-2">
            Увійдіть, щоб продовжити:
          </p>

          <button onClick={signIn} className="btn-primary btn-lg">
            Увійти через Google
          </button>
        </div>
      ) : (
        <div className="card">
          <p className="section-title">Розділи</p>

          {/* DESCRIPTION */}
          <div className="section-description">
            <p>
              vercel.com - server<br />
            supabase.com - bd
            </p>
            
            <p>
              <strong>Надходження коштів</strong>
            </p>

            <ul>
              <li>
                По банках — дані від бухгалтерії.
              </li>

              <li>
                Monobank — файли з папки на Google Диску,
                обробляються скриптом.
              </li>

              <li>
                <strong>Надходження у гривні:</strong>{" "}
                Дата/Час, Валюта, Сума, Призначення.
                <br />
                Дата та час можуть зберігатися в одній колонці.
              </li>

              <li>
                <strong>Надходження в валюті:</strong>{" "}
                Дата/Час, Валюта, Сума, Валюта, Сума, Призначення.
                <br />
                Перша валюта та сума — в UAH, друга валюта
                та сума — в оригінальній валюті.
              </li>

            </ul>

            <p>
              <strong>Майнові надходження</strong>
            </p>

            <ul>
              <li>
                Вигрузка з BAS.
              </li>
            </ul>

            <p>
              <strong>Передача благодійної допомоги</strong>
            </p>

            <ul>
              <li>
                Вигрузка з BAS (Акти видачі, Видача основних засобів).
              </li>
            </ul>

            <p>
              <strong>Адміністративні витрати</strong>
            </p>

            <ul>
              <li>
                Дані від бухгалтерії.
              </li>
            </ul>

            <p>
              <strong>PayPal</strong>
            </p>

            <ul>
              <li>
                Таблиця з двома колонками.
              </li>
            </ul>
          </div>

          {/* NAVIGATION */}
          <div className="nav-grid">
            <a href="/admin/reports" className="nav-card">
              📅 Публікація звітів
            </a>

            <a href="/admin/donations" className="nav-card">
              💰 Надходження коштів
            </a>

            <a href="/admin/property-acts" className="nav-card">
              📦 Майнові надходження
            </a>

            <a href="/admin/acts" className="nav-card">
              📄 Акти видачі
            </a>

            <a href="/admin/expenses" className="nav-card">
              💰 Адміністративні витрати
            </a>

            <a href="/admin/gallery" className="nav-card">
              📅 Щомісячні галереї
            </a>

            <a href="/admin/paypal" className="nav-card">
              💰 PayPal
            </a>
          </div>

            <div className="section-description">

            <p>
            Оновлення шаблону через phpmyadmin якщо злетіло меню в англійській мові
            </p>
            <p>
              UPDATE mo_postmeta
            SET meta_value = 'wp-custom-template-2'
              WHERE post_id = 942
                AND meta_key = '_wp_page_template';
            </p>
            </div>
        </div>
      )}
    </div>
  );
}
