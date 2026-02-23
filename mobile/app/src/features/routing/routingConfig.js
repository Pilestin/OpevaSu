const ROUTING_ENDPOINT_CONFIG = {
  ALNS: {
    envName: "EXPO_PUBLIC_ROUTING_ALNS_URL",
    value: process.env.EXPO_PUBLIC_ROUTING_ALNS_URL,
  },
  ALNSTW: {
    envName: "EXPO_PUBLIC_ROUTING_ALNSTW_URL",
    value: process.env.EXPO_PUBLIC_ROUTING_ALNSTW_URL,
  },
  DQN: {
    envName: "EXPO_PUBLIC_ROUTING_DQN_URL",
    value: process.env.EXPO_PUBLIC_ROUTING_DQN_URL,
  },
  Qlearning: {
    envName: "EXPO_PUBLIC_ROUTING_QLEARNING_URL",
    value: process.env.EXPO_PUBLIC_ROUTING_QLEARNING_URL,
  },
  SA: {
    envName: "EXPO_PUBLIC_ROUTING_SA_URL",
    value: process.env.EXPO_PUBLIC_ROUTING_SA_URL,
  },
  TS: {
    envName: "EXPO_PUBLIC_ROUTING_TS_URL",
    value: process.env.EXPO_PUBLIC_ROUTING_TS_URL,
  },
};

const ALGORITHMS = Object.keys(ROUTING_ENDPOINT_CONFIG);

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
  const config = ROUTING_ENDPOINT_CONFIG[algorithm];
  const normalized = normalizeUrl(config?.value);
  if (!normalized || !isValidHttpUrl(normalized)) {
    throw new Error(
      `Routing endpoint ayari gecersiz: ${algorithm}. ${config?.envName || "EXPO_PUBLIC_ROUTING_*"} kontrol edin.`
    );
  }
  return normalized;
}
