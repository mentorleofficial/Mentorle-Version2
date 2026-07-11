import { z } from "zod";

export const menteeOnboardingSchema = z.object({
  full_name: z
    .string()
    .trim()
    .min(2, "Please enter your full name")
    .max(120, "Name is too long"),
  headline: z.string().trim().max(160, "Keep it under 160 characters").default(""),
  bio: z.string().trim().max(600, "Keep it under 600 characters").default(""),
  organization_unit: z.string().trim().max(120).default(""),
  linkedin_url: z
    .string()
    .trim()
    .max(255)
    .transform((v) => {
      if (!v) return "";
      let clean = v.replace(/\/+$/, "");
      if (!/^https?:\/\//i.test(clean)) {
        clean = `https://${clean}`;
      }
      return clean;
    })
    .pipe(
      z.string().url("Must be a valid URL").or(z.literal(""))
    )
    .refine(
      (v) => !v || /linkedin\.com\/(in|pub)\//i.test(v),
      "Must be a linkedin.com/in/… URL"
    )
    .default(""),
  goals: z
    .string()
    .trim()
    .min(20, "Tell mentors a bit more about your goals (≥20 chars)")
    .max(800, "Keep it under 800 characters"),
  interests: z
    .array(z.string().trim().min(1).max(40))
    .min(3, "Add at least 3 interests")
    .max(20, "That's plenty — keep it under 20"),
  preferred_mentor_areas: z
    .array(z.string().trim().min(1).max(40))
    .min(1, "Pick at least one mentor area")
    .max(15, "Keep it under 15"),
  academic_details: z.string().trim().max(500, "Keep it under 500 characters").default(""),
  github_url: z
    .string()
    .trim()
    .max(255)
    .transform((v) => {
      if (!v) return "";
      let clean = v.replace(/\/+$/, "");
      if (!/^https?:\/\//i.test(clean)) {
        clean = `https://${clean}`;
      }
      return clean;
    })
    .pipe(
      z.string().url("Must be a valid URL").or(z.literal(""))
    )
    .default(""),
  portfolio_url: z
    .string()
    .trim()
    .max(255)
    .transform((v) => {
      if (!v) return "";
      let clean = v.replace(/\/+$/, "");
      if (!/^https?:\/\//i.test(clean)) {
        clean = `https://${clean}`;
      }
      return clean;
    })
    .pipe(
      z.string().url("Must be a valid URL").or(z.literal(""))
    )
    .default(""),
});

export type MenteeOnboardingValues = z.infer<typeof menteeOnboardingSchema>;

export const emptyOnboarding: MenteeOnboardingValues = {
  full_name: "",
  headline: "",
  bio: "",
  organization_unit: "",
  linkedin_url: "",
  goals: "",
  interests: [],
  preferred_mentor_areas: [],
  academic_details: "",
  github_url: "",
  portfolio_url: "",
};
