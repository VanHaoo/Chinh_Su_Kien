// Keeps a single in-memory "live" snapshot: the last state a Control client
// pushed with GO LIVE. New Output clients get it immediately on connect so
// a projector that reconnects mid-show catches up right away.
let liveState = null; // { projectId, width, height, objects, revision }
let revision = 0;

export function attachSocket(io) {
  const controlRoom = "control";
  const outputRoom = "output";

  function broadcastOutputStatus() {
    const count = io.sockets.adapter.rooms.get(outputRoom)?.size ?? 0;
    io.to(controlRoom).emit("server:output-status", { connected: count > 0, count });
  }

  io.on("connection", (socket) => {
    socket.data.role = null;

    socket.on("join", ({ role }) => {
      if (role !== "control" && role !== "output") return;
      socket.data.role = role;
      socket.join(role === "control" ? controlRoom : outputRoom);

      if (role === "output") {
        socket.emit("output:state", liveState);
        broadcastOutputStatus();
      } else {
        broadcastOutputStatus();
      }
    });

    // Control pushes the full canvas state to Output.
    socket.on("control:go-live", (state) => {
      revision += 1;
      liveState = { ...state, revision };
      io.to(outputRoom).emit("output:state", liveState);
    });

    // Transport commands (play/pause/seek) for whichever video/YouTube
    // object is currently "active" on the timeline.
    socket.on("control:transport", (command) => {
      io.to(outputRoom).emit("output:transport", command);
    });

    socket.on("disconnect", () => {
      if (socket.data.role === "output") broadcastOutputStatus();
    });
  });
}
