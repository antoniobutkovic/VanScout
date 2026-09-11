import nodemailer from "nodemailer";
import { requiredEnv } from "./config";

export async function sendPasswordResetEmail({ to, resetUrl }: { to: string; resetUrl: string }) {
  const port = Number(requiredEnv("SMTP_PORT"));
  if (!Number.isInteger(port)) throw new Error("SMTP_PORT must be a number");

  const transporter = nodemailer.createTransport({
    host: requiredEnv("SMTP_HOST"),
    port,
    secure: requiredEnv("SMTP_SECURE").toLowerCase() === "true",
    auth: {
      user: requiredEnv("SMTP_USER"),
      pass: requiredEnv("SMTP_PASSWORD"),
    },
  });

  await transporter.sendMail({
    from: requiredEnv("MAIL_FROM"),
    to,
    subject: "Reset your VanScout password",
    text: `Reset your VanScout password using this link:\n\n${resetUrl}\n\nThis link expires in one hour. If you did not request a password reset, you can ignore this email.`,
    html: `<p>Reset your VanScout password using the link below:</p><p><a href="${resetUrl}">Reset password</a></p><p>This link expires in one hour. If you did not request a password reset, you can ignore this email.</p>`,
  });
}

