import nodemailer from "nodemailer";
import { requiredEnv } from "./config";

function createTransporter() {
  const port = Number(requiredEnv("SMTP_PORT"));
  if (!Number.isInteger(port)) throw new Error("SMTP_PORT must be a number");

  return nodemailer.createTransport({
    host: requiredEnv("SMTP_HOST"),
    port,
    secure: requiredEnv("SMTP_SECURE").toLowerCase() === "true",
    auth: {
      user: requiredEnv("SMTP_USER"),
      pass: requiredEnv("SMTP_PASSWORD"),
    },
  });
}

export async function sendPasswordResetEmail({ to, resetUrl }: { to: string; resetUrl: string }) {
  await createTransporter().sendMail({
    from: requiredEnv("MAIL_FROM"),
    to,
    subject: "Reset your VanScout password",
    text: `Reset your VanScout password using this link:\n\n${resetUrl}\n\nThis link expires in one hour. If you did not request a password reset, you can ignore this email.`,
    html: `<p>Reset your VanScout password using the link below:</p><p><a href="${resetUrl}">Reset password</a></p><p>This link expires in one hour. If you did not request a password reset, you can ignore this email.</p>`,
  });
}

export async function sendEmailVerificationEmail({ to, verificationUrl }: { to: string; verificationUrl: string }) {
  await createTransporter().sendMail({
    from: requiredEnv("MAIL_FROM"),
    to,
    subject: "Confirm your VanScout email",
    text: `Confirm your VanScout email using this link:\n\n${verificationUrl}\n\nThis link expires in 24 hours. If you did not create a VanScout account, you can ignore this email.`,
    html: `<p>Confirm your VanScout email using the link below:</p><p><a href="${verificationUrl}">Confirm email</a></p><p>This link expires in 24 hours. If you did not create a VanScout account, you can ignore this email.</p>`,
  });
}
