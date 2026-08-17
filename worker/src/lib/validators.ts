// worker/src/lib/validators.ts
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const normalizeEmail = (raw: string): string => raw.trim().toLowerCase();

export const isValidEmail = (email: string): boolean => EMAIL_RE.test(email);
