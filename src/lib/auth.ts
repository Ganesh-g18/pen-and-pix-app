import { useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

let cached: { session: Session | null; user: User | null } = { session: null, user: null };
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((l) => l());
}

if (typeof window !== "undefined") {
  supabase.auth.getSession().then(({ data }) => {
    cached = { session: data.session, user: data.session?.user ?? null };
    notify();
  });
  supabase.auth.onAuthStateChange((_event, session) => {
    cached = { session, user: session?.user ?? null };
    notify();
  });
}

export function useAuth() {
  const [state, setState] = useState(cached);
  useEffect(() => {
    const fn = () => setState({ ...cached });
    listeners.add(fn);
    fn();
    return () => {
      listeners.delete(fn);
    };
  }, []);
  return state;
}

export async function signOut() {
  await supabase.auth.signOut();
}
