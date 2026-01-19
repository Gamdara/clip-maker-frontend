import axios from 'axios';
import type { JobResponse, JobStatusResponse, VideoMetadata, TrimCropSettings, UploadPreviewResponse } from '../types/api';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const api = axios.create({
  baseURL: API_BASE_URL,
});

export const uploadVideo = async (file: File): Promise<JobResponse> => {
  const formData = new FormData();
  formData.append('file', file);
  const { data } = await api.post('/api/upload', formData);
  return data;
};

export const uploadVideoForPreview = async (file: File): Promise<UploadPreviewResponse> => {
  const formData = new FormData();
  formData.append('file', file);
  const { data } = await api.post('/api/upload-preview', formData);
  return data;
};

export const extractMetadata = async (url: string): Promise<VideoMetadata> => {
  const { data } = await api.post('/api/extract-metadata', { url });
  return data;
};

export const processUrl = async (
  url: string,
  settings?: TrimCropSettings
): Promise<JobResponse> => {
  const { data } = await api.post('/api/process-url', {
    url,
    start_time: settings?.startTime,
    end_time: settings?.endTime,
    crop: settings?.crop ? {
      x: Math.round(settings.crop.x),
      y: Math.round(settings.crop.y),
      width: Math.round(settings.crop.width),
      height: Math.round(settings.crop.height),
      source_width: settings.crop.sourceWidth,
      source_height: settings.crop.sourceHeight
    } : null
  });
  return data;
};

export const getJobStatus = async (jobId: string): Promise<JobStatusResponse> => {
  const { data } = await api.get(`/api/status/${jobId}`);
  return data;
};

export const getDownloadUrl = (jobId: string): string => {
  return `${API_BASE_URL}/api/download/${jobId}`;
};

export const getPreviewUploadUrl = (jobId: string): string => {
  return `${API_BASE_URL}/api/preview-upload/${jobId}`;
};
