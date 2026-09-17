import { useEffect, useState } from "react";
import { getSocket, joinAs } from "../services/socket.js";

// Wraps the Output side of the Socket.IO contract from server/socket.js:
// - emits 'join' as output (server immediately replies with the last live state)
// - listens for 'output:state' (full canvas snapshot) and 'output:transport'
//   (play/pause/seek for the active media object)
export function useLiveReceiver() {
  const [connected, setConnected] = useState(() => getSocket().connected);
  const [liveState, setLiveState] = useState(null);
  const [transport, setTransport] = useState(null);

  useEffect(() => {
    const socket = getSocket();
    const unjoin = joinAs("output");

    const onConnect = () => setConnected(true);
    const onDisconnect = () => setConnected(false);
    const onState = (state) => setLiveState(state);
    const onTransport = (command) => setTransport({ ...command, receivedAt: Date.now() });

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("output:state", onState);
    socket.on("output:transport", onTransport);

    return () => {
      unjoin();
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("output:state", onState);
      socket.off("output:transport", onTransport);
    };
  }, []);

  return { connected, liveState, transport };
}
