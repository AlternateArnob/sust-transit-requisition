import type { Transporter } from "nodemailer";
import { afterEach, describe, expect, it, vi } from "vitest";
import { env } from "../../src/config/env.js";
import { sendOtpEmail, setMailTransport } from "../../src/services/mailer.js";

afterEach(() => setMailTransport(undefined));

function stubTransport(impl?: () => Promise<unknown>) {
  const sendMail = vi.fn((_message: Record<string, string>) =>
    impl ? impl() : Promise.resolve({ messageId: "x" }),
  );
  setMailTransport({ sendMail } as unknown as Transporter);
  return sendMail;
}

describe("sendOtpEmail", () => {
  it("sends the code to the right address from MAIL_FROM", async () => {
    const sendMail = stubTransport();
    await sendOtpEmail("applicant@student.sust.edu", "123456");

    expect(sendMail).toHaveBeenCalledOnce();
    const message = sendMail.mock.calls[0]?.[0] ?? {};
    expect(message.to).toBe("applicant@student.sust.edu");
    expect(message.from).toBe(env.MAIL_FROM);
    expect(message.subject).toMatch(/verification code/i);
    expect(message.text).toContain("123456");
    expect(message.text).toContain(`${env.OTP_TTL_MINUTES} minutes`);
  });

  it("rejects when the transport fails, so callers can report delivery problems", async () => {
    stubTransport(() => Promise.reject(new Error("SMTP down")));
    await expect(sendOtpEmail("a@sust.edu", "123456")).rejects.toThrow("SMTP down");
  });

  it("does not open a network connection in tests (default JSON transport)", async () => {
    await expect(sendOtpEmail("a@sust.edu", "123456")).resolves.toBeUndefined();
  });

  it("does not print the code to the console outside development", async () => {
    const spy = vi.spyOn(console, "info").mockImplementation(() => undefined);
    stubTransport();
    await sendOtpEmail("a@sust.edu", "654321");
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});
