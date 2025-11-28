import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

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
    await supabase.auth.signInWithOAuth({ provider: "google" });
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
  };

  return (
    <div className="max-w-3xl mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Reports Admin</h1>

        {user && (
          <div className="flex items-center space-x-3">
            <span className="text-sm text-gray-600">
              Logged in as <span className="font-medium">{user.email}</span>
            </span>
            <button
              onClick={signOut}
              className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded-lg text-sm font-medium"
            >
              Sign out
            </button>
          </div>
        )}
      </div>

      {!user ? (
        <div className="mt-10 bg-white shadow p-6 rounded-xl text-center">
          <p className="text-gray-700 mb-4">To continue, sign in with Google:</p>
          <button
            onClick={signIn}
            className="px-5 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium shadow"
          >
            Sign in with Google
          </button>
        </div>
      ) : (
        <div className="mt-10 bg-white shadow p-6 rounded-xl">
          <p className="text-gray-700 mb-3 font-medium">Go to:</p>
          <div className="flex flex-col space-y-3">
            <a
              href="/admin/acts"
              className="px-4 py-3 bg-blue-50 hover:bg-blue-100 rounded-lg font-medium text-blue-700 shadow-sm"
            >
              Переглянути акти
            </a>
            <a
              href="/admin/donations"
              className="px-4 py-3 bg-blue-50 hover:bg-blue-100 rounded-lg font-medium text-blue-700 shadow-sm"
            >
              Переглянути донати
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
