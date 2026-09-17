import { nanoid } from "nanoid";

// Every object shares this shape: id/type/name/x/y/width/height/rotation/
// opacity/zIndex/visible are structural (spec section 4); `content` holds
// whatever is specific to the type (text style, media src, YouTube id...).
function base(type, name, overrides = {}) {
  return {
    id: nanoid(8),
    type,
    name,
    x: 200,
    y: 150,
    width: 400,
    height: 260,
    rotation: 0,
    opacity: 100,
    zIndex: 1,
    visible: true,
    content: {},
    ...overrides,
  };
}

export function createTextObject(overrides = {}) {
  return base("text", "Text", {
    width: 500,
    height: 140,
    content: {
      text: "New text",
      fontSize: 48,
      fontFamily: "Inter",
      bold: false,
      italic: false,
      color: "#e6e8eb",
      align: "center",
    },
    ...overrides,
  });
}

export function createImageObject({ url, filename }, overrides = {}) {
  return base("image", filename || "Image", {
    width: 480,
    height: 320,
    content: { src: url },
    ...overrides,
  });
}

export function createVideoObject({ url, filename }, overrides = {}) {
  return base("video", filename || "Video", {
    width: 640,
    height: 360,
    content: { src: url, volume: 1, loop: false },
    ...overrides,
  });
}

export function createYoutubeObject(videoId, overrides = {}) {
  return base("youtube", "YouTube", {
    width: 640,
    height: 360,
    content: { videoId },
    ...overrides,
  });
}
