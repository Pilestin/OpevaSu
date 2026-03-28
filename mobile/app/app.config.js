const path = require("path");
const dotenv = require("dotenv");

dotenv.config({ path: path.resolve(__dirname, "../../.env") });
dotenv.config();

const googleMapsApiKey = process.env.GOOGLE_MAPS_API_KEY;
const runtimeEnv = {
  apiBaseUrl: process.env.EXPO_PUBLIC_API_BASE_URL || "",
  routingAlnsUrl: process.env.EXPO_PUBLIC_ROUTING_ALNS_URL || "",
  routingAlnstwUrl: process.env.EXPO_PUBLIC_ROUTING_ALNSTW_URL || "",
  routingDqnUrl: process.env.EXPO_PUBLIC_ROUTING_DQN_URL || "",
  routingQlearningUrl: process.env.EXPO_PUBLIC_ROUTING_QLEARNING_URL || "",
  routingSaUrl: process.env.EXPO_PUBLIC_ROUTING_SA_URL || "",
  routingTsUrl: process.env.EXPO_PUBLIC_ROUTING_TS_URL || "",
  fleetVehiclesUrl: process.env.EXPO_PUBLIC_FLEET_VEHICLES_URL || "",
};

const androidConfig = {
  package: "com.opevasu.mobile",
  versionCode: 2,
  usesCleartextTraffic: true,
  adaptiveIcon: {
    foregroundImage: "./assets/opeva-logo-2.png",
    backgroundColor: "#10947A",
  },
};

if (googleMapsApiKey) {
  androidConfig.config = {
    googleMaps: {
      apiKey: googleMapsApiKey,
    },
  };
}

module.exports = {
  expo: {
    name: "OpevaSu Mobile",
    slug: "opevasu-mobile",
    version: "1.0.0",
    icon: "./assets/opeva-logo-2.png",
    orientation: "portrait",
    userInterfaceStyle: "light",
    assetBundlePatterns: ["**/*"],
    ios: {
      supportsTablet: true,
    },
    android: androidConfig,
    web: {
      bundler: "metro",
    },
    plugins: ["expo-asset", "expo-font", "./plugins/withAndroidCleartext"],
    extra: {
      eas: {
        projectId: "fe7affa3-4ea9-4115-a2ed-18eceba52ff0",
      },
      env: runtimeEnv,
    },
  },
};
