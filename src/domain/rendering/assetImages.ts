const imageCache = new Map<string, HTMLImageElement>();

function canCreateImages(): boolean {
  return typeof window !== "undefined" && typeof Image !== "undefined";
}

function getOrCreateImage(src: string): HTMLImageElement | null {
  if (!canCreateImages()) {
    return null;
  }

  const existing = imageCache.get(src);

  if (existing) {
    return existing;
  }

  const image = new Image();
  image.decoding = "async";
  image.src = src;
  imageCache.set(src, image);
  return image;
}

export function getLoadedImage(src: string): HTMLImageElement | null {
  const image = getOrCreateImage(src);

  if (!image || !image.complete || image.naturalWidth === 0) {
    return null;
  }

  return image;
}

export function preloadImages(sources: string[], onAssetLoaded: () => void): () => void {
  const listeners: Array<() => void> = [];

  for (const src of sources) {
    const image = getOrCreateImage(src);

    if (!image || (image.complete && image.naturalWidth > 0)) {
      continue;
    }

    const handleLoad = () => onAssetLoaded();
    const handleError = () => onAssetLoaded();
    image.addEventListener("load", handleLoad, { once: true });
    image.addEventListener("error", handleError, { once: true });
    listeners.push(() => {
      image.removeEventListener("load", handleLoad);
      image.removeEventListener("error", handleError);
    });
  }

  return () => {
    for (const removeListener of listeners) {
      removeListener();
    }
  };
}

