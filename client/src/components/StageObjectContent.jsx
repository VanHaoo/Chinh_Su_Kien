import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { loadYouTubeApi } from "../services/youtube.js";

// Used by both Canvas (editable, in /control) and Output (read-only, in
// /output) so image/video/YouTube/text always render identically in both
// places. Exposes a small imperative API so Timeline (V3) and the Output
// transport listener (V5) can drive playback without prop-drilling state
// that would otherwise re-render on every video frame.
const StageObjectContent = forwardRef(function StageObjectContent({ object, muted }, ref) {
  const videoRef = useRef(null);
  const ytContainerRef = useRef(null);
  const ytPlayerRef = useRef(null);
  const [ytError, setYtError] = useState(null);
  const [, forceUpdate] = useState(0);

  useEffect(() => {
    if (object.type !== "youtube" || !object.content.videoId) return;
    let cancelled = false;
    setYtError(null);

    loadYouTubeApi().then((YT) => {
      if (cancelled || !ytContainerRef.current) return;
      try {
        ytPlayerRef.current = new YT.Player(ytContainerRef.current, {
          videoId: object.content.videoId,
          host: "https://www.youtube-nocookie.com",
          playerVars: {
            controls: 0,
            disablekb: 1,
            modestbranding: 1,
            rel: 0,
            playsinline: 1,
            enablejsapi: 1,
            origin: window.location.origin || "http://localhost:5173",
            widget_referrer: window.location.origin || "http://localhost:5173",
            mute: muted ? 1 : 0,
          },
          events: {
            onReady: () => forceUpdate((n) => n + 1),
            onError: (e) => {
              console.warn("YouTube Player Error code:", e.data);
              if (e.data === 101 || e.data === 150) {
                setYtError("Video bị tác giả chặn quyền phát nhúng ngoài YouTube (Error 150/101). Hãy tải file video trực tiếp lên app hoặc chọn video khác.");
              } else if (e.data === 100) {
                setYtError("Video không tồn tại hoặc bị đặt ở chế độ riêng tư (Error 100).");
              } else if (e.data === 2) {
                setYtError("ID Video YouTube không hợp lệ.");
              } else {
                setYtError("Không thể phát video YouTube này (Mã lỗi: " + e.data + ").");
              }
            },
          },
        });
      } catch (err) {
        console.error("Failed to initialize YouTube Player:", err);
      }
    });

    return () => {
      cancelled = true;
      ytPlayerRef.current?.destroy?.();
      ytPlayerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [object.type, object.content.videoId]);

  useImperativeHandle(
    ref,
    () => ({
      isMedia: object.type === "video" || object.type === "youtube",
      play: async () => {
        if (object.type === "video" && videoRef.current) {
          try {
            await videoRef.current.play();
          } catch (err) {
            console.warn("Video play error:", err);
            if (err.name === "NotAllowedError" && !videoRef.current.muted) {
              videoRef.current.muted = true;
              await videoRef.current.play().catch((e) => console.error("Muted play failed:", e));
            }
          }
        }
        if (object.type === "youtube" && ytPlayerRef.current) {
          try {
            ytPlayerRef.current.playVideo?.();
          } catch (err) {
            console.warn("YouTube play error:", err);
          }
        }
      },
      pause: () => {
        if (object.type === "video") videoRef.current?.pause?.();
        if (object.type === "youtube") ytPlayerRef.current?.pauseVideo?.();
      },
      stop: () => {
        if (object.type === "video" && videoRef.current) {
          videoRef.current.pause();
          videoRef.current.currentTime = 0;
        }
        if (object.type === "youtube" && ytPlayerRef.current?.seekTo) {
          ytPlayerRef.current.pauseVideo?.();
          ytPlayerRef.current.seekTo(0, true);
        }
      },
      seek: (time) => {
        if (object.type === "video" && videoRef.current) {
          try {
            videoRef.current.currentTime = time;
          } catch (e) {
            console.warn("Seek error:", e);
          }
        }
        if (object.type === "youtube") ytPlayerRef.current?.seekTo?.(time, true);
      },
      getCurrentTime: () => {
        if (object.type === "video") return videoRef.current?.currentTime ?? 0;
        if (object.type === "youtube") return ytPlayerRef.current?.getCurrentTime?.() ?? 0;
        return 0;
      },
      getDuration: () => {
        if (object.type === "video") return videoRef.current?.duration || 0;
        if (object.type === "youtube") return ytPlayerRef.current?.getDuration?.() || 0;
        return 0;
      },
    }),
    [object.type]
  );

  if (object.type === "text") {
    const c = object.content;
    return (
      <div
        className="stage-text"
        style={{
          fontSize: c.fontSize,
          fontFamily: c.fontFamily,
          fontWeight: c.bold ? 700 : 400,
          fontStyle: c.italic ? "italic" : "normal",
          color: c.color,
          textAlign: c.align,
          justifyContent:
            c.align === "left" ? "flex-start" : c.align === "right" ? "flex-end" : "center",
        }}
      >
        {c.text}
      </div>
    );
  }

  if (object.type === "image") {
    return object.content.src ? (
      <img className="stage-image" src={object.content.src} alt={object.name} draggable={false} />
    ) : (
      <div className="stage-placeholder">No image</div>
    );
  }

  if (object.type === "video") {
    return object.content.src ? (
      <video
        ref={videoRef}
        className="stage-video"
        src={object.content.src}
        muted={muted}
        loop={object.content.loop}
        playsInline
        preload="auto"
      />
    ) : (
      <div className="stage-placeholder">No video</div>
    );
  }

  if (object.type === "youtube") {
    if (ytError) {
      return (
        <div
          className="stage-placeholder"
          style={{
            color: "#ef4444",
            padding: "16px",
            textAlign: "center",
            fontSize: "12px",
            background: "rgba(239, 68, 68, 0.12)",
            border: "1px dashed #ef4444",
            borderRadius: "6px",
            lineHeight: 1.5,
          }}
        >
          ⚠️ {ytError}
        </div>
      );
    }
    return object.content.videoId ? (
      <div className="stage-youtube" ref={ytContainerRef} />
    ) : (
      <div className="stage-placeholder">No YouTube video</div>
    );
  }

  return null;
});

export default StageObjectContent;
