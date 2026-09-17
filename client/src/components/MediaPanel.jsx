import { useRef, useState } from "react";
import { useProject } from "../state/ProjectContext.jsx";
import { api } from "../services/api.js";
import {
  createImageObject,
  createTextObject,
  createVideoObject,
  createYoutubeObject,
} from "../data/objectFactory.js";
import { extractYouTubeId } from "../services/youtube.js";
import "./MediaPanel.css";

const TEXT_PRESETS = [
  {
    id: "preset-heading",
    name: "Tiêu đề lớn",
    icon: "H1",
    create: () =>
      createTextObject({
        name: "Tiêu đề",
        width: 600,
        height: 120,
        content: {
          text: "TIÊU ĐỀ CHÍNH",
          fontSize: 64,
          fontFamily: "Inter",
          bold: true,
          color: "#ffffff",
          align: "center",
        },
      }),
  },
  {
    id: "preset-text",
    name: "Văn bản thường",
    icon: "T",
    create: () =>
      createTextObject({
        name: "Văn bản",
        width: 500,
        height: 100,
        content: {
          text: "Nội dung văn bản...",
          fontSize: 40,
          fontFamily: "Inter",
          bold: false,
          color: "#e6e8eb",
          align: "center",
        },
      }),
  },
  {
    id: "preset-subtitle",
    name: "Chú thích / Sub",
    icon: "sub",
    create: () =>
      createTextObject({
        name: "Chú thích",
        width: 450,
        height: 80,
        content: {
          text: "Dòng mô tả phụ",
          fontSize: 28,
          fontFamily: "Inter",
          italic: true,
          color: "#a0a5b1",
          align: "center",
        },
      }),
  },
];

function MediaPanel() {
  const { addObject } = useProject();
  const fileInputRef = useRef(null);
  const [library, setLibrary] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const [youtubeInput, setYoutubeInput] = useState("");
  const [youtubeError, setYoutubeError] = useState(null);

  const handleUpload = async (file, _kind) => {
    setUploading(true);
    setUploadError(null);
    try {
      const result = await api.upload(file);
      const item = { ...result, id: `${Date.now()}` };
      setLibrary((prev) => [item, ...prev]);
    } catch (err) {
      setUploadError(err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleAddYoutube = () => {
    const videoId = extractYouTubeId(youtubeInput);
    if (!videoId) {
      setYoutubeError("Không nhận ra URL hoặc ID video YouTube.");
      return;
    }
    setYoutubeError(null);
    const ytItem = {
      id: `${Date.now()}`,
      kind: "youtube",
      filename: `YouTube (${videoId})`,
      videoId,
      url: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
    };
    setLibrary((prev) => [ytItem, ...prev]);
    setYoutubeInput("");
  };

  const handleDragStart = (e, getObj) => {
    const obj = typeof getObj === "function" ? getObj() : getObj;
    e.dataTransfer.setData("application/json", JSON.stringify(obj));
    e.dataTransfer.effectAllowed = "copy";
  };

  const addFromLibrary = (item) => {
    if (item.kind === "youtube") {
      addObject(createYoutubeObject(item.videoId));
    } else if (item.kind === "video") {
      addObject(createVideoObject(item));
    } else {
      addObject(createImageObject(item));
    }
  };

  const getItemObject = (item) => {
    if (item.kind === "youtube") return createYoutubeObject(item.videoId);
    if (item.kind === "video") return createVideoObject(item);
    return createImageObject(item);
  };

  return (
    <aside className="media-panel">
      <div className="media-panel-drag-hint">
        <span>💡 Bấm hoặc kéo thả vào khung hình để thêm</span>
      </div>

      <div className="panel-section-label">Upload Media</div>
      <div className="media-add-grid">
        <button
          className="media-add-btn"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          style={{ gridColumn: "span 2" }}
        >
          <span className="media-add-icon">📁</span>
          <span>Upload Image / Video</span>
        </button>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,video/*"
        multiple
        hidden
        onChange={async (e) => {
          const files = Array.from(e.target.files || []);
          for (const file of files) {
            const kind = file.type.startsWith("video/") ? "video" : "image";
            await handleUpload(file, kind);
          }
          e.target.value = "";
        }}
      />
      {uploading && <p className="media-hint">Đang tải lên…</p>}
      {uploadError && <p className="media-error">{uploadError}</p>}

      <div className="panel-section-label media-section-label">Text Presets</div>
      <div className="media-preset-list">
        {TEXT_PRESETS.map((preset) => (
          <div
            key={preset.id}
            className="media-preset-item"
            draggable
            onDragStart={(e) => handleDragStart(e, preset.create)}
            onClick={() => addObject(preset.create())}
            title="Kéo vào khung hình hoặc bấm để thêm"
          >
            <span className="media-preset-icon">{preset.icon}</span>
            <span className="media-preset-name">{preset.name}</span>
            <span className="media-drag-handle">⋮⋮</span>
          </div>
        ))}
      </div>

      <div className="panel-section-label media-section-label">YouTube</div>
      <div className="media-youtube-box">
        <input
          className="media-youtube-input"
          placeholder="Dán URL hoặc video ID"
          value={youtubeInput}
          onChange={(e) => setYoutubeInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleAddYoutube()}
        />
        <button className="media-youtube-add" onClick={handleAddYoutube}>
          Add
        </button>
      </div>
      {youtubeError && <p className="media-error">{youtubeError}</p>}

      <div className="panel-section-label media-library-label">Thư viện Media</div>
      {library.length === 0 ? (
        <div className="media-library-empty">
          <p>Chưa có file media.</p>
          <p className="media-library-hint">
            Tải ảnh / video hoặc thêm YouTube để kéo thả vào khung hình.
          </p>
        </div>
      ) : (
        <div className="media-library-list">
          {library.map((item) => (
            <div
              key={item.id}
              className="media-library-card"
              draggable
              onDragStart={(e) => handleDragStart(e, () => getItemObject(item))}
              onClick={() => addFromLibrary(item)}
              title={`Kéo ${item.filename} vào màn hình hoặc bấm để thêm`}
            >
              <div className="media-library-thumb-box">
                {item.kind === "image" ? (
                  <img className="media-library-thumb" src={item.url} alt={item.filename} />
                ) : item.kind === "youtube" ? (
                  <img className="media-library-thumb" src={item.url} alt={item.filename} />
                ) : (
                  <div className="media-library-thumb-icon">🎬</div>
                )}
              </div>
              <div className="media-library-card-info">
                <span className="media-library-card-name">{item.filename}</span>
                <span className="media-library-card-type">
                  {item.kind === "image" ? "Ảnh" : item.kind === "video" ? "Video" : "YouTube"}
                </span>
              </div>
              <span className="media-drag-handle">⋮⋮</span>
            </div>
          ))}
        </div>
      )}
    </aside>
  );
}

export default MediaPanel;
