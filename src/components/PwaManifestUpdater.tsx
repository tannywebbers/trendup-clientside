import { usePwaManifest } from "@/hooks/use-pwa-manifest";

export function PwaManifestUpdater() {
  usePwaManifest();
  return null;
}
