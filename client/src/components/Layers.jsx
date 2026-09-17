import { useProject } from "../state/ProjectContext.jsx";
import "./Layers.css";

// V2: rows are selectable, reorderable (▲▼ swap zIndex with the neighbor),
// have a visibility toggle, and a delete button.
function Layers() {
  const { objects, selectedId, select, moveLayer, updateObject, removeObject } = useProject();
  const sorted = [...objects].sort((a, b) => b.zIndex - a.zIndex);

  return (
    <div className="layers-panel">
      <div className="panel-section-label layers-label">Layers</div>
      <div className="layers-list">
        {sorted.length === 0 && <p className="layers-empty">No objects yet.</p>}
        {sorted.map((obj, index) => (
          <div
            key={obj.id}
            className={"layers-row" + (obj.id === selectedId ? " layers-row--selected" : "")}
            onClick={() => select(obj.id)}
          >
            <button
              className={"layers-visibility" + (obj.visible ? "" : " layers-visibility--off")}
              onClick={(e) => {
                e.stopPropagation();
                updateObject(obj.id, { visible: !obj.visible });
              }}
              title={obj.visible ? "Hide" : "Show"}
            >
              {obj.visible ? "●" : "○"}
            </button>
            <span className="layers-name">{obj.name}</span>
            <span className="layers-type">{obj.type}</span>
            <div className="layers-actions">
              <button
                className="layers-action-btn"
                disabled={index === 0}
                onClick={(e) => {
                  e.stopPropagation();
                  moveLayer(obj.id, "up");
                }}
                title="Bring forward"
              >
                ▲
              </button>
              <button
                className="layers-action-btn"
                disabled={index === sorted.length - 1}
                onClick={(e) => {
                  e.stopPropagation();
                  moveLayer(obj.id, "down");
                }}
                title="Send backward"
              >
                ▼
              </button>
              <button
                className="layers-action-btn layers-action-btn--danger"
                onClick={(e) => {
                  e.stopPropagation();
                  removeObject(obj.id);
                }}
                title="Delete"
              >
                ✕
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default Layers;
