import { useState, useEffect } from 'react';
import { supabase } from './supabaseClient.js';

export function useAuth() {
  const [session, setSession] = useState(undefined); // undefined = still loading
  const [profile, setProfile] = useState(null);
  const [profileLoaded, setProfileLoaded] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session ?? null));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (session === undefined) return;
    if (!session) { setProfile(null); setProfileLoaded(true); return; }
    setProfileLoaded(false);
    supabase.from('profiles').select('*').eq('id', session.user.id).single()
      .then(({ data }) => { setProfile(data); setProfileLoaded(true); });
  }, [session]);

  const signOut = () => supabase.auth.signOut();

  return {
    loading: session === undefined || (session !== null && !profileLoaded),
    session,
    profile,
    signOut,
  };
}
