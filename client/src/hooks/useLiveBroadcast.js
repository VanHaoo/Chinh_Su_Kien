import { useCallback, useEffect, useRef, useState } from "react";
import { getSocket, joinAs } from "../services/socket.js";

// Wraps the Control side of the Socket.IO contract from server/socket.js:
// - emits 'join' as control
// - listens for 'server:output-status' to know if a projector is connected
// - exposes goLive(state) -> 'control:go-live'
// - exposes sendTransport(cmd) -> 'control:transport'
export function useLiveBroadcast() {
  const [socketConnected, setSocketConnected] = useState(() => getSocket().connected);
  const [outputConnected, setOutputConnected] = useState(false);
  const [isLive, setIsLive] = useState(false);
  const socketRef = useRef(null);

  useEffect(() => {
    const socket = getSocket();
    socketRef.current = socket;
    const unjoin = joinAs("control");

    const onConnect = () => setSocketConnected(true);
    const onDisconnect = () => {
      setSocketConnected(false);
      setOutputConnected(false);
    };
    const onStatus = ({ connected }) => setOutputConnected(connected);

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("server:output-status", onStatus);

    return () => {
      unjoin();
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("server:output-status", onStatus);
    };
  }, []);

  const goLive = useCallback((state) => {
    socketRef.current?.emit("control:go-live", state);
    setIsLive(true);
  }, []);

  const sendTransport = useCallback((command) => {
    socketRef.current?.emit("control:transport", command);
  }, []);

  return { socketConnected, outputConnected, isLive, goLive, sendTransport };
}
