import { z } from "zod";

/** Shared input rules. Used by server functions (authoritative) and forms (for friendly errors). */
export const uuid = z.string().uuid();
export const joinCode = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z0-9]{4,12}$/, "That code doesn't look right");
const clean = (max: number) => z.string().trim().max(max);

export const personName = z.string().trim().min(2, "Enter your name").max(60);
/** Phone number or matric number: letters, digits and common separators. */
export const identifier = z
  .string()
  .trim()
  .min(3, "Enter a valid phone or matric number")
  .max(40)
  .regex(/^[A-Za-z0-9 +\-/().]+$/, "Use only letters, numbers and + - / ( )");

export const questionType = z.enum(["multiple_choice", "true_false", "short_answer"]);
export const questionInput = z.object({
  type: questionType,
  prompt: clean(2000),
  options: z.array(clean(200)).max(8),
  correct_answer: clean(500),
  time_limit: z.number().int().min(5).max(300),
});

export const contactInput = z.object({
  name: z.string().trim().min(1, "Please enter your name").max(120),
  email: z.string().trim().email("Enter a valid email address").max(254),
  topic: z.enum(["general", "support", "sales", "privacy", "abuse", "press"]),
  message: z.string().trim().min(10, "Please write at least a sentence").max(5000),
  /** Honeypot: real people never fill this in. */
  website: z.string().max(500).optional(),
});

export const safeUrl = (max = 2000) =>
  z
    .string()
    .trim()
    .max(max)
    .url()
    .refine((u) => /^https:\/\//i.test(u), "Links must start with https://");
