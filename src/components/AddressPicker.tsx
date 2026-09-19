import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from "react";
import { useLanguage } from "../i18n";
import type { AddressLocation, LocationSearchResponse } from "../lib/location";

type AddressPickerProps = {
  label: string;
  placeholder: string;
  value: AddressLocation | null;
  onChange: (location: AddressLocation | null) => void;
  precisionHint?: string;
};

const ZAGREB: [number, number] = [15.9819, 45.8150];

function resultSecondaryLine(result: AddressLocation) {
  return [result.addressLine1, result.addressLine2, result.city, result.postcode].filter(Boolean).join(" · ");
}

export function AddressPicker({ label, placeholder, value, onChange, precisionHint }: AddressPickerProps) {
  const { t } = useLanguage();
  const [query, setQuery] = useState(value?.formatted || "");
  const [results, setResults] = useState<AddressLocation[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isResolving, setIsResolving] = useState(false);
  const [error, setError] = useState("");
  const [activeIndex, setActiveIndex] = useState(-1);
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

    void import("maplibre-gl").then(({ default: maplibregl }) => {
      if (disposed || !mapContainerRef.current) return;
      const initialLocation = valueRef.current;
      const initialLongitude = initialLocation?.longitude ?? ZAGREB[0];
      const initialLatitude = initialLocation?.latitude ?? ZAGREB[1];

      map = new maplibregl.Map({
        container: mapContainerRef.current,
        style: "https://tiles.openfreemap.org/styles/liberty",
        center: [initialLongitude, initialLatitude],
        zoom: initialLocation ? 16 : 11,
      });
      map.on("dragend", () => {
        const coordinates = map?.getCenter();
        if (!coordinates) return;
        resolveCoordinatesRef.current(coordinates.lat, coordinates.lng);
      });
      map.on("click", event => {
        map?.easeTo({ center: event.lngLat, duration: 300 });
        resolveCoordinatesRef.current(event.lngLat.lat, event.lngLat.lng);
      });
      map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
      mapRef.current = map;
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
    mapRef.current.flyTo({ center: coordinates, zoom: Math.max(mapRef.current.getZoom(), 16), essential: true, duration: 550 });
  }, [value?.latitude, value?.longitude]);

  useEffect(() => {
    const text = query.trim();
    if (text.length < 3 || text === value?.formatted) {
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
  }, [query, t, value?.formatted]);

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
    <label className="address-picker-search">
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
    </label>
    {isSearching && <p className="address-picker-status" role="status">{t("Searching addresses…")}</p>}
    {results.length > 0 && <div id="location-suggestions" className="address-picker-results" role="listbox" aria-label={t("Search address or place")}>{results.map((result, index) => <button type="button" role="option" aria-selected={activeIndex === index} id={`location-suggestion-${index}`} className={activeIndex === index ? "active" : ""} key={`${result.placeId || result.formatted}-${result.latitude}-${result.longitude}`} onMouseDown={event => event.preventDefault()} onClick={() => selectLocation(result)}><span className="address-picker-result-icon" aria-hidden="true">⌖</span><span><b>{result.formatted}</b>{resultSecondaryLine(result) && <small>{resultSecondaryLine(result)}</small>}</span></button>)}</div>}
    {!isSearching && query.trim().length >= 3 && !value && results.length === 0 && !error && <p className="address-picker-status">{t("No matching addresses found")}</p>}
    <div className="address-picker-actions">
      <button type="button" className="address-picker-location-button" onClick={useCurrentLocation} disabled={isResolving}>{isResolving ? t("Finding your location…") : t("Use my location")}</button>
      <span>{t("Search powered by Geoapify")}</span>
    </div>
    <div className="address-picker-map-shell">
      <div ref={mapContainerRef} className="address-picker-map" aria-label={t("Map for selecting an exact location")} />
      <span className="address-picker-pin" aria-hidden="true"><svg viewBox="0 0 40 50"><path d="M20 2C10.06 2 2 10.06 2 20c0 13.5 18 28 18 28s18-14.5 18-28C38 10.06 29.94 2 20 2Z" /><circle cx="20" cy="20" r="6" /></svg></span>
      {!selected && <div className="address-picker-map-prompt" aria-hidden="true"><b>{t("Choose the exact location")}</b><span>{t("Search for an address or select a point on the map.")}</span></div>}
      {isResolving && <div className="address-picker-map-loading" role="status">{t("Finding address…")}</div>}
    </div>
    {precisionHint && <p className="address-picker-hint">{precisionHint}</p>}
    {error && <p className="field-error" role="alert">{error}</p>}
  </div>;
}
