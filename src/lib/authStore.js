import { create } from "zustand";
import { supabase } from "./supabase";

export const useAuthStore = create((set) => ({
  session: null,
  profile: null,
  isLoading: true,

  init: async () => {
    try {
      const { data } = await supabase.auth.getSession();
      set({ session: data.session, isLoading: false });
      if (data.session) await useAuthStore.getState().fetchProfile();
    } catch (err) {
      console.error("Failed to load Supabase session — is VITE_SUPABASE_URL/VITE_SUPABASE_ANON_KEY set?", err);
      set({ session: null, isLoading: false });
    }

    supabase.auth.onAuthStateChange((_event, session) => {
      set({ session });
      if (session) {
        useAuthStore.getState().fetchProfile();
      } else {
        set({ profile: null });
      }
    });
  },

  fetchProfile: async () => {
    const uid = useAuthStore.getState().session?.user?.id;
    if (!uid) return set({ profile: null });

    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", uid)
      .single();

    if (error) {
      set({ profile: null });
      return;
    }
    set({ profile: data });
  },

  logout: async () => {
    await supabase.auth.signOut();
    set({ session: null, profile: null });
  },
}));
