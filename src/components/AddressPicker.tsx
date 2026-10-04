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
  radiusKm?: number;
};

const ZAGREB: [number, number] = [15.9819, 45.8150];

function resultSecondaryLine(result: AddressLocation) {
  return [result.addressLine1, result.addressLine2, result.city, result.postcode].filter(Boolean).join(" · ");
}

function radiusCircle(location: AddressLocation, radiusKm: number) {
  const earthRadiusKm = 6371;
  const latitude = location.latitude * Math.PI / 180;
  const longitude = location.longitude * Math.PI / 180;
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

export function AddressPicker({ label, placeholder, value, onChange, precisionHint, showSearch = true, radiusKm }: AddressPickerProps) {
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
  valueRef.current = value;

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
      const initialLongitude = initialLocation?.longitude ?? ZAGREB[0];
      const initialLatitude = initialLocation?.latitude ?? ZAGREB[1];

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
          layers: [{ id: "geoapify", type: "raster", source: "geoapify" }],
        },
        center: [initialLongitude, initialLatitude],
        zoom: initialLocation ? 16 : 11,
      });
      nextMap.on("dragend", () => {
        const coordinates = nextMap.getCenter();
        resolveCoordinatesRef.current(coordinates.lat, coordinates.lng);
      });
      nextMap.on("click", event => {
        nextMap.easeTo({ center: event.lngLat, duration: 300 });
        resolveCoordinatesRef.current(event.lngLat.lat, event.lngLat.lng);
      });
      nextMap.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
      map = nextMap;
      mapRef.current = nextMap;
      nextMap.on("load", () => setIsMapReady(true));
    });

    return () => {
      disposed = true;
      mapRef.current = null;
      map?.remove();
    };
  }, []);

  useEffect(() => {
    if (!value || !mapRef.current) return;
    const coordinates: [number, number] = [value.longitude, value.latitude];
    if (radiusKm) {
      const latitudeOffset = radiusKm / 111.32;
      const longitudeOffset = radiusKm / (111.32 * Math.cos(value.latitude * Math.PI / 180));
      mapRef.current.fitBounds([[value.longitude - longitudeOffset, value.latitude - latitudeOffset], [value.longitude + longitudeOffset, value.latitude + latitudeOffset]], { padding: 46, maxZoom: 14, essential: true, duration: 550 });
    } else {
      mapRef.current.flyTo({ center: coordinates, zoom: Math.max(mapRef.current.getZoom(), 16), essential: true, duration: 550 });
    }
  }, [radiusKm, value?.latitude, value?.longitude]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isMapReady) return;
    const sourceId = "address-picker-radius";
    const fillLayerId = "address-picker-radius-fill";
    const outlineLayerId = "address-picker-radius-outline";
    if (!value || !radiusKm) {
      if (map.getLayer(outlineLayerId)) map.removeLayer(outlineLayerId);
      if (map.getLayer(fillLayerId)) map.removeLayer(fillLayerId);
      if (map.getSource(sourceId)) map.removeSource(sourceId);
      return;
    }
    const data = radiusCircle(value, radiusKm);
    const source = map.getSource(sourceId) as import("maplibre-gl").GeoJSONSource | undefined;
    if (source) source.setData(data);
    else {
      map.addSource(sourceId, { type: "geojson", data });
      map.addLayer({ id: fillLayerId, type: "fill", source: sourceId, paint: { "fill-color": "#48623d", "fill-opacity": .16 } });
      map.addLayer({ id: outlineLayerId, type: "line", source: sourceId, paint: { "line-color": "#365031", "line-width": 2, "line-opacity": .8 } });
    }
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
    <div className="address-picker-actions">
      <button type="button" className="address-picker-location-button" onClick={useCurrentLocation} disabled={isResolving}>{isResolving ? t("Finding your location…") : t("Use my location")}</button>
      {showSearch && <span>{t("Search powered by Geoapify")}</span>}
    </div>
    <div className="address-picker-map-shell">
      <div ref={mapContainerRef} className="address-picker-map" aria-label={t("Map for selecting an exact location")} />
      <span className="address-picker-pin" aria-hidden="true"><svg viewBox="0 0 40 50"><path d="M20 2C10.06 2 2 10.06 2 20c0 13.5 18 28 18 28s18-14.5 18-28C38 10.06 29.94 2 20 2Z" /><circle cx="20" cy="20" r="6" /></svg></span>
      {isResolving && <div className="address-picker-map-loading" role="status">{t("Finding address…")}</div>}
    </div>
    {precisionHint && <p className="address-picker-hint">{precisionHint}</p>}
    {error && <p className="field-error" role="alert">{error}</p>}
  </div>;
}
