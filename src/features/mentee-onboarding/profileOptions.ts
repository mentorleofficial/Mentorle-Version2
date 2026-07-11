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
