import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from "react";
import { useLanguage } from "../i18n";
import type { AddressLocation, LocationSearchResponse } from "../lib/location";

type AddressPickerProps = {
  label: string;
  placeholder: string;
  value: AddressLocation | null;
  onChange: (location: AddressLocation | null) => void;
  precisionHint?: string;
  showSearch?: boolean;
  showCurrentLocation?: boolean;
  radiusKm?: number;
};

const ZAGREB: [number, number] = [15.9819, 45.8150];
type MapCoordinate = { longitude: number; latitude: number };
const DEFAULT_RADIUS_CENTER: MapCoordinate = { longitude: ZAGREB[0], latitude: ZAGREB[1] };

function resultSecondaryLine(result: AddressLocation) {
  return [result.addressLine1, result.addressLine2, result.city, result.postcode].filter(Boolean).join(" · ");
}

function coordinatesOf(location: AddressLocation): MapCoordinate {
  return { longitude: location.longitude, latitude: location.latitude };
}

function radiusCircle(center: MapCoordinate, radiusKm: number) {
  const earthRadiusKm = 6371;
  const latitude = center.latitude * Math.PI / 180;
  const longitude = center.longitude * Math.PI / 180;
  const angularDistance = radiusKm / earthRadiusKm;
  const coordinates: [number, number][] = [];
  for (let point = 0; point <= 72; point += 1) {
    const bearing = point / 72 * Math.PI * 2;
    const nextLatitude = Math.asin(Math.sin(latitude) * Math.cos(angularDistance) + Math.cos(latitude) * Math.sin(angularDistance) * Math.cos(bearing));
    const nextLongitude = longitude + Math.atan2(Math.sin(bearing) * Math.sin(angularDistance) * Math.cos(latitude), Math.cos(angularDistance) - Math.sin(latitude) * Math.sin(nextLatitude));
    coordinates.push([nextLongitude * 180 / Math.PI, nextLatitude * 180 / Math.PI]);
  }
  return { type: "Feature" as const, properties: {}, geometry: { type: "Polygon" as const, coordinates: [coordinates] } };
}

function syncRadiusOverlay(map: import("maplibre-gl").Map, center: MapCoordinate, radiusKm?: number) {
  const container = map.getContainer();
  let overlay = container.querySelector<HTMLDivElement>(".address-picker-radius-overlay");
  if (!radiusKm) {
    overlay?.remove();
    return;
  }
  if (!overlay) {
    overlay = document.createElement("div");
    overlay.className = "address-picker-radius-overlay";
    overlay.setAttribute("aria-hidden", "true");
    container.append(overlay);
  }

  const ring = radiusCircle(center, radiusKm).geometry.coordinates[0];
  const north = map.project(ring[0]);
  const east = map.project(ring[18]);
  const south = map.project(ring[36]);
  const west = map.project(ring[54]);
  overlay.style.left = `${Math.min(east.x, west.x)}px`;
  overlay.style.top = `${Math.min(north.y, south.y)}px`;
  overlay.style.width = `${Math.abs(east.x - west.x)}px`;
  overlay.style.height = `${Math.abs(south.y - north.y)}px`;
}

function fitMapToRadius(map: import("maplibre-gl").Map, center: MapCoordinate, radiusKm: number) {
  const coordinates = radiusCircle(center, radiusKm).geometry.coordinates[0];
  const longitudes = coordinates.map(([longitude]) => longitude);
  const latitudes = coordinates.map(([, latitude]) => latitude);
  map.resize();
  map.fitBounds([
    [Math.min(...longitudes), Math.min(...latitudes)],
    [Math.max(...longitudes), Math.max(...latitudes)],
  ], {
    padding: { top: 64, right: 46, bottom: 46, left: 46 },
    maxZoom: 14,
    essential: true,
    duration: 550,
  });
}

