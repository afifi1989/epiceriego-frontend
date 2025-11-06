const { withAndroidManifest, withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const withNetworkSecurityConfig = (config) => {
  // Étape 1 : Créer le fichier network_security_config.xml
  config = withDangerousMod(config, [
    'android',
    async (config) => {
      const { platformProjectRoot } = config.modRequest;
      
      const xmlDir = path.join(
        platformProjectRoot,
        'app',
        'src',
        'main',
        'res',
        'xml'
      );
      
      const xmlFile = path.join(xmlDir, 'network_security_config.xml');
      
      // Créer le dossier s'il n'existe pas
      if (!fs.existsSync(xmlDir)) {
        fs.mkdirSync(xmlDir, { recursive: true });
      }
      
      // Créer le fichier XML
      const xmlContent = `<?xml version="1.0" encoding="utf-8"?>
<network-security-config>
    <!-- Configuration pour le développement - Accepte les certificats auto-signés -->
    <base-config cleartextTrafficPermitted="false">
        <trust-anchors>
            <!-- Certificats système -->
            <certificates src="system" />
            <!-- Certificats utilisateur (pour les certificats auto-signés) -->
            <certificates src="user" />
        </trust-anchors>
    </base-config>
    
    <!-- Domaine spécifique pour le serveur de développement -->
    <domain-config cleartextTrafficPermitted="false">
        <domain includeSubdomains="true">178.170.49.149</domain>
        <trust-anchors>
            <certificates src="system" />
            <certificates src="user" />
        </trust-anchors>
    </domain-config>
    
    <!-- Permettre localhost pour les tests locaux -->
    <domain-config cleartextTrafficPermitted="true">
        <domain includeSubdomains="true">localhost</domain>
        <domain includeSubdomains="true">10.0.2.2</domain>
        <domain includeSubdomains="true">127.0.0.1</domain>
    </domain-config>
</network-security-config>`;
      
      fs.writeFileSync(xmlFile, xmlContent, 'utf8');
      
      return config;
    },
  ]);

  // Étape 2 : Ajouter la référence dans AndroidManifest.xml
  config = withAndroidManifest(config, (config) => {
    const androidManifest = config.modResults.manifest;

    // Ajouter networkSecurityConfig à l'application
    if (!androidManifest.application) {
      androidManifest.application = [{}];
    }

    const application = androidManifest.application[0];
    
    // Ajouter l'attribut networkSecurityConfig
    application.$['android:networkSecurityConfig'] = '@xml/network_security_config';

    return config;
  });

  return config;
};

module.exports = withNetworkSecurityConfig;
