import type { ForgeConfig } from '@electron-forge/shared-types';
import { MakerZIP } from '@electron-forge/maker-zip';
import { AutoUnpackNativesPlugin } from '@electron-forge/plugin-auto-unpack-natives';
import { VitePlugin } from '@electron-forge/plugin-vite';

const includedAppFiles = new Set(['/package.json', '/node_modules']);

const includedAppPathPrefixes = [
  '/.vite',
  '/node_modules/better-sqlite3',
  '/node_modules/bindings',
  '/node_modules/file-uri-to-path',
];

const config: ForgeConfig = {
  packagerConfig: {
    asar: true,
    ignore: (filePath) => {
      if (!filePath) {
        return false;
      }

      if (includedAppFiles.has(filePath)) {
        return false;
      }

      return !includedAppPathPrefixes.some(
        (includedPath) => filePath === includedPath || filePath.startsWith(`${includedPath}/`),
      );
    },
    name: 'Garlic Sauce',
  },
  rebuildConfig: {},
  makers: [new MakerZIP({}, ['darwin', 'linux', 'win32'])],
  plugins: [
    new AutoUnpackNativesPlugin({}),
    new VitePlugin({
      build: [
        {
          entry: 'src/main.ts',
          config: 'vite.main.config.ts',
        },
        {
          entry: 'src/preload.ts',
          config: 'vite.preload.config.ts',
        },
      ],
      renderer: [
        {
          name: 'main_window',
          config: 'vite.renderer.config.ts',
        },
      ],
    }),
  ],
};

export default config;
