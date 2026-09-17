export type AddressLocation = {
  formatted: string;
  latitude: number;
  longitude: number;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  postcode?: string;
  countryCode?: string;
  placeId?: string;
};

export type LocationSearchResponse = {
  results: AddressLocation[];
};
