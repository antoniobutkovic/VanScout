import type { TransportRequest } from "./transport-types";

export type OfferStatus = "pending" | "confirmed" | "rejected";

export type TransportOffer = {
  id: string;
  transportId: string;
  carrierId: string;
  carrierName: string;
  companyName: string;
  completedTransports: number;
  priceCents: number;
  availableDate: string;
  message: string;
  status: OfferStatus;
  selectedByCustomer: boolean;
  carrierAgreed: boolean;
  confirmedAt: string | null;
  commissionCents: number;
  createdAt: string;
};

export type MarketplaceTransport = TransportRequest & {
  requesterName: string;
  offerCount: number;
  myOffer: TransportOffer | null;
};

export type CarrierProfile = {
  carrierId: string;
  carrierName: string;
  companyName: string;
  bio: string;
  completedTransports: number;
  imageIds: string[];
};

export type Conversation = {
  offerId: string;
  transportId: string;
  itemName: string;
  otherPartyName: string;
  companyName: string;
  priceCents: number;
  availableDate: string;
  offerMessage: string;
  role: "requester" | "transporter";
  status: OfferStatus;
  selectedByCustomer: boolean;
  carrierAgreed: boolean;
  confirmedAt: string | null;
  commissionCents: number;
  otherPartyEmail: string | null;
  otherPartyPhone: string | null;
  lastMessage: string | null;
  lastMessageAt: string | null;
};

export type ChatMessage = {
  id: string;
  senderId: string;
  senderName: string;
  body: string;
  createdAt: string;
};

export type CreditTransaction = {
  id: string;
  amountCents: number;
  kind: "purchase" | "commission" | "refund" | "adjustment";
  description: string;
  createdAt: string;
};

export type CreditAccount = {
  balanceCents: number;
  transactions: CreditTransaction[];
  stripeConfigured: boolean;
};
