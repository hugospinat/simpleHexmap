import { terrainTypes, type TerrainType } from "@/domain/world/world";
import { TerrainTilePreview } from "@/ui/components/TilePalette/TerrainTilePreview";
import { tileLabels } from "@/domain/rendering/tileVisuals";

type TilePaletteProps = {
  activeType: TerrainType;
  onTypeChange: (type: TerrainType) => void;
};

export function TilePalette({ activeType, onTypeChange }: TilePaletteProps) {
  return (
    <section className="panel palette-panel">
      <h2>Terrain</h2>
      <div className="active-tile">
        <span>Brush</span>
        <strong>{tileLabels[activeType]}</strong>
      </div>
      <div className="tile-palette" aria-label="Tile palette">
        {terrainTypes.map((tileType) => (
          <button
            type="button"
            key={tileType}
            className={activeType === tileType ? "tile-button is-active" : "tile-button"}
            onClick={() => onTypeChange(tileType)}
          >
            <TerrainTilePreview type={tileType} selected={activeType === tileType} />
            <span>{tileLabels[tileType]}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
