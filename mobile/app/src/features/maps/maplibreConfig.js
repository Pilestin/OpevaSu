import { runtimeConfig } from "../../config/runtimeConfig";

const MAPLIBRE_DEMO_STYLE_URL = "https://demotiles.maplibre.org/style.json";
const MAP_STYLE_PRESETS = {
  streets: {
    id: "streets",
    label: "Standart",
    mapTilerStyleId: "streets-v2",
    expoMapType: "standard",
  },
  satellite: {
    id: "satellite",
    label: "Uydu",
    mapTilerStyleId: "satellite",
    expoMapType: "hybrid",
  },
  topo: {
    id: "topo",
    label: "Topo",
    mapTilerStyleId: "topo-v2",
    expoMapType: "terrain",
  },
};

export function getBaseMapOptions() {
  if (!runtimeConfig.mapTilerKey) {
    return [MAP_STYLE_PRESETS.streets];
  }

  return Object.values(MAP_STYLE_PRESETS);
}

export function resolveExpoMapType(presetId = "streets") {
  return MAP_STYLE_PRESETS[presetId]?.expoMapType || "standard";
}

export function resolveMapStyleUrl(presetId = "streets") {
  const selectedPreset = MAP_STYLE_PRESETS[presetId] || MAP_STYLE_PRESETS.streets;

  if (runtimeConfig.mapStyleUrl && presetId === "streets") {
    return runtimeConfig.mapStyleUrl;
  }

  if (runtimeConfig.mapTilerKey) {
    const styleId =
      selectedPreset.mapTilerStyleId ||
      runtimeConfig.mapTilerStyleId ||
      MAP_STYLE_PRESETS.streets.mapTilerStyleId;
    return `https://api.maptiler.com/maps/${encodeURIComponent(styleId)}/style.json?key=${encodeURIComponent(runtimeConfig.mapTilerKey)}`;
  }

  return MAPLIBRE_DEMO_STYLE_URL;
}

export function resolveTomTomTrafficTileUrl() {
  if (!runtimeConfig.tomTomTrafficKey) {
    return "";
  }

  const style = runtimeConfig.tomTomTrafficStyle || "relative0";
  return `https://api.tomtom.com/traffic/map/4/tile/flow/${encodeURIComponent(style)}/{z}/{x}/{y}.png?key=${encodeURIComponent(runtimeConfig.tomTomTrafficKey)}`;
}

export function toLngLat(coordinate) {
  if (!coordinate) return null;
  const latitude = Number(coordinate.latitude);
  const longitude = Number(coordinate.longitude);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  return [longitude, latitude];
}

export function lineFeatureFromCoordinates(coordinates = []) {
  const lngLatCoordinates = coordinates.map(toLngLat).filter(Boolean);
  return {
    type: "Feature",
    properties: {},
    geometry: {
      type: "LineString",
      coordinates: lngLatCoordinates,
    },
  };
}

export function pointFeatureFromCoordinate(coordinate, properties = {}) {
  const lngLat = toLngLat(coordinate);
  if (!lngLat) return null;
  return {
    type: "Feature",
    properties,
    geometry: {
      type: "Point",
      coordinates: lngLat,
    },
  };
}

export function getBoundsFromCoordinates(coordinates = []) {
  if (!coordinates.length) return null;
  const latitudes = coordinates.map((item) => item.latitude);
  const longitudes = coordinates.map((item) => item.longitude);
  return {
    ne: [Math.max(...longitudes), Math.max(...latitudes)],
    sw: [Math.min(...longitudes), Math.min(...latitudes)],
  };
}

export function zoomFromRegion(region) {
  const longitudeDelta = Number(region?.longitudeDelta);
  if (!Number.isFinite(longitudeDelta) || longitudeDelta <= 0) return 12;
  const zoom = Math.log2(360 / longitudeDelta);
  return Math.max(2, Math.min(18, zoom));
}
