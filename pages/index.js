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

  .section-description h3 {
    margin: 18px 0 8px;
    font-size: 16px;
    color: #374151;
  }

  .reference-table {
    width: auto;
    margin: 8px 0 14px;
    border-collapse: collapse;
  }

  .reference-table th,
  .reference-table td {
    padding: 7px 12px;
    border: 1px solid #d1d5db;
    text-align: left;
    white-space: nowrap;
  }

  .reference-table th {
    background: #eef0f3;
  }

  .reference-code {
    overflow-x: auto;
    margin: 8px 0 14px;
    padding: 12px 14px;
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    background: #f3f4f6;
    color: #374151;
    font-size: 13px;
    line-height: 1.45;
    white-space: pre;
  }

  .reference-code code {
    font-family: Consolas, Monaco, monospace;
  }

  /* На головній залишаємо заголовки нейтральними, без зайвого синього */
  .title,
  .section-title {
    color: #111827 !important;
  }

  .nav-card {
    color: #374151 !important;
    text-decoration: none;
  }

  .nav-card:hover {
    color: #2563eb !important;
  }

  .info-details {
    margin: 10px 0 18px;
    border: 1px solid #e5e7eb;
    border-radius: 10px;
    background: #f8f9fa;
  }

  .info-details summary {
    cursor: pointer;
    padding: 12px 20px;
    color: #374151;
    font-weight: 600;
    user-select: none;
  }

  .info-details summary:hover {
    background: #f0f4ff;
    color: #2563eb;
  }

  .info-details-content {
    padding: 4px 24px 22px;
  }

  /* Усередині довідки не створюємо другу картку — лише чіткі розділи */
  .info-details-content > .section-description {
    margin: 0;
    padding: 0;
    border: 0;
    border-radius: 0;
    background: transparent;
  }

  .info-details-content > .section-description > p:first-child {
    margin: 8px 0 22px;
    color: #6b7280;
    font-size: 13px;
  }

  .info-details-content .section-description h3 {
    margin: 26px 0 14px;
    padding-bottom: 8px;
    border-bottom: 1px solid #dbe2ea;
    color: #263b57;
    font-size: 18px;
  }

  .info-details-content .section-description h3:first-of-type {
    margin-top: 0;
  }

  .info-details-content .section-description p {
    margin: 12px 0 7px;
  }

  .info-details-content .section-description ul {
    margin: 7px 0 16px;
  }

  .info-details-content .section-description li {
    padding-left: 2px;
    margin-bottom: 8px;
  }

  @media (max-width: 520px) {
    .info-details-content {
      padding: 4px 14px 18px;
    }
  }

  .nav-groups {
    display: flex;
    flex-direction: column;
    gap: 18px;
    margin-bottom: 18px;
  }

  .nav-group {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 16px;
  }

  .nav-group-first {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .nav-group-last {
    grid-template-columns: minmax(0, 1fr);
  }

  @media (max-width: 800px) {
    .nav-group,
    .nav-group-first {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }

  @media (max-width: 520px) {
    .nav-group,
    .nav-group-first,
    .nav-group-last {
      grid-template-columns: 1fr;
    }
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

          {/* REFERENCE INFORMATION */}
          <details className="info-details">
            <summary>📋 Довідкова інформація по місячному звіту (оновлено 26.11.2026)</summary>

            <div className="info-details-content">
              <div className="section-description">
                <h3>Вхід у систему</h3>
                <p>
                  Вхід до системи: <a href="https://act.monstrov.org/" target="_blank" rel="noreferrer">https://act.monstrov.org/</a>.
                  Авторизуйтеся через основну корпоративну пошту.
                </p>

                <p>
                  vercel.com - server<br />
                  supabase.com - bd
                </p>

                <h3>Загальна примітка щодо імпорту</h3>
                <p>
                  Якщо під час імпорту завантажили неправильні дані або потрібно
                  замінити вже імпортовані дані, найпростіше видалити відповідний
                  імпорт і завантажити потрібний файл із виправленнями. Це також
                  можна зробити через Supabase, але такий спосіб складніший.
                </p>

                <h3>Надходження коштів</h3>

                <p><strong>Дані</strong></p>
                <ul>
                  <li><strong>Банки:</strong> дані від бухгалтерії. Кожен банк імпортується окремо — один файл за раз, із вибором банку в адмінці. <strong>Банк Південний:</strong> у файлі зазвичай є платіж із призначенням «Перерахування». Зверніть на нього увагу та змініть призначення цього платежу у файлі так, щоб у ньому не було слова «Перерахування», і лише після цього імпортуйте файл.</li>
                  <li>
                    <strong>Monobank:</strong> усі файли з папки на Google Диску
                    <strong> Monobank_autosave</strong> імпортуються разом, окремим імпортом.
                    Для звіту за календарний місяць потрібно брати дані з 2 числа
                    звітного місяця по 1 число наступного включно, оскільки у файлах
                    містяться дані за попередній день.
                  </li>
                  <li>
                    <strong>Примітка:</strong> рахунок 2998 — адміністративний рахунок.
                  </li>
                </ul>

                <p><strong>Внесення даних</strong></p>
                <p>
                  Нижче наведені назви та послідовність колонок, які повинні бути
                  в таблицях надходжень.
                </p>
                <ul>
                  <li>
                    <strong>Надходження у гривні:</strong> Дата, Час, Валюта, Сума,
                    Призначення.
                    <br />
                    Окремої колонки «Час» може не бути, якщо дата вже містить час.
                  </li>
                  <li>
                    <strong>Надходження в валюті:</strong> Дата, Час, Валюта, Сума,
                    Валюта, Сума, Призначення.
                    <br />
                    Окремої колонки «Час» може не бути, якщо дата вже містить час.
                    <strong>Важливо: має значення лише порядок валют</strong> —
                    спочатку UAH і сума в гривні, потім оригінальна валюта та сума в ній.
                    Порядок інших колонок не має значення. Для надходжень лише в одній
                    валюті порядок колонок також не має значення.
                  </li>
                </ul>
                <p>
                  <strong>Приклади значень колонки «Валюта»:</strong>{" "}
                  UAH, EUR, USD тощо.
                </p>

                <p>
                  <strong>Виключення:</strong> рядки не додаються до звіту,
                  якщо призначення платежу починається з таких фраз:
                </p>
                <ul>
                  <li>перерахува…</li>
                  <li>покриття за проведені трансакції згідно договору еквайринга</li>
                  <li>
                    платежі, призначення яких починається зі слів «благодійний платіж на »
                    та містить фразу «згiдно реєстру» (зазвичай це стосується Monobank).
                  </li>
                </ul>

                <h3>Вигрузка з BAS</h3>

                <p><strong>Майнові надходження</strong></p>
                <ul>
                  <li>
                    Склад → Додаткові обробки → Експорт оприбуткування в JSON.
                  </li>
                  <li>Файл: <strong>property_acts</strong>.</li>
                </ul>

                <p><strong>Передача благодійної допомоги</strong></p>
                <ul>
                  <li>
                    <strong>Акти видачі:</strong> Продажі → Додаткові обробки →
                    Вивантаження расходних накладних.
                  </li>
                  <li>Файл: <strong>act</strong>.</li>
                  <li>
                    <strong>Видача основних засобів:</strong> ОЗ і НМА →
                    Додаткові обробки → Вивантаження передачі ОС.
                  </li>
                </ul>
                <p>
                  <strong>Грошові перекази та інші передачі, яких немає у вивантаженні BAS:</strong>{" "}
                  створіть окремий файл за зразком вивантаження з BAS, додайте до нього
                  потрібні дані та імпортуйте цей файл через адмінку.
                </p>
                <p>Приклад структури такого файлу:</p>
                <pre className="reference-code"><code>{`[
  {
    "id": "0930-000001",
    "date": "2026-09-30T12:00:00",
    "receiver": "ГО Аутизм. Крок на зустріч",
    "receiver_group": "Отримувачі благодійної допомоги юр. лица",
    "receiver_type": "Юридична особа",
    "total_sum": 50000,
    "items": [
      {
        "product_name": "Допомога",
        "product_id": "09-00006730",
        "qty": 1,
        "price": 50000,
        "sum": 50000,
        "product_cat": "Діти"
      }
    ]
  }
]`}</code></pre>
                <p>
                  <strong>Примітка щодо назв товарів:</strong> якщо потрібно
                  приховати назву товару, у файлі імпорту замініть її на формулювання,
                  наприклад: «Інформація прихована відповідно до умов договору з виробником».
                </p>
                <p>
                  <strong>Якщо BAS не виконує вивантаження через помилку:</strong>{" "}
                  відкрийте збережений файл, подивіться, на якому «акті» виникла
                  помилка, виправте її та повторіть вивантаження.
                </p>

                <h3>Адміністративні витрати</h3>
                <ul>
                  <li>Дані від бухгалтерії.</li>
                  <li>Вносити тільки загальну суму.</li>
                </ul>

                <h3>Щомісячні галереї</h3>
                <ol>
                  <li>
                    Спочатку завантажте зображення галереї на сайт через
                    <strong> Медіатеку WordPress</strong>.
                  </li>
                  <li>
                    Під час завантаження скопіюйте посилання на кожен файл —
                    воно відображається після завантаження зображення.
                  </li>
                  <li>
                    Після цього відкрийте розділ <strong>«Щомісячні галереї»</strong>
                    в адмінці та додайте галерею, використовуючи скопійовані
                    посилання на зображення.
                  </li>
                </ol>

                <h3>PayPal</h3>
                <p>Приклад структури таблиці:</p>
                <table className="reference-table">
                  <thead>
                    <tr>
                      <th>Дата</th>
                      <th>Час</th>
                      <th>Сума</th>
                      <th>Валюта</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>01.08.2026</td>
                      <td>11:29:57</td>
                      <td>15.00</td>
                      <td>EUR</td>
                    </tr>
                  </tbody>
                </table>

                <h3>Публікація звіту</h3>
                <p>
                  Після того як усі дані завантажено, перейдіть у розділ
                  «Публікація звітів» та опублікуйте звіт.
                </p>

                <p>
                  <strong>Де знайти приклади:</strong> приклад звіту, файлів імпорту
                  та інші зразки можна знайти на корпоративному Google Диску
                  в папці «звіти».
                </p>
              </div>
            </div>
          </details>

          {/* NAVIGATION */}
          <div className="nav-groups">
            <div className="nav-group nav-group-first">
              <a href="/admin/reports" className="nav-card">
                📅 Публікація звітів
              </a>

              <a href="/admin/gallery" className="nav-card">
                📅 Щомісячні галереї
              </a>
            </div>

            <div className="nav-group">
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
            </div>

            <div className="nav-group nav-group-last">
              <a href="/admin/paypal" className="nav-card">
                💰 PayPal
              </a>
            </div>
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
