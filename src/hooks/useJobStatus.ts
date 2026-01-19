import { useState, useEffect } from 'react';
import { getJobStatus } from '../api/client';
import { JobStatus } from '../types/api';
import type { JobStatusResponse } from '../types/api';

export const useJobStatus = (jobId: string | null) => {
  const [status, setStatus] = useState<JobStatusResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!jobId) return;

    let interval: ReturnType<typeof setInterval>;

    const pollStatus = async () => {
      try {
        setLoading(true);
        const data = await getJobStatus(jobId);
        setStatus(data);

        if (data.status === JobStatus.COMPLETED || data.status === JobStatus.FAILED) {
          clearInterval(interval);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch status');
        clearInterval(interval);
      } finally {
        setLoading(false);
      }
    };

    pollStatus();
    interval = setInterval(pollStatus, 2000); // Poll every 2 seconds

    return () => clearInterval(interval);
  }, [jobId]);

  return { status, loading, error };
};
