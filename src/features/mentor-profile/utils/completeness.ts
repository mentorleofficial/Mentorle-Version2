export interface CompletenessData {
  full_name?: string | null;
  email?: string | null;
  phone?: string | null;
  headline?: string | null;
  bio?: string | null;
  professional_status?: string | null;
  current_organization?: string | null;
  current_role?: string | null;
  years_experience?: number | null;
  linkedin_url?: string | null;
  expertise?: string[] | null;
  qualifications?: any[] | null;
  experiences?: any[] | null;
  resume_url?: string | null;
  avatar_url?: string | null;
  has_offerings?: boolean;
}

export interface ChecklistItem {
  key: string;
  label: string;
  check: boolean;
  optional?: boolean;
}

export function calculateCompleteness(data: CompletenessData): {
  percentage: number;
  missingItems: { key: string; label: string }[];
  checklist: ChecklistItem[];
} {
  const statusVal = data.professional_status || "";
  const orgRequired = ["Employed", "Entrepreneur", "Faculty / Academician", "Research Scholar", "Retired Professional", "Student / Higher Education"].includes(statusVal);
  const roleRequired = ["Employed", "Self-Employed / Consultant", "Entrepreneur", "Faculty / Academician", "Research Scholar", "Retired Professional", "Student / Higher Education", "Other"].includes(statusVal);

  const checklist: ChecklistItem[] = [
    { key: "full_name", label: "Full Name", check: !!data.full_name && data.full_name.trim().length >= 2 },
    { key: "email", label: "Email Address", check: !!data.email },
    { key: "phone", label: "Contact Number", check: !!data.phone && data.phone.trim().length > 0 },
    { key: "headline", label: "Profile Headline", check: !!data.headline && data.headline.trim().length > 0 },
    { key: "bio", label: "Bio (min 50 characters)", check: !!data.bio && data.bio.trim().length >= 50 },
    { key: "professional_status", label: "Professional Status", check: !!data.professional_status && data.professional_status.trim().length > 0 },
    {
      key: "current_organization",
      label: "Current Organization",
      check: !orgRequired || (!!data.current_organization && data.current_organization.trim().length > 0),
      optional: !orgRequired,
    },
    {
      key: "current_role",
      label: "Current Role",
      check: !roleRequired || (!!data.current_role && data.current_role.trim().length > 0),
      optional: !roleRequired,
    },
    {
      key: "years_experience",
      label: "Years of Experience",
      check: data.years_experience !== null && data.years_experience !== undefined && data.years_experience >= 0,
    },
    { key: "linkedin_url", label: "LinkedIn Profile Link", check: !!data.linkedin_url && data.linkedin_url.trim().length > 0 },
    { key: "expertise", label: "At least 1 Expertise tag", check: Array.isArray(data.expertise) && data.expertise.length > 0 },
    { key: "qualifications", label: "At least 1 Education qualification", check: Array.isArray(data.qualifications) && data.qualifications.length > 0 },
    { key: "experiences", label: "At least 1 Work Experience entry", check: Array.isArray(data.experiences) && data.experiences.length > 0 },
    { key: "resume_url", label: "Resume Upload", check: !!data.resume_url && data.resume_url.trim().length > 0 },
    { key: "avatar_url", label: "Profile Photo", check: !!data.avatar_url && data.avatar_url.trim().length > 0 },
    { key: "has_offerings", label: "At least 1 Active Offering", check: !!data.has_offerings },
  ];

  // We only count items that are NOT marked as "optional"
  const activeChecklist = checklist.filter((item) => !item.optional);
  const completed = activeChecklist.filter((item) => item.check).length;
  const percentage = activeChecklist.length > 0 ? Math.round((completed / activeChecklist.length) * 100) : 0;

  const missingItems = activeChecklist
    .filter((item) => !item.check)
    .map((item) => ({ key: item.key, label: item.label }));

  return { percentage, missingItems, checklist };
}
