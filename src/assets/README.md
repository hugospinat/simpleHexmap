# Map Image Assets

Terrain and feature assets are generic browser images. The renderers support SVG and transparent PNG files through the same `HTMLImageElement` cache.

Bundled assets can live here:

- `src/assets/terrain/`
- `src/assets/features/`

Import them in `terrainAssets.ts` or `featureAssets.ts`, then register them with `defineMapImageAsset`.

Public assets can also be placed in:

- `public/assets/terrain/`
- `public/assets/features/`

For public assets, register the URL path directly, such as `defineMapImageAsset("/assets/terrain/forest.png")`.

