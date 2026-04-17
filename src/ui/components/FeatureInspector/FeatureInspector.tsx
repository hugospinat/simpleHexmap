import { canFeatureOverrideTerrain } from "@/assets/featureAssets";
import {
  featureHexIdToAxial,
  featureKindLabels,
  featureKinds,
  type Feature
} from "@/core/map/features";

type FeatureInspectorProps = {
  canEditStructure: boolean;
  feature: Feature;
  onChange: (
    updates: Partial<
      Pick<Feature, "gmLabel" | "hidden" | "kind" | "labelRevealed" | "overrideTerrainTile" | "playerLabel">
    >
  ) => void;
  onClose: () => void;
  onDelete: () => void;
};

export function FeatureInspector({
  canEditStructure,
  feature,
  onChange,
  onClose,
  onDelete
}: FeatureInspectorProps) {
  const coord = featureHexIdToAxial(feature.hexId);
  const canOverrideTerrain = canFeatureOverrideTerrain(feature.kind);

  return (
    <aside className="feature-inspector" aria-label="Feature inspector">
      <div className="inspector-heading">
        <div>
          <span className="eyebrow">Feature</span>
          <h2>{featureKindLabels[feature.kind]}</h2>
        </div>
        <button type="button" className="compact-button" onClick={onClose}>
          Close
        </button>
      </div>

      <dl className="inspector-meta">
        <div>
          <dt>Type</dt>
          <dd>{featureKindLabels[feature.kind]}</dd>
        </div>
        <div>
          <dt>Hex</dt>
          <dd>
            q {coord.q}, r {coord.r}
          </dd>
        </div>
      </dl>

      <label className="label-field">
        <span>Type</span>
        <select
          value={feature.kind}
          disabled={!canEditStructure}
          onChange={(event) => {
            const nextKind = event.target.value as Feature["kind"];
            const canOverrideWithNextKind = canFeatureOverrideTerrain(nextKind);

            onChange({
              kind: nextKind,
              overrideTerrainTile: canOverrideWithNextKind ? feature.overrideTerrainTile : false
            });
          }}
        >
          {featureKinds.map((kind) => (
            <option key={kind} value={kind}>
              {featureKindLabels[kind]}
            </option>
          ))}
        </select>
      </label>

      <label className="check-field">
        <input
          type="checkbox"
          checked={feature.overrideTerrainTile && canOverrideTerrain}
          disabled={!canOverrideTerrain}
          onChange={(event) => onChange({ overrideTerrainTile: event.target.checked })}
        />
        <span>Override terrain tile</span>
      </label>

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
          placeholder="optional"
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

      <label className="check-field">
        <input
          type="checkbox"
          checked={feature.labelRevealed ?? false}
          onChange={(event) => onChange({ labelRevealed: event.target.checked })}
        />
        <span>Player label revealed</span>
      </label>

      {canEditStructure ? (
        <button type="button" className="danger-button" onClick={onDelete}>
          Delete feature
        </button>
      ) : null}
    </aside>
  );
}
