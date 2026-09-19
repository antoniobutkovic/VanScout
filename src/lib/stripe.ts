import Stripe from "stripe";
import { optionalEnv } from "./config";

let client: Stripe | null = null;

export function isStripeConfigured() {
  return Boolean(optionalEnv("STRIPE_SECRET_KEY") && optionalEnv("STRIPE_WEBHOOK_SECRET"));
}

export function stripeClient() {
  const secretKey = optionalEnv("STRIPE_SECRET_KEY");
  if (!secretKey) return null;
  client ??= new Stripe(secretKey);
  return client;
}

