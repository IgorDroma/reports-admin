import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

export default function Home() {
  const [user, setUser] = useState(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data?.user ?? null)
    })
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })
    return () => listener?.subscription?.unsubscribe?.()
  }, [])

  const signIn = async () => {
    await supabase.auth.signInWithOAuth({ provider: 'google' })
  }
  const signOut = async () => {
    await supabase.auth.signOut()
    setUser(null)
  }

  return (
    <div className="container">
      <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
        <h1>Reports Admin</h1>
        {user ? <div>
          <span className="small">Logged in as {user.email}</span>
          <button style={{marginLeft:12}} onClick={signOut}>Sign out</button>
        </div> : null}
      </div>

      {!user ? (
        <div style={{marginTop:40}}>
          <p>To continue, sign in with Google:</p>
          <button onClick={signIn} style={{background:'#2563eb', color:'#fff', padding:'10px 14px', borderRadius:6}}>Sign in with Google</button>
        </div>
      ) : (
        <div style={{marginTop:20}}>
          <p>Go to:</p>
          <div className="nav">
            <a href="/add">Add act</a>
            <a href="/acts">View acts</a>
          </div>
        </div>
      )}
    </div>
  )
}
