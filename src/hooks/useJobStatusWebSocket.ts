import { useState, useEffect, useRef } from 'react';
import { JobStatus } from '../types/api';
import type { JobStatusResponse } from '../types/api';

const WS_BASE_URL = import.meta.env.VITE_API_URL?.replace('http', 'ws') || 'ws://localhost:8000';

export const useJobStatusWebSocket = (jobId: string | null) => {
  const [status, setStatus] = useState<JobStatusResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [connectionState, setConnectionState] = useState<'connecting' | 'connected' | 'disconnected'>('disconnected');

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<number | undefined>(undefined);
  const heartbeatIntervalRef = useRef<number | undefined>(undefined);
  const reconnectAttempts = useRef(0);

  useEffect(() => {
    if (!jobId) return;

    const connect = () => {
      // Clean up existing connection
      if (wsRef.current) {
        wsRef.current.close();
      }

      setConnectionState('connecting');
      const ws = new WebSocket(`${WS_BASE_URL}/api/ws/status/${jobId}`);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('WebSocket connected');
        setConnectionState('connected');
        setError(null);
        reconnectAttempts.current = 0;

        // Start heartbeat to keep connection alive
        heartbeatIntervalRef.current = window.setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send('ping');
          }
        }, 15000); // Ping every 15 seconds
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          // Handle heartbeat response
          if (event.data === 'pong') return;

          // Handle error messages
          if (data.error) {
            setError(data.error);
            ws.close();
            return;
          }

          // Update status
          setStatus(data);
          setLoading(false);

          // Close connection if job is complete
          if (data.status === JobStatus.COMPLETED || data.status === JobStatus.FAILED) {
            console.log('Job finished, closing WebSocket');
            ws.close();
          }
        } catch (err) {
          console.error('Failed to parse WebSocket message:', err);
        }
      };

      ws.onerror = (event) => {
        console.error('WebSocket error:', event);
        setError('Connection error');
      };

      ws.onclose = () => {
        console.log('WebSocket closed');
        setConnectionState('disconnected');

        // Clear heartbeat
        if (heartbeatIntervalRef.current !== undefined) {
          window.clearInterval(heartbeatIntervalRef.current);
        }

        // Reconnect if job is not complete and haven't exceeded max attempts
        if (status?.status !== JobStatus.COMPLETED &&
            status?.status !== JobStatus.FAILED &&
            reconnectAttempts.current < 5) {

          const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 10000);
          console.log(`Reconnecting in ${delay}ms (attempt ${reconnectAttempts.current + 1})`);

          reconnectAttempts.current++;
          reconnectTimeoutRef.current = window.setTimeout(connect, delay);
        }
      };
    };

    setLoading(true);
    connect();

    // Cleanup
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
      if (reconnectTimeoutRef.current !== undefined) {
        window.clearTimeout(reconnectTimeoutRef.current);
      }
      if (heartbeatIntervalRef.current !== undefined) {
        window.clearInterval(heartbeatIntervalRef.current);
      }
    };
  }, [jobId, status?.status]);

  return { status, loading, error, connectionState };
};
