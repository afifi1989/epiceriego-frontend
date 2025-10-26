const { withAndroidManifest } = require('@expo/config-plugins');

const withNetworkSecurityConfig = (config) => {
  return withAndroidManifest(config, (config) => {
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
};

module.exports = withNetworkSecurityConfig;
