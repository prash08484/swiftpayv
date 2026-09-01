import { useEffect, useState, useRef, useCallback } from "react";
import { io } from "socket.io-client";
import { getToken } from "../utils/auth";

export const useSocket = () => {
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const socketRef = useRef(null);

  useEffect(() => {
    const token = getToken();
    if (!token) {
      console.warn("No JWT token found, socket connection skipped");
      return;
    }

    const backendUrl = (import.meta.env.VITE_BACKEND_URL || import.meta.env.VITE_API_URL || "http://localhost:8080")
      .replace(/\/api\/v1\/?$/, "");
    const newSocket = io(backendUrl, {
      auth: { token },
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 5,
    });

    newSocket.on("connect", () => {
      console.log("Socket connected:", newSocket.id);
      setIsConnected(true);
    });

    newSocket.on("disconnect", () => {
      console.log("Socket disconnected");
      setIsConnected(false);
    });

    newSocket.on("error", (error) => {
      console.error("Socket error:", error);
    });

    newSocket.on("connect_error", (error) => {
      console.error("Connection error:", error);
    });

    socketRef.current = newSocket;
    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, []);

  const onPaymentReceived = useCallback((callback) => {
    if (!socketRef.current) return;
    socketRef.current.on("payment_received", callback);
    return () => socketRef.current?.off("payment_received", callback);
  }, []);

  const onPaymentRequest = useCallback((callback) => {
    if (!socketRef.current) return;
    socketRef.current.on("payment_request", callback);
    return () => socketRef.current?.off("payment_request", callback);
  }, []);

  const onRequestAccepted = useCallback((callback) => {
    if (!socketRef.current) return;
    socketRef.current.on("payment_request_accepted", callback);
    return () => socketRef.current?.off("payment_request_accepted", callback);
  }, []);

  const onRequestRejected = useCallback((callback) => {
    if (!socketRef.current) return;
    socketRef.current.on("payment_request_rejected", callback);
    return () => socketRef.current?.off("payment_request_rejected", callback);
  }, []);

  const onPaymentCompleted = useCallback((callback) => {
    if (!socketRef.current) return;
    socketRef.current.on("payment_completed", callback);
    return () => socketRef.current?.off("payment_completed", callback);
  }, []);

  const confirmPaymentReceived = useCallback((data) => {
    if (!socketRef.current) return;
    socketRef.current.emit("payment_received_confirm", data);
  }, []);

  const confirmPaymentRequest = useCallback((data) => {
    if (!socketRef.current) return;
    socketRef.current.emit("payment_request_confirm", data);
  }, []);

  const confirmRequestAccepted = useCallback((data) => {
    if (!socketRef.current) return;
    socketRef.current.emit("request_accepted_confirm", data);
  }, []);

  const confirmRequestRejected = useCallback((data) => {
    if (!socketRef.current) return;
    socketRef.current.emit("request_rejected_confirm", data);
  }, []);

  return {
    socket,
    isConnected,
    onPaymentReceived,
    onPaymentRequest,
    onRequestAccepted,
    onRequestRejected,
    onPaymentCompleted,
    confirmPaymentReceived,
    confirmPaymentRequest,
    confirmRequestAccepted,
    confirmRequestRejected,
  };
};

export default useSocket;
