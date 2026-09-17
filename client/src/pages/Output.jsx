import { useEffect, useRef, useState } from "react";
import StageObjectContent from "../components/StageObjectContent.jsx";
import { useLiveReceiver } from "../hooks/useLiveReceiver.js";
import "./Output.css";

// This route renders ONLY the live content -- no header, panels, timeline or
// controls of any kind, per spec section 2. V5 wires it to Control via
// Socket.IO; V7 adds fullscreen, a barely-there reconnect indicator, and a
// short crossfade so a new GO LIVE doesn't hard-cut the picture.
function Output() {
  const { connected, liveState, transport } = useLiveReceiver();
  const frameRef = useRef(null);
  const [scale, setScale] = useState(1);
  const mediaRefs = useRef(new Map());

  const width = liveState?.width || 1920;
  const height = liveState?.height || 1080;
  const objects = liveState?.objects || [];

  useEffect(() => {
    const el = frameRef.current;
    if (!el) return;
    const update = () => {
      const next = Math.min(el.clientWidth / width, el.clientHeight / height);
      setScale(next > 0 ? next : 1);
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, [width, height]);

  useEffect(() => {
    if (!transport) return;
    const ref = mediaRefs.current.get(transport.objectId);
    if (!ref) return;
    if (transport.action === "play") {
      if (typeof transport.time === "number" && Math.abs(ref.getCurrentTime() - transport.time) > 0.5) {
        ref.seek(transport.time);
      }
      ref.play();
    }
    if (transport.action === "pause") ref.pause();
    if (transport.action === "stop") ref.stop();
    if (transport.action === "seek") ref.seek(transport.time);
  }, [transport]);

  useEffect(() => {
    const unlockAudio = () => {
      document.querySelectorAll("video").forEach((v) => {
        if (v.muted) v.muted = false;
      });
    };
    const toggleFullscreen = () => {
      if (!document.fullscreenElement) document.documentElement.requestFullscreen?.();
      else document.exitFullscreen?.();
    };
    const onKeyDown = (e) => {
      unlockAudio();
      if (e.key === "f" || e.key === "F") toggleFullscreen();
    };
    window.addEventListener("click", unlockAudio);
    window.addEventListener("dblclick", toggleFullscreen);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("click", unlockAudio);
      window.removeEventListener("dblclick", toggleFullscreen);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  const visibleObjects = objects.filter((obj) => obj.visible);

  return (
    <div className="output-stage" ref={frameRef}>
      {!liveState && <span className="output-waiting">No content live yet</span>}

      {liveState && (
        <div
          className="output-canvas"
          style={{ width: width * scale, height: height * scale }}
        >
          {visibleObjects.map((obj) => (
            <div
              key={obj.id}
              className="output-object"
              style={{
                left: obj.x * scale,
                top: obj.y * scale,
                width: obj.width * scale,
                height: obj.height * scale,
                opacity: obj.opacity / 100,
                transform: `rotate(${obj.rotation}deg)`,
              }}
            >
              <StageObjectContent
                object={obj}
                ref={(instance) => {
                  if (instance) mediaRefs.current.set(obj.id, instance);
                  else mediaRefs.current.delete(obj.id);
                }}
              />
            </div>
          ))}
        </div>
      )}

      <span className={"output-conn-dot" + (connected ? "" : " output-conn-dot--off")} />
    </div>
  );
}

export default Output;