export function AddressPicker({ label, placeholder, value, onChange, precisionHint, showSearch = true, showCurrentLocation = true, radiusKm }: AddressPickerProps) {
  const { t } = useLanguage();
  const [query, setQuery] = useState(value?.formatted || "");
  const [results, setResults] = useState<AddressLocation[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isResolving, setIsResolving] = useState(false);
  const [error, setError] = useState("");
  const [activeIndex, setActiveIndex] = useState(-1);
  const [isMapReady, setIsMapReady] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<import("maplibre-gl").Map | null>(null);
  const resolveCoordinatesRef = useRef<(latitude: number, longitude: number) => void>(() => undefined);
  const valueRef = useRef<AddressLocation | null>(value);
  const radiusKmRef = useRef(radiusKm);
  const radiusCenterRef = useRef<MapCoordinate>(value ? coordinatesOf(value) : DEFAULT_RADIUS_CENTER);
  valueRef.current = value;
  radiusKmRef.current = radiusKm;
  if (value) radiusCenterRef.current = coordinatesOf(value);

  useEffect(() => {
    if (value?.formatted) setQuery(value.formatted);
  }, [value?.formatted]);

  const selectLocation = useCallback((location: AddressLocation) => {
    setQuery(location.formatted);
    setResults([]);
    setActiveIndex(-1);
    setError("");
    onChange(location);
  }, [onChange]);

  const resolveCoordinates = useCallback(async (latitude: number, longitude: number) => {
    setIsResolving(true);
    setError("");
    try {
      const response = await fetch(`/api/locations/reverse?lat=${encodeURIComponent(latitude)}&lon=${encodeURIComponent(longitude)}`);
      const payload = await response.json() as { location?: AddressLocation; error?: string };
      if (!response.ok || !payload.location) throw new Error(payload.error || "Unable to identify this location");
      selectLocation(payload.location);
    } catch {
      setError(t("Couldn't identify this point. Try a nearby point or search for the address."));
    } finally {
      setIsResolving(false);
    }
  }, [selectLocation, t]);

  resolveCoordinatesRef.current = (latitude, longitude) => { void resolveCoordinates(latitude, longitude); };

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;
    let disposed = false;
    let map: import("maplibre-gl").Map | null = null;

    void import("maplibre-gl").then(maplibregl => {
      if (disposed || !mapContainerRef.current) return;
      const initialLocation = valueRef.current;
      const initialCenter = initialLocation ? coordinatesOf(initialLocation) : radiusCenterRef.current;

      const nextMap = new maplibregl.Map({
        container: mapContainerRef.current,
        style: {
          version: 8,
          sources: {
            geoapify: {
              type: "raster",
              tiles: ["/api/map-tiles/{z}/{x}/{y}"],
              tileSize: 256,
              attribution: "© <a href=\"https://www.openstreetmap.org/copyright\" target=\"_blank\" rel=\"noreferrer\">OpenStreetMap</a> contributors · <a href=\"https://www.geoapify.com/\" target=\"_blank\" rel=\"noreferrer\">Geoapify</a>",
            },
          },
          layers: [
            { id: "geoapify", type: "raster", source: "geoapify" },
          ],
        },
        center: [initialCenter.longitude, initialCenter.latitude],
        zoom: initialLocation ? 16 : 11,
      });
      nextMap.on("dragend", () => {
        const coordinates = nextMap.getCenter();
        radiusCenterRef.current = { longitude: coordinates.lng, latitude: coordinates.lat };
        syncRadiusOverlay(nextMap, radiusCenterRef.current, radiusKmRef.current);
        resolveCoordinatesRef.current(coordinates.lat, coordinates.lng);
      });
      nextMap.on("click", event => {
        radiusCenterRef.current = { longitude: event.lngLat.lng, latitude: event.lngLat.lat };
        syncRadiusOverlay(nextMap, radiusCenterRef.current, radiusKmRef.current);
        nextMap.easeTo({ center: event.lngLat, duration: 300 });
        resolveCoordinatesRef.current(event.lngLat.lat, event.lngLat.lng);
      });
      nextMap.on("move", () => syncRadiusOverlay(nextMap, radiusCenterRef.current, radiusKmRef.current));
      nextMap.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
      map = nextMap;
      mapRef.current = nextMap;
      const initializeRadius = () => {
        if (disposed) return;
        syncRadiusOverlay(nextMap, radiusCenterRef.current, radiusKmRef.current);
        if (radiusKmRef.current) fitMapToRadius(nextMap, radiusCenterRef.current, radiusKmRef.current);
        setIsMapReady(true);
      };
      if (nextMap.isStyleLoaded()) initializeRadius();
      else nextMap.once("load", initializeRadius);
    });

    return () => {
      disposed = true;
      mapRef.current = null;
      map?.remove();
    };
  }, []);

  useEffect(() => {
    if (!mapRef.current || !isMapReady) return;
    const center = value ? coordinatesOf(value) : radiusCenterRef.current;
    radiusCenterRef.current = center;
    const coordinates: [number, number] = [center.longitude, center.latitude];
    const frame = window.requestAnimationFrame(() => {
      const map = mapRef.current;
      if (!map) return;
      syncRadiusOverlay(map, center, radiusKm);
      if (radiusKm) {
        fitMapToRadius(map, center, radiusKm);
      } else if (value) {
        map.flyTo({ center: coordinates, zoom: Math.max(map.getZoom(), 16), essential: true, duration: 550 });
      }
    });
    return () => window.cancelAnimationFrame(frame);
  }, [isMapReady, radiusKm, value?.latitude, value?.longitude]);

  useEffect(() => {
    const text = query.trim();
    if (!showSearch || text.length < 3 || text === value?.formatted) {
      setResults([]);
      setIsSearching(false);
      return;
    }

    const controller = new AbortController();
    const timeout = window.setTimeout(() => {
      setIsSearching(true);
      setError("");
      void fetch(`/api/locations/autocomplete?text=${encodeURIComponent(text)}`, { signal: controller.signal })
        .then(async response => {
          const payload = await response.json() as LocationSearchResponse & { error?: string };
          if (!response.ok) throw new Error(payload.error || "Unable to search locations");
          setResults(payload.results || []);
          setActiveIndex(-1);
        })
        .catch(searchError => {
          if (searchError instanceof DOMException && searchError.name === "AbortError") return;
          setResults([]);
          setError(t("Unable to find addresses right now"));
        })
        .finally(() => {
          if (!controller.signal.aborted) setIsSearching(false);
        });
    }, 350);

    return () => {
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [query, showSearch, t, value?.formatted]);

  const onInputChange = (nextQuery: string) => {
    setQuery(nextQuery);
    setActiveIndex(-1);
    if (value) onChange(null);
  };

  const onInputKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown" && results.length) {
      event.preventDefault();
      setActiveIndex(index => Math.min(index + 1, results.length - 1));
    } else if (event.key === "ArrowUp" && results.length) {
      event.preventDefault();
      setActiveIndex(index => Math.max(index - 1, 0));
    } else if (event.key === "Enter" && activeIndex >= 0) {
      event.preventDefault();
      selectLocation(results[activeIndex]);
    } else if (event.key === "Escape") {
      setResults([]);
      setActiveIndex(-1);
    }
  };

  const useCurrentLocation = () => {
    if (!navigator.geolocation) {
      setError(t("Location services are unavailable. Search for an address instead."));
      return;
    }
    setError("");
    setIsResolving(true);
    navigator.geolocation.getCurrentPosition(
      position => void resolveCoordinates(position.coords.latitude, position.coords.longitude),
      () => {
        setIsResolving(false);
        setError(t("Location services are unavailable. Search for an address instead."));
      },
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 60_000 },
    );
  };

  const selected = Boolean(value);
  return <div className={`address-picker ${selected ? "has-location" : ""}`}>
    {showSearch && <label className="address-picker-search">
      <span>{label}</span>
      <div className="address-picker-input-wrap">
        <span className="address-picker-search-icon" aria-hidden="true">⌕</span>
        <input
          ref={inputRef}
          value={query}
          onChange={event => onInputChange(event.target.value)}
          onKeyDown={onInputKeyDown}
          onFocus={() => { if (query.trim().length >= 3 && query !== value?.formatted) setActiveIndex(-1); }}
          placeholder={placeholder}
          autoComplete="off"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={results.length > 0}
          aria-controls="location-suggestions"
          aria-activedescendant={activeIndex >= 0 ? `location-suggestion-${activeIndex}` : undefined}
        />
        {query && <button type="button" className="address-picker-clear" onClick={() => { onInputChange(""); inputRef.current?.focus(); }} aria-label={t("Clear location")}>×</button>}
      </div>
    </label>}
    {showSearch && isSearching && <p className="address-picker-status" role="status">{t("Searching addresses…")}</p>}
    {showSearch && results.length > 0 && <div id="location-suggestions" className="address-picker-results" role="listbox" aria-label={t("Search address or place")}>{results.map((result, index) => <button type="button" role="option" aria-selected={activeIndex === index} id={`location-suggestion-${index}`} className={activeIndex === index ? "active" : ""} key={`${result.placeId || result.formatted}-${result.latitude}-${result.longitude}`} onMouseDown={event => event.preventDefault()} onClick={() => selectLocation(result)}><span className="address-picker-result-icon" aria-hidden="true">⌖</span><span><b>{result.formatted}</b>{resultSecondaryLine(result) && <small>{resultSecondaryLine(result)}</small>}</span></button>)}</div>}
    {showSearch && !isSearching && query.trim().length >= 3 && !value && results.length === 0 && !error && <p className="address-picker-status">{t("No matching addresses found")}</p>}
    {showCurrentLocation && <div className="address-picker-actions">
      <button type="button" className="address-picker-location-button" onClick={useCurrentLocation} disabled={isResolving}>{isResolving ? t("Finding your location…") : t("Use my location")}</button>
      {showSearch && <span>{t("Search powered by Geoapify")}</span>}
    </div>}
    <div className="address-picker-map-shell">
      <div ref={mapContainerRef} className="address-picker-map" aria-label={t("Map for selecting an exact location")} />
      <span className="address-picker-pin" aria-hidden="true"><svg viewBox="0 0 40 50"><path d="M20 2C10.06 2 2 10.06 2 20c0 13.5 18 28 18 28s18-14.5 18-28C38 10.06 29.94 2 20 2Z" /><circle cx="20" cy="20" r="6" /></svg></span>
      {isResolving && <div className="address-picker-map-loading" role="status">{t("Finding address…")}</div>}
    </div>
    {precisionHint && <p className="address-picker-hint">{precisionHint}</p>}
    {error && <p className="field-error" role="alert">{error}</p>}
  </div>;
}
