export type TransportStatus = "looking_for_carriers" | "carrier_booked" | "completed";

export type TransportRequest = {
  id: string;
  category: string;
  itemName: string;
  description: string;
  lengthCm: number;
  widthCm: number;
  weightKg: number;
  pickup: {
    formatted: string;
    latitude: number;
    longitude: number;
  };
  delivery: {
    formatted: string;
    latitude: number;
    longitude: number;
  };
  timing: string;
  preferredDateFrom: string | null;
  preferredDateTo: string | null;
  status: TransportStatus;
  distanceKm: number;
  createdAt: string;
  updatedAt: string;
  imageIds: string[];
};

export type CreateTransportRequest = Omit<TransportRequest, "id" | "status" | "distanceKm" | "createdAt" | "updatedAt" | "imageIds">;
