import Constants from "expo-constants";

const extraEnv = Constants.expoConfig?.extra?.env || Constants.manifest2?.extra?.expoClient?.extra?.env || {};

function normalizeBoolean(value) {
  if (typeof value === "boolean") return value;
  const normalized = String(value || "").trim().toLowerCase();
  return ["1", "true", "yes", "on"].includes(normalized);
}

function normalizeUrl(value) {
  const trimmed = typeof value === "string" ? value.trim() : "";
  if (!trimmed) return "";
  const withProtocol = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : /^https?:/i.test(trimmed)
      ? trimmed.replace(/^https?:/i, (match) => `${match}//`)
      : "";
  return withProtocol.replace(/\/+$/, "");
}

export const runtimeConfig = {
  apiBaseUrl: normalizeUrl(extraEnv.apiBaseUrl),
  routingAlnsUrl: normalizeUrl(extraEnv.routingAlnsUrl),
  routingAlnstwUrl: normalizeUrl(extraEnv.routingAlnstwUrl),
  routingDqnUrl: normalizeUrl(extraEnv.routingDqnUrl),
  routingQlearningUrl: normalizeUrl(extraEnv.routingQlearningUrl),
  routingSaUrl: normalizeUrl(extraEnv.routingSaUrl),
  routingTsUrl: normalizeUrl(extraEnv.routingTsUrl),
  fleetVehiclesUrl: normalizeUrl(extraEnv.fleetVehiclesUrl),
  mapStyleUrl: normalizeUrl(extraEnv.mapStyleUrl),
  mapTilerKey: typeof extraEnv.mapTilerKey === "string" ? extraEnv.mapTilerKey.trim() : "",
  mapTilerStyleId: typeof extraEnv.mapTilerStyleId === "string" ? extraEnv.mapTilerStyleId.trim() : "",
  tomTomTrafficKey: typeof extraEnv.tomTomTrafficKey === "string" ? extraEnv.tomTomTrafficKey.trim() : "",
  tomTomTrafficStyle: typeof extraEnv.tomTomTrafficStyle === "string" ? extraEnv.tomTomTrafficStyle.trim() : "",
  googleMapsApiKeyConfigured: normalizeBoolean(extraEnv.googleMapsApiKeyConfigured),
};
