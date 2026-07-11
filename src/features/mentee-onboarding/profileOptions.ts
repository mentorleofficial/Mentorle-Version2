export const SKILLS = [
  "Python", "JavaScript", "TypeScript", "React", "Node.js", "SQL", "Java", "C++", "Go", "Rust",
  "Machine Learning", "Data Analysis", "Data Science", "Deep Learning", "NLP",
  "Product Management", "UI/UX Design", "Figma", "System Design", "DevOps",
  "Marketing", "Finance", "Accounting", "Leadership", "Communication", "Public Speaking",
  "Project Management", "Agile/Scrum", "Sales", "Business Strategy",
];

export const LANGUAGES = [
  "English", "Hindi", "Tamil", "Telugu", "Kannada", "Bengali", "Marathi",
  "Gujarati", "Punjabi", "Malayalam", "French", "German", "Spanish", "Mandarin",
  "Arabic", "Japanese", "Korean", "Portuguese",
];

export const INDUSTRIES = [
  "Technology", "Finance & Banking", "Healthcare", "Education", "Marketing & Advertising",
  "Design & Creative", "Legal", "Consulting", "E-commerce", "Media & Entertainment",
  "Manufacturing", "Real Estate", "Non-profit", "Government",
];

export const SESSION_TYPES = [
  "1-on-1 Video Call",
  "Group Session",
  "Email Mentoring",
  "Project Review",
  "Code Review",
];

export const TIME_WINDOWS = [
  "Morning (6 AM–12 PM)",
  "Afternoon (12 PM–5 PM)",
  "Evening (5 PM–10 PM)",
  "Weekends",
];

export const MENTOR_QUALITIES = [
  "Patient",
  "Experienced",
  "Encouraging",
  "Direct Feedback",
  "Industry Expert",
  "Career Focused",
  "Technical Depth",
  "Big Picture Thinker",
];

export const STATUSES = [
  "Student",
  "Working Professional",
  "Job Seeker",
  "Freelancer",
  "Other",
];

export const EDUCATION_LEVELS = [
  "High School",
  "Diploma",
  "Bachelor's",
  "Master's",
  "PhD",
  "Other",
];

export const TIMEZONES = [
  "Asia/Kolkata",
  "Asia/Colombo",
  "Asia/Dubai",
  "Asia/Singapore",
  "Asia/Tokyo",
  "Asia/Shanghai",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Sao_Paulo",
  "Pacific/Auckland",
  "Australia/Sydney",
];

export const COUNTRY_CODES = [
  { code: "IN", dial: "+91", flag: "\u{1F1EE}\u{1F1F3}", name: "India", maxDigits: 10 },
  { code: "US", dial: "+1", flag: "\u{1F1FA}\u{1F1F8}", name: "United States", maxDigits: 10 },
  { code: "GB", dial: "+44", flag: "\u{1F1EC}\u{1F1E7}", name: "United Kingdom", maxDigits: 10 },
  { code: "AE", dial: "+971", flag: "\u{1F1E6}\u{1F1EA}", name: "UAE", maxDigits: 9 },
  { code: "SG", dial: "+65", flag: "\u{1F1F8}\u{1F1EC}", name: "Singapore", maxDigits: 8 },
  { code: "AU", dial: "+61", flag: "\u{1F1E6}\u{1F1FA}", name: "Australia", maxDigits: 9 },
  { code: "CA", dial: "+1", flag: "\u{1F1E8}\u{1F1E6}", name: "Canada", maxDigits: 10 },
  { code: "DE", dial: "+49", flag: "\u{1F1E9}\u{1F1EA}", name: "Germany", maxDigits: 11 },
  { code: "FR", dial: "+33", flag: "\u{1F1EB}\u{1F1F7}", name: "France", maxDigits: 9 },
  { code: "JP", dial: "+81", flag: "\u{1F1EF}\u{1F1F5}", name: "Japan", maxDigits: 10 },
  { code: "CN", dial: "+86", flag: "\u{1F1E8}\u{1F1F3}", name: "China", maxDigits: 11 },
  { code: "BR", dial: "+55", flag: "\u{1F1E7}\u{1F1F7}", name: "Brazil", maxDigits: 11 },
  { code: "NZ", dial: "+64", flag: "\u{1F1F3}\u{1F1FF}", name: "New Zealand", maxDigits: 9 },
  { code: "ZA", dial: "+27", flag: "\u{1F1FF}\u{1F1E6}", name: "South Africa", maxDigits: 9 },
  { code: "KR", dial: "+82", flag: "\u{1F1F0}\u{1F1F7}", name: "South Korea", maxDigits: 11 },
  { code: "MY", dial: "+60", flag: "\u{1F1F2}\u{1F1FE}", name: "Malaysia", maxDigits: 10 },
  { code: "PH", dial: "+63", flag: "\u{1F1F5}\u{1F1ED}", name: "Philippines", maxDigits: 10 },
  { code: "ID", dial: "+62", flag: "\u{1F1EE}\u{1F1E9}", name: "Indonesia", maxDigits: 12 },
  { code: "NG", dial: "+234", flag: "\u{1F1F3}\u{1F1EC}", name: "Nigeria", maxDigits: 10 },
  { code: "KE", dial: "+254", flag: "\u{1F1F0}\u{1F1EA}", name: "Kenya", maxDigits: 9 },
  { code: "PK", dial: "+92", flag: "\u{1F1F5}\u{1F1F0}", name: "Pakistan", maxDigits: 10 },
  { code: "BD", dial: "+880", flag: "\u{1F1E7}\u{1F1E9}", name: "Bangladesh", maxDigits: 10 },
  { code: "LK", dial: "+94", flag: "\u{1F1F1}\u{1F1F0}", name: "Sri Lanka", maxDigits: 9 },
  { code: "NP", dial: "+977", flag: "\u{1F1F3}\u{1F1F5}", name: "Nepal", maxDigits: 10 },
  { code: "SA", dial: "+966", flag: "\u{1F1F8}\u{1F1E6}", name: "Saudi Arabia", maxDigits: 9 },
] as const;

export type CountryCode = (typeof COUNTRY_CODES)[number];

export const DEFAULT_COUNTRY_CODE = "IN";

export function formatTimeWindow(windowStr: string): string {
  if (!windowStr) return "";
  // Normalize any kind of dash (hyphen, en-dash, em-dash) and spaces around it
  const normalized = windowStr.replace(/\s*[–—-]\s*/g, "-").trim();
  
  if (normalized === "Morning (6-12)" || normalized === "Morning (6 AM-12 PM)") {
    return "Morning (6 AM–12 PM)";
  }
  if (normalized === "Afternoon (12-17)" || normalized === "Afternoon (12 PM-5 PM)") {
    return "Afternoon (12 PM–5 PM)";
  }
  if (normalized === "Evening (17-22)" || normalized === "Evening (5 PM-10 PM)") {
    return "Evening (5 PM–10 PM)";
  }
  return windowStr;
}
