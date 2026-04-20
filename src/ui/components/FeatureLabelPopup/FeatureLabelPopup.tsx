import {
  featureHexIdToAxial,
  featureKindLabels,
  type Feature
} from "@/core/map/features";

type FeatureLabelPopupProps = {
  feature: Feature;
  onChange: (updates: Partial<Pick<Feature, "gmLabel" | "hidden" | "playerLabel">>) => void;
  onClose: () => void;
};

export function FeatureLabelPopup({ feature, onChange, onClose }: FeatureLabelPopupProps) {
  const coord = featureHexIdToAxial(feature.hexId);

  return (
    <aside className="feature-label-popup" aria-label="Feature labels">
      <div className="feature-label-popup-heading">
        <div>
          <span className="eyebrow">Feature</span>
          <h2>{featureKindLabels[feature.kind]}</h2>
          <p>
            q {coord.q}, r {coord.r}
          </p>
        </div>
        <button type="button" className="compact-button" onClick={onClose}>
          Close
        </button>
      </div>

      <label className="label-field">
        <span>GM label</span>
        <input
          value={feature.gmLabel ?? ""}
          onChange={(event) => onChange({ gmLabel: event.target.value })}
          placeholder="internal"
        />
      </label>

      <label className="label-field">
        <span>Player label</span>
        <input
          value={feature.playerLabel ?? ""}
          onChange={(event) => onChange({ playerLabel: event.target.value })}
          placeholder="public"
        />
      </label>

      <label className="check-field">
        <input
          type="checkbox"
          checked={feature.hidden}
          onChange={(event) => onChange({ hidden: event.target.checked })}
        />
        <span>Hidden from players</span>
      </label>
    </aside>
  );
}
