import { z } from "zod";

const phoneRegex = /^[+\d][\d\s\-().]{6,19}$/;

const urlOrEmpty = z
  .string()
  .trim()
  .transform((v) => {
    if (!v) return "";
    let clean = v.replace(/\/+$/, "");
    if (!/^https?:\/\//i.test(clean)) {
      clean = `https://${clean}`;
    }
    return clean;
  })
  .pipe(z.string().url("Must be a valid URL").or(z.literal("")));

export const qualificationSchema = z
  .object({
    institution: z.string().trim().min(2, "Institution required").max(150),
    degree: z.string().trim().min(1, "Degree required").max(150),
    field: z.string().trim().max(150).optional().or(z.literal("")),
    start_year: z.coerce.number().int().min(1950).max(new Date().getFullYear() + 10),
    end_year: z
      .union([z.coerce.number().int().min(1950).max(new Date().getFullYear() + 10), z.literal("present")])
      .optional()
      .nullable(),
  })
  .refine(
    (q) => q.end_year === "present" || !q.end_year || (q.end_year as number) >= q.start_year,
    { message: "End year must be after start", path: ["end_year"] }
  );

export const experienceSchema = z
  .object({
    company: z.string().trim().min(1, "Company required").max(150),
    title: z.string().trim().min(1, "Title required").max(150),
    location: z.string().trim().max(150).optional().or(z.literal("")),
    start_date: z.string().trim().min(1, "Start date required"), // YYYY-MM
    end_date: z.string().trim().optional().or(z.literal("")), // YYYY-MM or "" (= present)
    description: z.string().trim().max(1500).optional().or(z.literal("")),
  })
  .refine(
    (e) => !e.end_date || e.end_date >= e.start_date,
    { message: "End date must be after start", path: ["end_date"] }
  );

export const mentorProfileSchema = z
  .object({
    full_name: z.string().trim().min(2, "Required").max(100),
    phone: z.string().trim().regex(phoneRegex, "Enter a valid phone number").or(z.literal("")),
    headline: z.string().trim().max(160).or(z.literal("")),
    bio: z.string().trim().min(50, "Bio must be at least 50 characters").max(2000),
    current_organization: z.string().trim().max(150).or(z.literal("")),
    current_role: z.string().trim().max(150).or(z.literal("")),
    professional_status: z.string().trim().max(100).or(z.literal("")),
    years_experience: z.coerce.number().int().min(0, "0+").max(60, "Max 60"),
    linkedin_url: urlOrEmpty.refine(
      (v) => !v || /linkedin\.com\/(in|pub)\//i.test(v),
      "Must be a linkedin.com/in/… URL"
    ),
    portfolio_url: urlOrEmpty,
    expertise: z.array(z.string().trim().min(1)).min(1, "Add at least one expertise").max(15, "Max 15 tags"),
    qualifications: z.array(qualificationSchema).max(15),
    experiences: z.array(experienceSchema).max(20),
  })
  .superRefine((data, ctx) => {
    const status = data.professional_status || "";
    const orgRequired = ["Employed", "Entrepreneur", "Faculty / Academician", "Research Scholar", "Retired Professional", "Student / Higher Education"].includes(status);
    const roleRequired = ["Employed", "Self-Employed / Consultant", "Entrepreneur", "Faculty / Academician", "Research Scholar", "Retired Professional", "Student / Higher Education", "Other"].includes(status);

    if (orgRequired && !data.current_organization?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["current_organization"],
        message: status === "Entrepreneur" 
          ? "Venture / Company Name is required" 
          : status.includes("Student") || status.includes("Faculty") || status.includes("Research")
          ? "Institution Name is required"
          : "Current Company / Organization is required",
      });
    }

    if (roleRequired && !data.current_role?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["current_role"],
        message: status === "Student / Higher Education"
          ? "Degree / Program is required"
          : status === "Research Scholar"
          ? "Field of Research is required"
          : "Designation / Role is required",
      });
    }
  });

export type MentorProfileFormValues = z.infer<typeof mentorProfileSchema>;
export type QualificationValue = z.infer<typeof qualificationSchema>;
export type ExperienceValue = z.infer<typeof experienceSchema>;
