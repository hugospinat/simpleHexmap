import { useMapAssetsVersionFromContext } from "@/editor/context/MapAssetsContext";

export function useMapAssetsVersion() {
  return useMapAssetsVersionFromContext();
}
