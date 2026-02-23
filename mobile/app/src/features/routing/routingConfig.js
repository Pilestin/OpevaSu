const RAW_ENDPOINTS = {
  ALNS: process.env.EXPO_PUBLIC_ROUTING_ALNS_URL,
  SA: process.env.EXPO_PUBLIC_ROUTING_SA_URL,
  TS: process.env.EXPO_PUBLIC_ROUTING_TS_URL,
};

const ALGORITHMS = Object.keys(RAW_ENDPOINTS);

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

function isValidHttpUrl(value) {
  return /^https?:\/\/[^\s/$.?#].[^\s]*$/i.test(value);
}

export function getAlgorithms() {
  return ALGORITHMS;
}

export function getRoutingEndpoint(algorithm) {
  const normalized = normalizeUrl(RAW_ENDPOINTS[algorithm]);
  if (!normalized || !isValidHttpUrl(normalized)) {
    throw new Error(
      `Routing endpoint ayari gecersiz: ${algorithm}. EXPO_PUBLIC_ROUTING_${algorithm}_URL kontrol edin.`
    );
  }
  return normalized;
}
