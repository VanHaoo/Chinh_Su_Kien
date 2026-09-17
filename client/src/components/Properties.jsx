import { useProject } from "../state/ProjectContext.jsx";
import "./Properties.css";

const FONT_FAMILIES = ["Inter", "JetBrains Mono", "Georgia", "Arial", "Courier New"];

function NumberField({ label, value, unit, onChange, step = 1 }) {
  return (
    <label className="prop-field">
      <span className="prop-field-label">{label}</span>
      <span className="prop-field-input">
        <input
          type="number"
          value={Math.round(value * 100) / 100}
          step={step}
          onChange={(e) => onChange(Number(e.target.value))}
        />
        {unit ? <span className="prop-field-unit">{unit}</span> : null}
      </span>
    </label>
  );
}

// V2: every field here is live-editable and writes straight back into
// ProjectContext, so Canvas and Layers reflect changes immediately.
function Properties({ onClose }) {
  const { project, objects, selectedObject, updateObject, removeObject } = useProject();

  const patch = (fields) => {
    if (selectedObject) updateObject(selectedObject.id, fields);
  };
  const patchContent = (fields) => {
    if (selectedObject) updateObject(selectedObject.id, { content: { ...selectedObject.content, ...fields } });
  };

  return (
    <aside className="properties-panel">
      <div className="properties-header-bar">
        <div className="panel-section-label" style={{ marginBottom: 0 }}>Properties</div>
        {onClose && (
          <button className="properties-close-btn" onClick={onClose} title="Tắt ô Properties">
            ✕
          </button>
        )}
      </div>

      {!selectedObject && (
        <div className="properties-empty">
          <p>No object selected.</p>
          <p className="properties-empty-hint">
            Click an object on the canvas or select a layer to inspect it.
          </p>
        </div>
      )}

      {selectedObject && (
        <>
          <div className="properties-object-header">
            <input
              className="properties-object-name-input"
              value={selectedObject.name}
              onChange={(e) => patch({ name: e.target.value })}
            />
            <button
              className="properties-delete-btn"
              title="Delete object (Del)"
              onClick={() => removeObject(selectedObject.id)}
            >
              Delete
            </button>
          </div>
          <div className="properties-object-type">{selectedObject.type}</div>

          <div className="prop-group">
            <div className="prop-group-title">Position</div>
            <div className="prop-row">
              <NumberField label="X" value={selectedObject.x} unit="px" onChange={(v) => patch({ x: v })} />
              <NumberField label="Y" value={selectedObject.y} unit="px" onChange={(v) => patch({ y: v })} />
            </div>
          </div>

          <div className="prop-group">
            <div className="prop-group-title">Size</div>
            <div className="prop-row">
              <NumberField
                label="Width"
                value={selectedObject.width}
                unit="px"
                onChange={(v) => patch({ width: Math.max(1, v) })}
              />
              <NumberField
                label="Height"
                value={selectedObject.height}
                unit="px"
                onChange={(v) => patch({ height: Math.max(1, v) })}
              />
            </div>
            <button
              className="prop-fit-btn"
              onClick={() =>
                patch({
                  x: 0,
                  y: 0,
                  width: project?.width || 1920,
                  height: project?.height || 1080,
                  rotation: 0,
                })
              }
              style={{
                width: "100%",
                marginTop: "8px",
                padding: "6px",
                background: "var(--bg-panel-alt)",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius-sm)",
                color: "var(--accent)",
                fontSize: "11px",
                fontWeight: "600",
                cursor: "pointer",
              }}
            >
              Fit Full Screen (100% Canvas)
            </button>
          </div>

          <div className="prop-group">
            <div className="prop-group-title">Transform</div>
            <div className="prop-row">
              <NumberField
                label="Rotation"
                value={selectedObject.rotation}
                unit="°"
                onChange={(v) => patch({ rotation: v })}
              />
              <NumberField
                label="Opacity"
                value={selectedObject.opacity}
                unit="%"
                onChange={(v) => patch({ opacity: Math.min(100, Math.max(0, v)) })}
              />
            </div>
          </div>

          <div className="prop-group">
            <div className="prop-group-title">Layer</div>
            <div className="prop-row">
              <div className="prop-field">
                <span className="prop-field-label">Z-Index</span>
                <span className="prop-field-input prop-field-input--readonly">{selectedObject.zIndex}</span>
              </div>
              <label className="prop-checkbox">
                <input
                  type="checkbox"
                  checked={selectedObject.visible}
                  onChange={(e) => patch({ visible: e.target.checked })}
                />
                Visible
              </label>
            </div>
          </div>

          {selectedObject.type === "text" && (
            <div className="prop-group">
              <div className="prop-group-title">Text</div>
              <textarea
                className="prop-textarea"
                value={selectedObject.content.text}
                onChange={(e) => patchContent({ text: e.target.value })}
                rows={3}
              />
              <div className="prop-row" style={{ marginTop: 8 }}>
                <label className="prop-field">
                  <span className="prop-field-label">Font size</span>
                  <span className="prop-field-input">
                    <input
                      type="number"
                      value={selectedObject.content.fontSize}
                      onChange={(e) => patchContent({ fontSize: Number(e.target.value) })}
                    />
                  </span>
                </label>
                <label className="prop-field">
                  <span className="prop-field-label">Font</span>
                  <select
                    className="prop-select"
                    value={selectedObject.content.fontFamily}
                    onChange={(e) => patchContent({ fontFamily: e.target.value })}
                  >
                    {FONT_FAMILIES.map((f) => (
                      <option key={f} value={f}>
                        {f}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="prop-toggle-row">
                <button
                  className={"prop-toggle" + (selectedObject.content.bold ? " prop-toggle--active" : "")}
                  onClick={() => patchContent({ bold: !selectedObject.content.bold })}
                >
                  B
                </button>
                <button
                  className={"prop-toggle" + (selectedObject.content.italic ? " prop-toggle--active" : "")}
                  onClick={() => patchContent({ italic: !selectedObject.content.italic })}
                >
                  I
                </button>
                <select
                  className="prop-select"
                  value={selectedObject.content.align}
                  onChange={(e) => patchContent({ align: e.target.value })}
                >
                  <option value="left">Left</option>
                  <option value="center">Center</option>
                  <option value="right">Right</option>
                </select>
                <input
                  type="color"
                  className="prop-color"
                  value={selectedObject.content.color}
                  onChange={(e) => patchContent({ color: e.target.value })}
                />
              </div>
            </div>
          )}

          {selectedObject.type === "video" && (
            <div className="prop-group">
              <div className="prop-group-title">Video</div>
              <label className="prop-checkbox">
                <input
                  type="checkbox"
                  checked={selectedObject.content.loop}
                  onChange={(e) => patchContent({ loop: e.target.checked })}
                />
                Loop
              </label>
              <label className="prop-field" style={{ marginTop: 8 }}>
                <span className="prop-field-label">Volume</span>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={selectedObject.content.volume}
                  onChange={(e) => patchContent({ volume: Number(e.target.value) })}
                />
              </label>
            </div>
          )}

          {selectedObject.type === "youtube" && (
            <div className="prop-group">
              <div className="prop-group-title">YouTube</div>
              <div className="prop-field-input prop-field-input--readonly">
                {selectedObject.content.videoId}
              </div>
            </div>
          )}
        </>
      )}

      {!selectedObject && objects.length === 0 && (
        <p className="properties-empty-hint" style={{ marginTop: 10 }}>
          Nothing on the canvas yet — add an object from the Media panel.
        </p>
      )}
    </aside>
  );
}

export default Properties;
