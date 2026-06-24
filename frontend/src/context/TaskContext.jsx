import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { listTasks } from "../api/client";
import { io } from "socket.io-client";

const TaskContext = createContext(null);

const INITIAL_RETRY_MS = 1000;
const MAX_RETRY_MS = 30000;

export function TaskProvider({ children }) {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const socketRef = useRef(null);
  const retryTimerRef = useRef(null);
  const retryDelayRef = useRef(INITIAL_RETRY_MS);

  const refreshTasks = useCallback(async () => {
    try {
      const data = await listTasks();
      setTasks(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load tasks");
    } finally {
      setLoading(false);
    }
  }, []);

  const activeCount = useMemo(
    () => tasks.filter((task) => task.status === "pending" || task.status === "running").length,
    [tasks],
  );

  useEffect(() => {
    let cancelled = false;

    const clearRetryTimer = () => {
      if (retryTimerRef.current !== null) {
        window.clearTimeout(retryTimerRef.current);
        retryTimerRef.current = null;
      }
    };

    const scheduleReconnect = () => {
      if (cancelled) {
        return;
      }

      clearRetryTimer();
      retryTimerRef.current = window.setTimeout(() => {
        retryDelayRef.current = Math.min(retryDelayRef.current * 2, MAX_RETRY_MS);
        connect();
      }, retryDelayRef.current);
    };

    const connect = () => {
      if (cancelled) {
        return;
      }

      clearRetryTimer();
      socketRef.current?.close();

      // Establish Socket.IO connection
      const backendUrl = process.env.REACT_APP_BACKEND_URL || window.location.origin;
      const socket = io(`${backendUrl}/ws`, {
        transports: ['websocket'],
        upgrade: false
      });
      socketRef.current = socket;

      socket.on('connect', () => {
        retryDelayRef.current = INITIAL_RETRY_MS;
        setError(null);
      });

      socket.on('snapshot', (payload) => {
        try {
          if (Array.isArray(payload)) {
            setTasks(payload);
            setError(null);
            setLoading(false);
          }
        } catch {
          setError('Received invalid task update');
        }
      });

      socket.on('connect_error', () => {
        setError('Task connection error');
      });

      socket.on('disconnect', () => {
        if (cancelled) {
          return;
        }
        setLoading(false);
        scheduleReconnect();
      });
    };

    connect();

    return () => {
      cancelled = true;
      clearRetryTimer();
      socketRef.current?.close();
      socketRef.current = null;
    };
  }, []);

  const value = useMemo(
    () => ({
      tasks,
      activeCount,
      loading,
      error,
      refreshTasks,
    }),
    [tasks, activeCount, loading, error, refreshTasks],
  );

  return <TaskContext.Provider value={value}>{children}</TaskContext.Provider>;
}

export function useTasks() {
  const context = useContext(TaskContext);
  if (!context) {
    throw new Error("useTasks must be used within TaskProvider");
  }
  return context;
}
