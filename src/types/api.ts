export const JobStatus = {
  PENDING: 'pending',
  DOWNLOADING: 'downloading',
  TRANSCRIBING: 'transcribing',
  EDITING: 'editing',
  RENDERING: 'rendering',
  COMPLETED: 'completed',
  FAILED: 'failed',
} as const;

export type JobStatus = (typeof JobStatus)[keyof typeof JobStatus];

export interface JobResponse {
  job_id: string;
  status: JobStatus;
  message?: string;
}

export interface JobStatusResponse {
  job_id: string;
  status: JobStatus;
  progress: number;
  message: string;
  created_at: string;
  completed_at?: string;
  download_url?: string;
}

export interface Caption {
  text: string;
  start: number;  // seconds
  end: number;    // seconds
}

export interface CaptionsResponse {
  job_id: string;
  captions: Caption[];
  total_segments: number;
}

// Video trimmer types
export interface VideoMetadata {
  title: string;
  duration: number;
  width: number;
  height: number;
  thumbnail_url: string;
  embed_url?: string;
  video_id?: string;
  preview_url?: string;
  source_type: 'youtube' | 'upload';
}

export interface CropConfig {
  x: number;
  y: number;
  width: number;
  height: number;
  sourceWidth: number;
  sourceHeight: number;
}

export interface TrimCropSettings {
  startTime: number;
  endTime: number;
  crop: CropConfig | null;
}

export type AspectRatio = 'original' | '9:16' | '16:9' | '1:1' | '4:5' | 'custom';

export interface UploadPreviewResponse {
  job_id: string;
  metadata: VideoMetadata;
}
