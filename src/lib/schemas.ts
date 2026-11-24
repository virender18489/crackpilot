import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().trim().email('Enter a valid email address.'),
  password: z.string().min(6, 'Password must be at least 6 characters.'),
});

export type LoginFormValues = z.infer<typeof loginSchema>;

export const signupSchema = z.object({
  email: z.string().trim().email('Enter a valid email address.'),
  password: z
    .string()
    .min(8, 'Use at least 8 characters.')
    .regex(/[A-Z]/, 'Include at least one uppercase letter.')
    .regex(/[0-9]/, 'Include at least one number.'),
});

export type SignupFormValues = z.infer<typeof signupSchema>;

export const forgotPasswordSchema = z.object({
  email: z.string().trim().email('Enter a valid email address.'),
});

export type ForgotPasswordFormValues = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z
  .object({
    otp: z.string().regex(/^\d{6}$/, 'Enter the 6-digit recovery code.'),
    newPassword: z
      .string()
      .min(8, 'Use at least 8 characters.')
      .regex(/[A-Z]/, 'Include at least one uppercase letter.')
      .regex(/[0-9]/, 'Include at least one number.'),
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'Passwords do not match.',
    path: ['confirmPassword'],
  });

export type ResetPasswordFormValues = z.infer<typeof resetPasswordSchema>;

export const bookDemoSchema = z.object({
  name: z.string().trim().min(2, 'Enter your full name.'),
  email: z.string().trim().email('Enter a valid email address.'),
  phone: z.string().trim().min(7, 'Enter a valid phone or WhatsApp number.'),
  role: z.string().trim().min(2, 'Enter your target role.'),
  dateTime: z.string().min(1, 'Pick a preferred date and time.'),
  platform: z.enum(['Zoom', 'Google Meet', 'Microsoft Teams', 'Webex', 'Discord']),
  message: z.string().max(600, 'Keep notes under 600 characters.').optional(),
});

export type BookDemoFormValues = z.infer<typeof bookDemoSchema>;

export const targetProfileSchema = z.object({
  targetRole: z.string().trim().min(2, 'Target role is required.'),
  experienceLevel: z.string().min(1, 'Select an experience level.'),
  companyType: z.string().trim().min(2, 'Enter target company stage or type.'),
  jobDescription: z.string().trim().min(20, 'Paste at least a short role summary (20+ chars).'),
});

export type TargetProfileFormValues = z.infer<typeof targetProfileSchema>;

export const knowledgeEntrySchema = z.object({
  question: z.string().trim().min(5, 'Enter the interview question.'),
  answer: z.string().trim().min(10, 'Enter your preferred talking points.'),
  category: z.enum(['Behavioral', 'Technical', 'System Design', 'Leadership', 'General']),
});

export type KnowledgeEntryFormValues = z.infer<typeof knowledgeEntrySchema>;

export const updatePasswordSchema = z
  .object({
    currentPassword: z.string().min(6, 'Enter your current password.'),
    newPassword: z
      .string()
      .min(8, 'Use at least 8 characters.')
      .regex(/[A-Z]/, 'Include at least one uppercase letter.')
      .regex(/[0-9]/, 'Include at least one number.'),
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'New passwords do not match.',
    path: ['confirmPassword'],
  });

export type UpdatePasswordFormValues = z.infer<typeof updatePasswordSchema>;

export const accountSettingsSchema = z.object({
  fullName: z.string().trim().min(2, 'Full name is required.'),
  email: z.string().trim().email('Enter a valid email address.'),
  phone: z.string().trim().min(7, 'Enter a valid phone number.'),
});

export type AccountSettingsFormValues = z.infer<typeof accountSettingsSchema>;

export const supportTicketSchema = z.object({
  subject: z.string().trim().min(5, 'Add a concise subject line.'),
  category: z.enum(['Technical Setup', 'Audio & Capture', 'Billing & Credits', 'Account']),
  description: z.string().trim().min(15, 'Describe the issue so we can help quickly.'),
});

export type SupportTicketFormValues = z.infer<typeof supportTicketSchema>;

export const reviewSchema = z.object({
  rating: z.number().min(1, 'Select a rating.').max(5),
  roleTitle: z.string().trim().min(2, 'Enter your role or interview track.'),
  comment: z.string().trim().min(15, 'Share at least a short sentence about your experience.'),
});

export type ReviewFormValues = z.infer<typeof reviewSchema>;

export const partnerApplySchema = z.object({
  name: z.string().trim().min(2, 'Enter your full name.'),
  email: z.string().trim().email('Enter a valid email address.'),
  phone: z.string().trim().min(7, 'Enter a valid phone or WhatsApp number.'),
  channel: z.enum(['Career Coach / Mentor', 'Campus Ambassador', 'Content Creator', 'Recruiting Agency']),
  audienceSize: z.string().trim().min(1, 'Share estimated monthly reach.'),
  notes: z.string().trim().min(10, 'Tell us briefly how you plan to refer candidates.'),
});

export type PartnerApplyFormValues = z.infer<typeof partnerApplySchema>;

export function getPasswordStrength(password: string): {
  score: number;
  label: string;
  colorClass: string;
} {
  let score = 0;
  if (password.length >= 8) score += 1;
  if (/[A-Z]/.test(password)) score += 1;
  if (/[0-9]/.test(password)) score += 1;
  if (/[^A-Za-z0-9]/.test(password) || password.length >= 12) score += 1;

  if (!password) return { score: 0, label: 'Enter a password', colorClass: 'bg-border-strong' };
  if (score <= 1) return { score: 1, label: 'Weak', colorClass: 'bg-rose-500' };
  if (score === 2) return { score: 2, label: 'Fair', colorClass: 'bg-amber-500' };
  if (score === 3) return { score: 3, label: 'Good', colorClass: 'bg-primary-500' };
  return { score: 4, label: 'Strong', colorClass: 'bg-emerald-500' };
}
