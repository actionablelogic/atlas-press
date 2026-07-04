import { TILE_SOURCES, TILE_SOURCES_BY_ID } from "../render/tileSources";
import type { TileConfig } from "./MapCanvas";

interface Props {
  config: TileConfig;
  onChange: (next: TileConfig) => void;
}

export function SatelliteSettings({ config, onChange }: Props) {
  const source = TILE_SOURCES_BY_ID[config.sourceId] ?? TILE_SOURCES[0];
  const isCustom = source.id === "custom";

  return (
    <div className="picker sat-settings">
      <h2 className="picker-title">Satellite source</h2>
      <p className="sat-note">Region-scale imagery (world scale uses Blue Marble).</p>

      <select
        className="sat-select"
        value={config.sourceId}
        onChange={(e) => onChange({ ...config, sourceId: e.target.value })}
      >
        {TILE_SOURCES.map((s) => (
          <option key={s.id} value={s.id}>
            {s.label}
          </option>
        ))}
      </select>

      {isCustom && (
        <input
          className="sat-input"
          type="text"
          placeholder="https://…/{z}/{x}/{y}.jpg  (use {key} if needed)"
          value={config.customTemplate ?? ""}
          onChange={(e) => onChange({ ...config, customTemplate: e.target.value })}
        />
      )}
      {(isCustom || source.requiresKey) && (
        <input
          className="sat-input"
          type="password"
          placeholder="API key (stored locally only)"
          value={config.apiKey ?? ""}
          onChange={(e) => onChange({ ...config, apiKey: e.target.value })}
        />
      )}

      <p className="sat-license">
        <strong>{source.attribution}</strong>
        <br />
        {source.license}
      </p>
    </div>
  );
}
