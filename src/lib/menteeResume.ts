import { supabase } from "@/integrations/supabase/client";

// Mentee resumes live in the private `mentee-resumes` bucket; mentee_profiles.resume_url holds the file's storage
// URL, which can't be opened directly. These open a short-lived signed link instead (the mentee, admins, and
// mentors with a session or program with the mentee may read it).
const BUCKET = "mentee-resumes";

export const menteeResumePath = (url: string) => {
  const marker = `/${BUCKET}/`;
  const index = url.indexOf(marker);
  return decodeURIComponent((index >= 0 ? url.slice(index + marker.length) : url).split("?")[0]);
};

export async function openMenteeResume(url: string) {
  // Open the tab first, so the browser doesn't treat it as a popup after the await.
  const tab = window.open("", "_blank");
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(menteeResumePath(url), 600);
  if (error || !data) {
    tab?.close();
    throw error ?? new Error("Couldn't open the resume");
  }
  if (tab) tab.location.href = data.signedUrl;
  else window.location.href = data.signedUrl;
}
