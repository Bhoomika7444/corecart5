/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Shared password strength rules used by both the sign-up form and the
// backend registration endpoint, so validation never gets out of sync.
export interface PasswordCheck {
  label: string;
  test: (pw: string) => boolean;
}

export const PASSWORD_RULES: PasswordCheck[] = [
  { label: "At least 6 characters", test: (pw) => pw.length >= 6 },
  { label: "One uppercase letter", test: (pw) => /[A-Z]/.test(pw) },
  { label: "One number", test: (pw) => /[0-9]/.test(pw) },
  { label: "One special character", test: (pw) => /[^A-Za-z0-9]/.test(pw) },
];

export function getPasswordFailures(password: string): string[] {
  return PASSWORD_RULES.filter((rule) => !rule.test(password || "")).map((rule) => rule.label);
}

export function isPasswordStrong(password: string): boolean {
  return getPasswordFailures(password).length === 0;
}
