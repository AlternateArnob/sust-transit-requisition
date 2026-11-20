export const OTP_LENGTH = 6;
export const OTP_EXPIRY_MS = 10 * 60 * 1000; // 10 minutes
export const OTP_MAX_ATTEMPTS = 5;

export interface OtpChallenge {
  email: string;
  code: string;
  expiresAt: string;
  attempts: number;
}
