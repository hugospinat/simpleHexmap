import { useEffect, useState } from "react";
import { getAllMapAssetSources } from "@/assets/allAssets";
import { preloadImages } from "@/domain/rendering/assetImages";

let sharedAssetVersion = 0;
let preloadStarted = false;
const subscribers = new Set<(version: number) => void>();

function notifyAssetLoaded() {
  sharedAssetVersion += 1;

  for (const subscriber of subscribers) {
    subscriber(sharedAssetVersion);
  }
}

function ensureAssetPreloadStarted() {
  if (preloadStarted) {
    return;
  }

  preloadStarted = true;
  preloadImages(getAllMapAssetSources(), notifyAssetLoaded);
}

export function useMapAssetsVersion() {
  const [assetVersion, setAssetVersion] = useState(sharedAssetVersion);

  useEffect(() => {
    subscribers.add(setAssetVersion);
    ensureAssetPreloadStarted();

    return () => {
      subscribers.delete(setAssetVersion);
    };
  }, []);

  return assetVersion;
}
