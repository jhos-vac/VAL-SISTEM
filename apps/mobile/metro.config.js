// Expo configura Metro solo para monorepos (SDK 52+). Lo único extra: la
// web usa otra versión de React (19.2.8) y npm la deja en la raíz, así que
// paquetes hoisteados (react-native, @tanstack/react-query, ...) verían esa
// copia y el bundle terminaría con dos Reacts. Se fuerza a que todo
// `react` del bundle móvil salga de apps/mobile/node_modules.
const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

const SINGLETONS = ['react'];

config.resolver.resolveRequest = (context, moduleName, platform) => {
  const isSingleton = SINGLETONS.some(
    (name) => moduleName === name || moduleName.startsWith(`${name}/`),
  );
  if (isSingleton) {
    return {
      type: 'sourceFile',
      filePath: require.resolve(moduleName, { paths: [__dirname] }),
    };
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
