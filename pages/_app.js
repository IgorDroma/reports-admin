import Head from "next/head";

function MyApp({ Component, pageProps }) {
  return (
    <>
      <Head>
        <!-- Підключення Tailwind через Play CDN -->
        <script src="https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4"></script>
      </Head>
      <Component {...pageProps} />
    </>
  );
}

export default MyApp;
