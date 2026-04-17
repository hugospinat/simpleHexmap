import {
  featureKindLabels,
  featureKinds,
  type FeatureKind
} from "@/core/map/features";
import { FeatureKindPreview } from "@/ui/components/FeaturePalette/FeatureKindPreview";

type FeaturePaletteProps = {
  activeKind: FeatureKind;
  onKindChange: (kind: FeatureKind) => void;
};

export function FeaturePalette({
  activeKind,
  onKindChange
}: FeaturePaletteProps) {
  return (
    <section className="panel feature-panel">
      <h2>Features</h2>
      <div className="active-tile">
        <span>Mark</span>
        <strong>{featureKindLabels[activeKind]}</strong>
      </div>
      <div className="feature-palette" aria-label="Feature palette">
        {featureKinds.map((featureKind) => (
          <button
            type="button"
            key={featureKind}
            className={
              activeKind === featureKind
                ? "feature-button is-active"
                : "feature-button"
            }
            onClick={() => onKindChange(featureKind)}
          >
            <FeatureKindPreview
              type={featureKind}
              selected={activeKind === featureKind}
            />
            <span>{featureKindLabels[featureKind]}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
