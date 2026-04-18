type PlayerControlsProps = {
  tokenColor: string;
  onBackToMaps: () => void;
  onTokenColorChange: (color: string) => void;
};

export function PlayerControls({ tokenColor, onBackToMaps, onTokenColorChange }: PlayerControlsProps) {
  return (
    <section className="player-controls" aria-label="Player controls">
      <label className="player-token-color">
        <span>Token</span>
        <input
          type="color"
          value={tokenColor}
          onChange={(event) => onTokenColorChange(event.currentTarget.value)}
        />
      </label>
      <span className="player-token-hint">Move on Level 3</span>
      <button type="button" className="compact-button" onClick={onBackToMaps}>
        Back to Maps
      </button>
    </section>
  );
}
