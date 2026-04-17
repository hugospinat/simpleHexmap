import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { getAllMapAssetSources } from "@/assets/allAssets";
import { preloadImages } from "@/render/assetImages";

type MapAssetsContextValue = {
  version: number;
};

const MapAssetsContext = createContext<MapAssetsContextValue | null>(null);

type MapAssetsProviderProps = {
  children: ReactNode;
};

export function MapAssetsProvider({ children }: MapAssetsProviderProps) {
  const [version, setVersion] = useState(0);

  useEffect(() => (
    preloadImages(getAllMapAssetSources(), () => setVersion((currentVersion) => currentVersion + 1))
  ), []);

  const value = useMemo(() => ({ version }), [version]);

  return (
    <MapAssetsContext.Provider value={value}>
      {children}
    </MapAssetsContext.Provider>
  );
}

export function useMapAssetsVersionFromContext(): number {
  return useContext(MapAssetsContext)?.version ?? 0;
}
