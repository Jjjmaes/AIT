export interface LanguageOption {
  code: string; // e.g., 'en-US'
  name: string; // e.g., 'English (US)'
}

export const LANGUAGES: LanguageOption[] = [
  { code: 'zh-CN', name: '简体中文 (zh-CN)' },
  { code: 'zh-TW', name: '繁体中文 (zh-TW)' },
  { code: 'en-US', name: 'English (US)' },
  { code: 'en-GB', name: 'English (UK)' },
  { code: 'ja', name: '日本語 (ja)' },
  { code: 'ko', name: '한국어 (ko)' },
  { code: 'de', name: 'Deutsch (de)' },
  { code: 'fr', name: 'Français (fr)' },
  { code: 'es-ES', name: 'Español (Spain)' },
  { code: 'es-MX', name: 'Español (Mexico)' },
  { code: 'pt-PT', name: 'Português (Portugal)' },
  { code: 'pt-BR', name: 'Português (Brazil)' },
  { code: 'ru', name: 'Русский (ru)' },
  { code: 'ar', name: 'العربية (ar)' },
  { code: 'it', name: 'Italiano (it)' },
  { code: 'nl', name: 'Nederlands (nl)' },
  { code: 'vi', name: 'Tiếng Việt (vi)' },
  { code: 'th', name: 'ไทย (th)' },
  { code: 'hi', name: 'हिन्दी (hi)' },
  { code: 'tr', name: 'Türkçe (tr)' },
  { code: 'pl', name: 'Polski (pl)' },
  { code: 'cs', name: 'Čeština (cs)' },
  // Add more as needed
];

// Simple list for now, could be structured with sub-categories later
export const DOMAINS: string[] = [
  "Legal",
  "Finance",
  "Medical",
  "Technical",
  "IT/Software",
  "Marketing",
  "Regulatory",
  "E-commerce",
  "Gaming",
  "Education",
  "Engineering",
  // Add more specific sub-domains or keep it high-level
];

// Similar simple list for industries
export const INDUSTRIES: string[] = [
  "Legal Services",
  "Banking & Financial Services",
  "Insurance",
  "Pharmaceuticals",
  "Medical Devices",
  "Healthcare Services",
  "Energy & Utilities",
  "Automation & Electronics",
  "Manufacturing & Machinery",
  "Semiconductors",
  "Software Development",
  "IT Services",
  "Advertising & Marketing",
  "Social Media",
  "Retail & E-commerce",
  "Video Games",
  "Online Education",
  "Academic Research",
  "Construction & Civil Engineering",
  "Environmental Services",
  // Add more
];

export interface PriorityOption {
  value: number;
  label: string;
}

export const PRIORITIES: PriorityOption[] = [
  { value: 3, label: '高' },
  { value: 2, label: '中' },
  { value: 1, label: '低' },
];

export interface StatusOption {
  value: string;
  label: string;
}

// Based on ProjectStatus enum in backend models/project.model.ts
export const STATUSES: StatusOption[] = [
  { value: 'active', label: '活动' },
  { value: 'pending', label: '待定' },
  { value: 'in_progress', label: '进行中' },
  { value: 'completed', label: '已完成' },
  { value: 'archived', label: '已归档' },
]; 