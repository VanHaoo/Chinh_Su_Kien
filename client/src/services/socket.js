import { io } from "socket.io-client";

// A single shared connection per browser tab. Using the current origin
// means the dev proxy (or a same-origin production deploy) just works.
let socket = null;

export function getSocket() {
  if (!socket) {
    socket = io({
      autoConnect: true,
      reconnection: true,
      reconnectionDelay: 500,
      reconnectionDelayMax: 3000,
    });
  }
  return socket;
}

export function joinAs(role) {
  const s = getSocket();
  const join = () => s.emit("join", { role });
  if (s.connected) join();
  s.on("connect", join);
  return () => s.off("connect", join);
}
