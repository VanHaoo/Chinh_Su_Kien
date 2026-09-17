import { useEffect, useRef, useState } from "react";
import { useProject } from "../state/ProjectContext.jsx";
import { api } from "../services/api.js";
import "./Header.css";

// V6 project menu (New/Open/Save/Save As/Rename/Delete) + V5 GO LIVE wiring.
// Dialogs use window.prompt/confirm rather than a custom modal — enough for
// a control-room tool, and it keeps this version's scope in check.
function Header({ liveBroadcast, onGoLive, showProperties, onToggleProperties, onOpenOutput }) {
  const { project, objects, saving, dirty, newProject, saveProject, saveProjectAs, renameProject, deleteProject, loadProject } =
    useProject();
  const [menuOpen, setMenuOpen] = useState(false);
  const [projectList, setProjectList] = useState([]);
  const [listLoading, setListLoading] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    const onClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const openMenu = async () => {
    setMenuOpen((v) => !v);
    setListLoading(true);
    try {
      setProjectList(await api.listProjects());
    } finally {
      setListLoading(false);
    }
  };

  const handleNew = async () => {
    const name = window.prompt("Project name", "Untitled Project");
    if (!name) return;
    await newProject(name);
    setMenuOpen(false);
  };

  const handleOpen = async (id) => {
    await loadProject(id);
    setMenuOpen(false);
  };

  const handleSave = async () => {
    await saveProject();
    setMenuOpen(false);
  };

  const handleSaveAs = async () => {
    const name = window.prompt("Save as", `${project?.name || "Project"} copy`);
    if (!name) return;
    await saveProjectAs(name);
    setMenuOpen(false);
  };

  const handleRename = async () => {
    const name = window.prompt("Rename project", project?.name || "");
    if (!name) return;
    await renameProject(name);
    setMenuOpen(false);
  };

  const handleDelete = async () => {
    if (!project) return;
    if (!window.confirm(`Delete "${project.name}"? This cannot be undone.`)) return;
    await deleteProject(project.id);
    await newProject("Untitled Project");
    setMenuOpen(false);
  };

  const handleGoLive = () => {
    if (!project) return;
    onGoLive?.({
      projectId: project.id,
      width: project.width,
      height: project.height,
      objects,
    });
  };

  const statusLabel = !liveBroadcast.socketConnected
    ? "Server not connected"
    : liveBroadcast.outputConnected
    ? "Output connected"
    : "Output not connected";

  return (
    <header className="header">
      <div className="header-left">
        <div className="header-logo">
          <span className="header-logo-mark">◆</span>
          <span className="header-logo-text">LED CONTROLLER</span>
        </div>
        <nav className="header-menu" ref={menuRef}>
          <button className="header-menu-item" onClick={openMenu}>
            Project{dirty ? " •" : ""}
          </button>
          {menuOpen && (
            <div className="header-dropdown">
              <button className="header-dropdown-item" onClick={handleNew}>
                New Project
              </button>
              <div className="header-dropdown-sep" />
              <div className="header-dropdown-label">Open Project</div>
              <div className="header-dropdown-list">
                {listLoading && <div className="header-dropdown-hint">Loading…</div>}
                {!listLoading && projectList.length === 0 && (
                  <div className="header-dropdown-hint">No saved projects yet</div>
                )}
                {projectList.map((p) => (
                  <button
                    key={p.id}
                    className="header-dropdown-item"
                    onClick={() => handleOpen(p.id)}
                  >
                    {p.name}
                    {project?.id === p.id ? " (current)" : ""}
                  </button>
                ))}
              </div>
              <div className="header-dropdown-sep" />
              <button className="header-dropdown-item" onClick={handleSave} disabled={saving}>
                {saving ? "Saving…" : "Save Project"}
              </button>
              <button className="header-dropdown-item" onClick={handleSaveAs}>
                Save As…
              </button>
              <button className="header-dropdown-item" onClick={handleRename}>
                Rename Project
              </button>
              <div className="header-dropdown-sep" />
              <button className="header-dropdown-item header-dropdown-item--danger" onClick={handleDelete}>
                Delete Project
              </button>
            </div>
          )}
        </nav>
      </div>

      <div className="header-center">{project?.name || "Loading…"}</div>

      <div className="header-right">
        {onOpenOutput && (
          <button
            className="header-open-output-btn"
            onClick={onOpenOutput}
            title="Mở màn hình Output trên màn hình thứ 2"
          >
            Mở màn chiếu ↗
          </button>
        )}
        {onToggleProperties && (
          <button
            className={"header-prop-toggle-btn" + (showProperties ? " header-prop-toggle-btn--active" : "")}
            onClick={onToggleProperties}
            title={showProperties ? "Tắt ô Properties" : "Mở ô Properties"}
          >
            ⚙️ Properties
          </button>
        )}
        <div className="header-status">
          <span
            className={
              "header-status-dot" +
              (liveBroadcast.outputConnected ? " header-status-dot--live" : "")
            }
          />
          <span className="header-status-label">{statusLabel}</span>
        </div>
        <button className="header-live-btn" onClick={handleGoLive} disabled={!project}>
          GO LIVE
        </button>
      </div>
    </header>
  );
}

export default Header;
