import type { AddressLocation } from "./location";

type DirectionsLocation = Pick<AddressLocation, "latitude" | "longitude">;

/** Returns a Google Maps driving-directions URL for the saved pickup and delivery coordinates. */
export function googleMapsDirectionsUrl(pickup: DirectionsLocation, delivery: DirectionsLocation) {
  const query = new URLSearchParams({
    api: "1",
    origin: `${pickup.latitude},${pickup.longitude}`,
    destination: `${delivery.latitude},${delivery.longitude}`,
    travelmode: "driving",
  });

  return `https://www.google.com/maps/dir/?${query.toString()}`;
}
