import { useCallback, useEffect, useState } from "react";
import { STORAGE_KEYS } from "../data/storageKeys";
import {
  OTP_EXPIRY_MS,
  OTP_LENGTH,
  OTP_MAX_ATTEMPTS,
} from "../types";
import type { OtpChallenge } from "../types";

const STORAGE_KEY = STORAGE_KEYS.otpChallenges;

function readChallenges(): OtpChallenge[] {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) return [];

  try {
    const parsed = JSON.parse(stored);
    return Array.isArray(parsed) ? (parsed as OtpChallenge[]) : [];
  } catch (error) {
    console.error(`Failed to parse ${STORAGE_KEY}`, error);
    return [];
  }
}

function writeChallenges(challenges: OtpChallenge[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(challenges));
  } catch (error) {
    console.error(`Failed to write ${STORAGE_KEY}`, error);
  }
}

function generateCode(length: number = OTP_LENGTH): string {
  const max = 10 ** length;
  const min = 10 ** (length - 1);
  const value = Math.floor(Math.random() * (max - min)) + min;
  return value.toString().padStart(length, "0");
}

export type RequestOtpResult =
  | { ok: true; code: string; challenge: OtpChallenge }
  | { ok: false; reason: "invalid-email" };

export type VerifyOtpResult =
  | { ok: true }
  | { ok: false; reason: "no-challenge" | "expired" | "attempts-exceeded" | "wrong-code" };

export default function useOtp() {
  const [challenges, setChallenges] = useState<OtpChallenge[]>(() =>
    readChallenges(),
  );

  useEffect(() => {
    writeChallenges(challenges);
  }, [challenges]);

  const requestOtp = useCallback(
    (email: string): RequestOtpResult => {
      const normalised = email.trim().toLowerCase();
      if (!normalised.includes("@")) {
        return { ok: false, reason: "invalid-email" };
      }

      const code = generateCode();
      const challenge: OtpChallenge = {
        email: normalised,
        code,
        expiresAt: new Date(Date.now() + OTP_EXPIRY_MS).toISOString(),
        attempts: 0,
      };

      setChallenges((current) => [
        ...current.filter((c) => c.email !== normalised),
        challenge,
      ]);

      // Surface the code in dev so the OTP flow is testable end-to-end.
      // eslint-disable-next-line no-console
      console.info(`[OTP] code for ${normalised}: ${code}`);

      return { ok: true, code, challenge };
    },
    [],
  );

  const verifyOtp = useCallback(
    (email: string, code: string): VerifyOtpResult => {
      const normalised = email.trim().toLowerCase();
      const target = challenges.find((c) => c.email === normalised);

      if (!target) {
        return { ok: false, reason: "no-challenge" };
      }

      if (new Date(target.expiresAt).getTime() < Date.now()) {
        setChallenges((current) => current.filter((c) => c.email !== normalised));
        return { ok: false, reason: "expired" };
      }

      if (target.attempts >= OTP_MAX_ATTEMPTS) {
        return { ok: false, reason: "attempts-exceeded" };
      }

      if (target.code !== code.trim()) {
        setChallenges((current) =>
          current.map((c) =>
            c.email === normalised ? { ...c, attempts: c.attempts + 1 } : c,
          ),
        );
        return { ok: false, reason: "wrong-code" };
      }

      setChallenges((current) => current.filter((c) => c.email !== normalised));
      return { ok: true };
    },
    [challenges],
  );

  const clearChallenge = useCallback((email: string) => {
    const normalised = email.trim().toLowerCase();
    setChallenges((current) => current.filter((c) => c.email !== normalised));
  }, []);

  return { challenges, requestOtp, verifyOtp, clearChallenge };
}
