import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { calculateCompleteness } from "@/features/mentor-profile/utils/completeness";

type AppRole = Database["public"]["Enums"]["app_role"];

interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  role: AppRole;
  avatar_url: string | null;
}

interface CachedAuth {
  profile: UserProfile;
  mentorActive: boolean;
  profileCompleteness?: number;
  isApproved?: boolean;
}

interface AuthContextType {
  session: Session | null;
  user: User | null;
  profile: UserProfile | null;
  role: AppRole | null;
  mentorActive: boolean;
  profileCompleteness: number;
  isApproved: boolean;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, fullName: string, role: AppRole) => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const AUTH_CACHE_KEY = "app:lastAuth";

const readCache = (): CachedAuth | null => {
  try {
    const raw = localStorage.getItem(AUTH_CACHE_KEY);
    return raw ? (JSON.parse(raw) as CachedAuth) : null;
  } catch {
    return null;
  }
};

const writeCache = (value: CachedAuth | null) => {
  try {
    if (value) localStorage.setItem(AUTH_CACHE_KEY, JSON.stringify(value));
    else localStorage.removeItem(AUTH_CACHE_KEY);
  } catch {
    /* noop */
  }
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const cached = readCache();
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(cached?.profile ?? null);
  const [mentorActive, setMentorActive] = useState<boolean>(cached?.mentorActive ?? true);
  const [profileCompleteness, setProfileCompleteness] = useState<number>(cached?.profileCompleteness ?? 100);
  const [isApproved, setIsApproved] = useState<boolean>(cached?.isApproved ?? true);
  // Loading stays true until we have either a confirmed-no-session OR a resolved profile.
  // Optimistic UI is driven from the cached profile above, not from `loading`.
  const [loading, setLoading] = useState(true);

  // Dedupe parallel profile fetches across onAuthStateChange + getSession.
  const fetchingFor = useRef<string | null>(null);
  const lastFetchedFor = useRef<string | null>(null);

  const fetchProfile = async (userId: string) => {
    if (fetchingFor.current === userId) return;
    fetchingFor.current = userId;
    try {
      const { data: profileData, error: profileError } = await supabase
        .from("users")
        .select("id, email, full_name, role, avatar_url")
        .eq("id", userId)
        .single();

      if (profileError || !profileData) {
        console.error("[auth] profile fetch failed", profileError);
        if (window.location.pathname !== "/reset-password" && window.location.pathname !== "/forgot-password") {
          // Session exists but we can't load the user row (RLS 403, missing row,
          // stale token). Clear the orphaned session to avoid redirect loops.
          setProfile(null);
          setMentorActive(false);
          writeCache(null);
          lastFetchedFor.current = null;
          await supabase.auth.signOut();
        }
        return;
      }

      let isActive = true;
      let completeness = 100;

      if (profileData.role === "mentor") {
        const [{ data: mp }, { count: activeOfferingsCount }] = await Promise.all([
          supabase
            .from("mentor_profiles")
            .select("is_active, bio, expertise, qualifications, experiences, resume_url, headline, phone, years_experience, linkedin_url, professional_status, current_organization, current_role")
            .eq("user_id", userId)
            .maybeSingle(),
          supabase
            .from("mentorship_offerings")
            .select("id", { count: "exact", head: true })
            .eq("mentor_id", userId)
            .eq("status", "active"),
        ]);

        isActive = !!mp?.is_active;

        if (mp) {
          const { percentage } = calculateCompleteness({
            ...mp,
            qualifications: Array.isArray(mp.qualifications) ? mp.qualifications : [],
            experiences: Array.isArray(mp.experiences) ? mp.experiences : [],
            full_name: profileData.full_name,
            email: profileData.email,
            avatar_url: profileData.avatar_url,
            has_offerings: (activeOfferingsCount ?? 0) > 0,
          });
          completeness = percentage;
        } else {
          completeness = 0;
        }
      }

      const activeState = isActive && completeness === 100;

      setProfile(profileData);
      setMentorActive(activeState);
      setProfileCompleteness(completeness);
      setIsApproved(isActive);

      writeCache({
        profile: profileData,
        mentorActive: activeState,
        profileCompleteness: completeness,
        isApproved: isActive,
      });
      lastFetchedFor.current = userId;
    } finally {
      fetchingFor.current = null;
    }
  };

  useEffect(() => {
    let mounted = true;

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, nextSession) => {
        if (!mounted) return;
        setSession(nextSession);
        setUser(nextSession?.user ?? null);
        const uid = nextSession?.user?.id ?? null;

        if (!uid) {
          setProfile(null);
          setMentorActive(false);
          setProfileCompleteness(100);
          setIsApproved(true);
          writeCache(null);
          lastFetchedFor.current = null;
          setLoading(false);
          return;
        }

        // Only fetch if the user actually changed; otherwise keep optimistic data.
        if (uid !== lastFetchedFor.current) {
          fetchProfile(uid).finally(() => mounted && setLoading(false));
        } else {
          setLoading(false);
        }
      }
    );

    supabase.auth.getSession().then(({ data: { session: initialSession } }) => {
      if (!mounted) return;
      setSession(initialSession);
      setUser(initialSession?.user ?? null);
      const uid = initialSession?.user?.id ?? null;

      if (!uid) {
        writeCache(null);
        setProfile(null);
        setMentorActive(false);
        setProfileCompleteness(100);
        setIsApproved(true);
        lastFetchedFor.current = null;
        setLoading(false);
        return;
      }

      if (uid !== lastFetchedFor.current) {
        fetchProfile(uid).finally(() => mounted && setLoading(false));
      } else {
        setLoading(false);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  };

  const signUp = async (email: string, password: string, fullName: string, role: AppRole) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName, role },
        emailRedirectTo: window.location.origin,
      },
    });
    if (error) throw error;
  };

  const signOut = async () => {
    let logoutUrl: string | null = null;
    try {
      const { data: cfg } = await supabase
        .from("jwt_config")
        .select("enabled, logout_redirect_url")
        .limit(1)
        .maybeSingle();
      if (cfg?.enabled && cfg.logout_redirect_url) logoutUrl = cfg.logout_redirect_url;
    } catch {
      /* noop */
    }

    await supabase.auth.signOut();
    setProfile(null);
    setMentorActive(false);
    setProfileCompleteness(100);
    setIsApproved(true);
    writeCache(null);
    lastFetchedFor.current = null;

    if (logoutUrl) window.location.href = logoutUrl;
  };

  const refreshProfile = async () => {
    if (user) {
      lastFetchedFor.current = null;
      await fetchProfile(user.id);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        user,
        profile,
        role: profile?.role ?? null,
        mentorActive,
        profileCompleteness,
        isApproved,
        loading,
        signIn,
        signUp,
        signOut,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};
