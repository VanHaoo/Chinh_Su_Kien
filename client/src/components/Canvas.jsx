import { useCallback, useEffect, useRef, useState } from "react";
import StageObjectContent from "./StageObjectContent.jsx";
import "./Canvas.css";

const HANDLES = ["nw", "ne", "sw", "se"];
const MIN_SIZE = 20;

// NOTE on resize + rotation: resize math below works in plain canvas space
// (it does not un-rotate the pointer delta first). That keeps the common
// case -- resizing an unrotated object -- perfectly intuitive, and rotated
// objects still resize predictably, just not perfectly axis-locked to the
// object's own rotated edges. Full rotation-aware resize is a fair amount
// of extra trig for a rare interaction, so it's left as a known limitation.
function Canvas({
  objects,
  canvasWidth,
  canvasHeight,
  selectedId,
  onSelect,
  onUpdate,
  onAddObject,
  registerMediaRef,
}) {
  const frameRef = useRef(null);
  const stageRef = useRef(null);
  const [scale, setScale] = useState(1);
  const [isDragOver, setIsDragOver] = useState(false);
  const dragRef = useRef(null);

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
    if (!isDragOver) setIsDragOver(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);
    try {
      const raw = e.dataTransfer.getData("application/json");
      if (!raw) return;
      const data = JSON.parse(raw);
      if (!stageRef.current) return;
      const rect = stageRef.current.getBoundingClientRect();
      const rawX = (e.clientX - rect.left) / scale;
      const rawY = (e.clientY - rect.top) / scale;

      const objW = data.width || 400;
      const objH = data.height || 260;
      const x = Math.round(Math.max(0, Math.min(canvasWidth - objW, rawX - objW / 2)));
      const y = Math.round(Math.max(0, Math.min(canvasHeight - objH, rawY - objH / 2)));

      onAddObject?.({ ...data, x, y });
    } catch (err) {
      console.error("Drop error:", err);
    }
  };

  useEffect(() => {
    const el = frameRef.current;
    if (!el) return;
    const updateScale = () => {
      const padding = 32;
      const availW = el.clientWidth - padding;
      const availH = el.clientHeight - padding;
      const next = Math.min(availW / canvasWidth, availH / canvasHeight);
      setScale(next > 0 ? next : 1);
    };
    updateScale();
    const observer = new ResizeObserver(updateScale);
    observer.observe(el);
    return () => observer.disconnect();
  }, [canvasWidth, canvasHeight]);

  const endDrag = useCallback(() => {
    dragRef.current = null;
  }, []);

  const handlePointerMove = useCallback(
    (e) => {
      const drag = dragRef.current;
      if (!drag) return;
      const dx = (e.clientX - drag.startX) / scale;
      const dy = (e.clientY - drag.startY) / scale;

      if (drag.mode === "move") {
        onUpdate(drag.id, { x: drag.start.x + dx, y: drag.start.y + dy });
        return;
      }

      if (drag.mode === "resize") {
        const { handle, start } = drag;
        let width = start.width;
        let height = start.height;
        let x = start.x;
        let y = start.y;

        if (handle.includes("e")) width = Math.max(MIN_SIZE, start.width + dx);
        if (handle.includes("w")) {
          width = Math.max(MIN_SIZE, start.width - dx);
          x = start.x + (start.width - width);
        }
        if (handle.includes("s")) height = Math.max(MIN_SIZE, start.height + dy);
        if (handle.includes("n")) {
          height = Math.max(MIN_SIZE, start.height - dy);
          y = start.y + (start.height - height);
        }
        onUpdate(drag.id, { width, height, x, y });
        return;
      }

      if (drag.mode === "rotate") {
        const rect = stageRef.current.getBoundingClientRect();
        const cx = rect.left + drag.center.x * scale;
        const cy = rect.top + drag.center.y * scale;
        const angle = (Math.atan2(e.clientY - cy, e.clientX - cx) * 180) / Math.PI;
        let rotation = Math.round(angle + 90);
        rotation = ((rotation % 360) + 360) % 360;
        onUpdate(drag.id, { rotation });
      }
    },
    [scale, onUpdate]
  );

  useEffect(() => {
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", endDrag);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", endDrag);
    };
  }, [handlePointerMove, endDrag]);

  const startMove = (e, obj) => {
    e.stopPropagation();
    onSelect(obj.id);
    dragRef.current = {
      mode: "move",
      id: obj.id,
      startX: e.clientX,
      startY: e.clientY,
      start: { x: obj.x, y: obj.y },
    };
  };

  const startResize = (e, obj, handle) => {
    e.stopPropagation();
    dragRef.current = {
      mode: "resize",
      id: obj.id,
      handle,
      startX: e.clientX,
      startY: e.clientY,
      start: { x: obj.x, y: obj.y, width: obj.width, height: obj.height },
    };
  };

  const startRotate = (e, obj) => {
    e.stopPropagation();
    dragRef.current = {
      mode: "rotate",
      id: obj.id,
      center: { x: obj.x + obj.width / 2, y: obj.y + obj.height / 2 },
    };
  };

  const handleDoubleClick = (e, obj) => {
    e.stopPropagation();
    onUpdate(obj.id, {
      x: 0,
      y: 0,
      width: canvasWidth,
      height: canvasHeight,
      rotation: 0,
    });
  };

  const visibleObjects = objects.filter((obj) => obj.visible);

  return (
    <div className="canvas-wrap" ref={frameRef} onPointerDown={() => onSelect(null)}>
      <div className="canvas-toolbar">
        <span>PREVIEW</span>
        <span className="canvas-toolbar-res">
          {canvasWidth} × {canvasHeight}
        </span>
      </div>

      <div
        className={"canvas-stage" + (isDragOver ? " canvas-stage--dragover" : "")}
        ref={stageRef}
        style={{ width: canvasWidth * scale, height: canvasHeight * scale }}
        onPointerDown={(e) => e.stopPropagation()}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {visibleObjects.map((obj) => {
          const isSelected = obj.id === selectedId;
          return (
            <div
              key={obj.id}
              className={"canvas-object" + (isSelected ? " canvas-object--selected" : "")}
              style={{
                left: obj.x * scale,
                top: obj.y * scale,
                width: obj.width * scale,
                height: obj.height * scale,
                opacity: obj.opacity / 100,
                transform: `rotate(${obj.rotation}deg)`,
              }}
              onPointerDown={(e) => startMove(e, obj)}
              onDoubleClick={(e) => handleDoubleClick(e, obj)}
            >
              <StageObjectContent
                object={obj}
                muted
                ref={(instance) => registerMediaRef?.(obj.id, instance)}
              />

              {isSelected && (
                <>
                  <button
                    type="button"
                    className="canvas-rotate-handle"
                    onPointerDown={(e) => startRotate(e, obj)}
                    title="Rotate"
                  />
                  {HANDLES.map((handle) => (
                    <span
                      key={handle}
                      className={`canvas-resize-handle canvas-resize-handle--${handle}`}
                      onPointerDown={(e) => startResize(e, obj, handle)}
                    />
                  ))}
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default Canvas;
