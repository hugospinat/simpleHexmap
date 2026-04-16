import { useEffect, useState } from "react";
import { getAllMapAssetSources } from "@/assets/allAssets";
import { preloadImages } from "@/domain/rendering/assetImages";

export function useMapAssetsVersion() {
  const [assetVersion, setAssetVersion] = useState(0);

  useEffect(() => {
    return preloadImages(getAllMapAssetSources(), () => setAssetVersion((version) => version + 1));
  }, []);

  return assetVersion;
}
