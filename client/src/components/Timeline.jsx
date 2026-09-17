import { useEffect, useRef, useState } from "react";
import "./Timeline.css";

function formatTime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) seconds = 0;
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

// V3/V4: transport bar controls whichever video/YouTube object is "active"
// (the selected media object, or the top-most media object on the canvas).
// V5: every transport action is also broadcast to /output so playback stays
// in sync on the projector.
function Timeline({ activeObject, getMediaRef, sendTransport }) {
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const trackRef = useRef(null);

  useEffect(() => {
    setPlaying(false);
    setCurrentTime(0);
    setDuration(0);
  }, [activeObject?.id]);

  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => {
      const ref = getMediaRef?.();
      if (!ref) return;
      setCurrentTime(ref.getCurrentTime() || 0);
      setDuration(ref.getDuration() || 0);
    }, 250);
    return () => clearInterval(id);
  }, [playing, getMediaRef]);

  const disabled = !activeObject;

  const play = () => {
    const ref = getMediaRef?.();
    ref?.play();
    setPlaying(true);
    sendTransport?.({ objectId: activeObject.id, action: "play", time: ref?.getCurrentTime?.() ?? 0 });
  };

  const pause = () => {
    const ref = getMediaRef?.();
    ref?.pause();
    setPlaying(false);
    sendTransport?.({ objectId: activeObject.id, action: "pause", time: ref?.getCurrentTime?.() ?? 0 });
  };

  const stop = () => {
    const ref = getMediaRef?.();
    ref?.stop();
    setPlaying(false);
    setCurrentTime(0);
    sendTransport?.({ objectId: activeObject.id, action: "stop", time: 0 });
  };

  const handleSeekEvent = (clientX) => {
    if (disabled || !duration || !trackRef.current) return;
    const rect = trackRef.current.getBoundingClientRect();
    const fraction = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    const time = fraction * duration;
    getMediaRef?.()?.seek(time);
    setCurrentTime(time);
    sendTransport?.({ objectId: activeObject.id, action: "seek", time });
  };

  const handlePointerDown = (e) => {
    if (disabled || !duration || !trackRef.current) return;
    e.preventDefault();
    handleSeekEvent(e.clientX);

    const onPointerMove = (moveEvent) => {
      handleSeekEvent(moveEvent.clientX);
    };

    const onPointerUp = () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
  };

  const progress = duration ? (currentTime / duration) * 100 : 0;

  return (
    <div className="timeline">
      <div className="timeline-transport">
        <button className="timeline-btn" onClick={play} disabled={disabled} title="Play">
          ▶
        </button>
        <button className="timeline-btn" onClick={pause} disabled={disabled} title="Pause">
          ⏸
        </button>
        <button className="timeline-btn" onClick={stop} disabled={disabled} title="Stop">
          ■
        </button>
      </div>

      <div className="timeline-scrub">
        <span className="timeline-time">{formatTime(currentTime)}</span>
        <div className="timeline-track" ref={trackRef} onPointerDown={handlePointerDown}>
          <div className="timeline-track-fill" style={{ width: `${progress}%` }} />
          <div className="timeline-track-handle" style={{ left: `${progress}%` }} />
        </div>
        <span className="timeline-time">{formatTime(duration)}</span>
      </div>

      <div className="timeline-active-label">
        {activeObject ? activeObject.name : "No video/YouTube object"}
      </div>
    </div>
  );
}

export default Timeline;
