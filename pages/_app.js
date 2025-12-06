// pages/_app.js
import "../styles/globals.css";
import Head from "next/head";

function MyApp({ Component, pageProps }) {
  return (
    <>
      <Head>
        <title>Reports Admin</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      {/* Глобальний фон і базові кольори */}
      <div className="min-h-screen bg-slate-100 text-slate-900">
        <Component {...pageProps} />
      </div>
    </>
  );
}

export default MyApp;
