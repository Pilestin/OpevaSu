const fs = require("fs");
const path = require("path");
const { withAndroidManifest, withDangerousMod } = require("@expo/config-plugins");

const NETWORK_SECURITY_XML = `<?xml version="1.0" encoding="utf-8"?>
<network-security-config>
  <base-config cleartextTrafficPermitted="true" />
</network-security-config>
`;

function withAndroidCleartext(config) {
  const withManifest = withAndroidManifest(config, (modConfig) => {
    const app = modConfig.modResults.manifest.application?.[0];
    if (app) {
      app.$ = app.$ || {};
      app.$["android:usesCleartextTraffic"] = "true";
      app.$["android:networkSecurityConfig"] = "@xml/network_security_config";
    }
    return modConfig;
  });

  return withDangerousMod(withManifest, [
    "android",
    async (modConfig) => {
      const xmlDir = path.join(modConfig.modRequest.platformProjectRoot, "app", "src", "main", "res", "xml");
      await fs.promises.mkdir(xmlDir, { recursive: true });
      await fs.promises.writeFile(path.join(xmlDir, "network_security_config.xml"), NETWORK_SECURITY_XML, "utf8");
      return modConfig;
    },
  ]);
}

module.exports = withAndroidCleartext;
