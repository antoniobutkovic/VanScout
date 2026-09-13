import nodemailer from "nodemailer";
import { optionalEnv, requiredEnv } from "./config";

function getMailConfig() {
  const secure = optionalEnv("SMTP_SECURE")?.toLowerCase() === "true";
  const port = Number(optionalEnv("SMTP_PORT") || (secure ? "465" : "587"));
  if (!Number.isInteger(port)) throw new Error("SMTP_PORT must be a number");

  const smtpUser = requiredEnv("SMTP_USER");

  return {
    smtpUser,
    transporter: nodemailer.createTransport({
      host: requiredEnv("SMTP_HOST"),
      port,
      secure,
      auth: {
        user: smtpUser,
        pass: requiredEnv("SMTP_PASSWORD"),
      },
    }),
  };
}

export async function sendPasswordResetEmail({ to, resetUrl }: { to: string; resetUrl: string }) {
  const { smtpUser, transporter } = getMailConfig();
  await transporter.sendMail({
    // Zoho only permits the authenticated mailbox (or one of its aliases).
    // Use it for the envelope and From header so MAIL_FROM cannot cause a
    // misleading "Sender is not allowed to relay" error.
    from: smtpUser,
    envelope: { from: smtpUser, to },
    to,
    subject: "Reset your VanScout password",
    text: `Reset your VanScout password using this link:\n\n${resetUrl}\n\nThis link expires in one hour. If you did not request a password reset, you can ignore this email.`,
    html: `<p>Reset your VanScout password using the link below:</p><p><a href="${resetUrl}">Reset password</a></p><p>This link expires in one hour. If you did not request a password reset, you can ignore this email.</p>`,
  });
}

export async function sendEmailVerificationEmail({ to, verificationCode }: { to: string; verificationCode: string }) {
  const { smtpUser, transporter } = getMailConfig();
  await transporter.sendMail({
    from: smtpUser,
    envelope: { from: smtpUser, to },
    to,
    subject: `${verificationCode} is your VanScout verification code`,
    text: `Your VanScout email verification code is ${verificationCode}.\n\nThis code expires in 15 minutes. If you did not create a VanScout account, you can ignore this email.`,
    html: `<p>Your VanScout email verification code is:</p><p style="font-size:28px;font-weight:700;letter-spacing:8px">${verificationCode}</p><p>This code expires in 15 minutes. If you did not create a VanScout account, you can ignore this email.</p>`,
  });
}
