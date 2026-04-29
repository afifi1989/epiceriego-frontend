const { withAndroidManifest, withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

/**
 * Ecrit un network_security_config.xml.
 * - Variante `main`    (release + debug par defaut) : strict, refuse cleartext sauf domaines dev connus.
 * - Variante `debug`   (builds debug/expo-dev-client) : permissive, autorise tout cleartext
 *   pour que Metro puisse servir en HTTP depuis l'IP LAN (192.168.x.x, hotspot, etc.).
 *
 * Android merge automatiquement les ressources : en debug, la version debug
 * remplace la main → aucun trick `adb reverse` requis.
 */
const MAIN_CONFIG = `<?xml version="1.0" encoding="utf-8"?>
<network-security-config>
    <!-- Base strict : cleartext refuse, trust system + user CA -->
    <base-config cleartextTrafficPermitted="false">
        <trust-anchors>
            <certificates src="system" />
            <certificates src="user" />
        </trust-anchors>
    </base-config>

    <!-- API prod -->
    <domain-config cleartextTrafficPermitted="false">
        <domain includeSubdomains="true">178.170.49.149</domain>
        <domain includeSubdomains="true">afifi-mostafa.com</domain>
        <trust-anchors>
            <certificates src="system" />
            <certificates src="user" />
        </trust-anchors>
    </domain-config>

    <!-- Loopback (fallback pour tests locaux meme en release) -->
    <domain-config cleartextTrafficPermitted="true">
        <domain includeSubdomains="true">localhost</domain>
        <domain includeSubdomains="true">10.0.2.2</domain>
        <domain includeSubdomains="true">127.0.0.1</domain>
    </domain-config>
</network-security-config>
`;

const DEBUG_CONFIG = `<?xml version="1.0" encoding="utf-8"?>
<network-security-config>
    <!-- Debug build : on autorise tout cleartext pour que Metro (192.168.x.x, hotspot) fonctionne. -->
    <base-config cleartextTrafficPermitted="true">
        <trust-anchors>
            <certificates src="system" />
            <certificates src="user" />
        </trust-anchors>
    </base-config>
</network-security-config>
`;

function writeXml(filePath, content) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, content, 'utf8');
}

const withNetworkSecurityConfig = (config) => {
  // Etape 1 : ecrire les deux variantes du fichier XML
  config = withDangerousMod(config, [
    'android',
    async (config) => {
      const { platformProjectRoot } = config.modRequest;

      const mainXml = path.join(
        platformProjectRoot, 'app', 'src', 'main', 'res', 'xml', 'network_security_config.xml'
      );
      const debugXml = path.join(
        platformProjectRoot, 'app', 'src', 'debug', 'res', 'xml', 'network_security_config.xml'
      );

      writeXml(mainXml, MAIN_CONFIG);
      writeXml(debugXml, DEBUG_CONFIG);

      return config;
    },
  ]);

  // Etape 2 : referencer le config dans AndroidManifest.xml (application)
  config = withAndroidManifest(config, (config) => {
    const androidManifest = config.modResults.manifest;
    if (!androidManifest.application) androidManifest.application = [{}];
    const application = androidManifest.application[0];
    application.$['android:networkSecurityConfig'] = '@xml/network_security_config';
    return config;
  });

  return config;
};

module.exports = withNetworkSecurityConfig;
