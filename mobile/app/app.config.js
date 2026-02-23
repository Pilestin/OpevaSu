const googleMapsApiKey = process.env.GOOGLE_MAPS_API_KEY;

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
    },
  },
};
