import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Header from "../components/Header.jsx";
import MediaPanel from "../components/MediaPanel.jsx";
import Canvas from "../components/Canvas.jsx";
import Properties from "../components/Properties.jsx";
import Timeline from "../components/Timeline.jsx";
import Layers from "../components/Layers.jsx";
import { ProjectProvider, useProject } from "../state/ProjectContext.jsx";
import { useLiveBroadcast } from "../hooks/useLiveBroadcast.js";
import "./Control.css";

const isTypingTarget = (el) =>
  el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable);

function ControlInner() {
  const {
    project,
    objects,
    selectedId,
    selectedObject,
    loading,
    dirty,
    select,
    addObject,
    updateObject,
    removeObject,
    saveProject,
    loadProject,
    newProject,
  } = useProject();

  const [showProperties, setShowProperties] = useState(true);
  const mediaRefs = useRef(new Map());
  const outputWindowRef = useRef(null);
  const liveBroadcast = useLiveBroadcast();

  const handleOpenOutput = async () => {
    // Nếu Output đã mở thì không mở thêm cửa sổ mới, chỉ focus cửa sổ Output hiện tại
    if (outputWindowRef.current && !outputWindowRef.current.closed) {
      outputWindowRef.current.focus();
      return;
    }

    // Kiểm tra browser có hỗ trợ getScreenDetails hay không
    if (!("getScreenDetails" in window)) {
      alert(
        "Trình duyệt chưa hỗ trợ tự động mở Output sang màn hình thứ 2. Hãy sử dụng Google Chrome hoặc Microsoft Edge phiên bản mới."
      );
      return;
    }

    try {
      // Gọi getScreenDetails()
      const screenDetails = await window.getScreenDetails();

      // Kiểm tra số lượng màn hình
      if (!screenDetails || !screenDetails.screens || screenDetails.screens.length < 2) {
        alert("Chưa phát hiện màn hình thứ 2. Hãy kiểm tra Windows đang ở chế độ Extend.");
        return;
      }

      // Xác định currentScreen
      const currentScreen = screenDetails.currentScreen;

      // Tìm màn hình khác currentScreen làm outputScreen
      const outputScreen =
        screenDetails.screens.find((s) => s !== currentScreen) || screenDetails.screens[1];

      // Đặt tọa độ và kích thước từ outputScreen
      const left = outputScreen.availLeft ?? outputScreen.left ?? 0;
      const top = outputScreen.availTop ?? outputScreen.top ?? 0;
      const width = outputScreen.availWidth ?? outputScreen.width ?? 1920;
      const height = outputScreen.availHeight ?? outputScreen.height ?? 1080;

      const windowFeatures = `left=${left},top=${top},width=${width},height=${height},menubar=no,toolbar=no,location=no,status=no,resizable=yes,scrollbars=no`;

      // Mở /output bằng window.open() với tên cố định 'led-output'
      const win = window.open("/output", "led-output", windowFeatures);
      if (win) {
        outputWindowRef.current = win;
        win.focus();
      } else {
        alert("Không thể mở cửa sổ Output. Vui lòng kiểm tra và cho phép Pop-up trên trình duyệt.");
      }
    } catch (err) {
      console.error("Lỗi khi mở cửa sổ Output bằng Window Management API:", err);
      if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
        alert(
          "Bạn đã từ chối quyền quản lý màn hình. Vui lòng cấp quyền trong cài đặt trình duyệt để tự động mở sang màn hình thứ 2."
        );
      } else {
        alert("Có lỗi khi phát hiện màn hình: " + (err.message || err));
      }
    }
  };

  // Bootstrap: reopen the last project if we have one, otherwise start fresh.
  useEffect(() => {
    let active = true;
    const init = async () => {
      const lastId = localStorage.getItem("led-controller:last-project");
      if (lastId) {
        try {
          await loadProject(lastId);
          return;
        } catch (e) {
          console.warn("Could not load last project, creating new one...", e);
          if (active) localStorage.removeItem("led-controller:last-project");
        }
      }
      if (active) {
        await newProject().catch((err) => console.error("Could not create new project:", err));
      }
    };
    init();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const registerMediaRef = useCallback((id, instance) => {
    if (instance) mediaRefs.current.set(id, instance);
    else mediaRefs.current.delete(id);
  }, []);

  // Active media = selected object if it's video/youtube, otherwise the
  // top-most (highest zIndex) visible video/youtube object on the canvas.
  const activeMediaObject = useMemo(() => {
    if (selectedObject && (selectedObject.type === "video" || selectedObject.type === "youtube")) {
      return selectedObject;
    }
    return (
      [...objects]
        .filter((o) => o.visible && (o.type === "video" || o.type === "youtube"))
        .sort((a, b) => b.zIndex - a.zIndex)[0] || null
    );
  }, [objects, selectedObject]);

  const getMediaRef = useCallback(
    () => (activeMediaObject ? mediaRefs.current.get(activeMediaObject.id) : null),
    [activeMediaObject]
  );

  // V7 hotkeys.
  useEffect(() => {
    const onKeyDown = (e) => {
      if (isTypingTarget(document.activeElement)) return;

      if ((e.key === "Delete" || e.key === "Backspace") && selectedId) {
        e.preventDefault();
        removeObject(selectedId);
      } else if (e.key === "Escape") {
        select(null);
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        saveProject();
      } else if (e.key === " ") {
        e.preventDefault();
        const ref = getMediaRef();
        if (!ref) return;
        ref.play();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selectedId, removeObject, select, saveProject, getMediaRef]);

  const handleGoLive = (state) => liveBroadcast.goLive(state);

  if (loading || !project) {
    return (
      <div
        className="control-page control-page--loading"
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          height: "100vh",
          gap: "12px",
          color: "var(--text-secondary, #999)",
          fontFamily: "sans-serif",
        }}
      >
        <span>{loading ? "Đang tải dự án…" : "Chưa có dự án nào"}</span>
        {!loading && !project && (
          <button
            onClick={() => newProject()}
            style={{
              padding: "8px 16px",
              background: "#3b82f6",
              color: "#fff",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
              fontWeight: 500,
            }}
          >
            Tạo dự án mới
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="control-page">
      <Header
        liveBroadcast={liveBroadcast}
        onGoLive={handleGoLive}
        showProperties={showProperties}
        onToggleProperties={() => setShowProperties((v) => !v)}
        onOpenOutput={handleOpenOutput}
      />

      <div className="control-body">
        <MediaPanel />
        <Canvas
          objects={objects}
          canvasWidth={project.width}
          canvasHeight={project.height}
          selectedId={selectedId}
          onSelect={select}
          onUpdate={updateObject}
          onAddObject={addObject}
          registerMediaRef={registerMediaRef}
        />
        {showProperties ? (
          <Properties onClose={() => setShowProperties(false)} />
        ) : (
          <button
            className="properties-reopen-strip"
            onClick={() => setShowProperties(true)}
            title="Mở ô Properties"
          >
            <span>⚙️ Properties</span>
          </button>
        )}
      </div>

      <div className="control-bottom">
        <Timeline
          activeObject={activeMediaObject}
          getMediaRef={getMediaRef}
          sendTransport={liveBroadcast.sendTransport}
        />
        <Layers />
      </div>

      <div className="control-statusbar">
        <span>
          {project.name}
          {dirty ? " — unsaved changes (Ctrl+S to save)" : " — saved"}
        </span>
        <span>
          Output: {project.width}×{project.height}
        </span>
      </div>
    </div>
  );
}

function Control() {
  return (
    <ProjectProvider>
      <ControlInner />
    </ProjectProvider>
  );
}

export default Control;
