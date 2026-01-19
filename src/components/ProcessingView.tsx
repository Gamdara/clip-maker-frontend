import { CircularProgress } from './ui/CircularProgress';
import { StepChecklist } from './ui/StepChecklist';
import { JobStatus, type JobStatusResponse } from '../types/api';

interface ProcessingViewProps {
  status: JobStatusResponse;
  onDownload: () => void;
}

export const ProcessingView = ({ status, onDownload: _onDownload }: ProcessingViewProps) => {
  const getSteps = () => {
    const steps: Array<{ label: string; status: 'completed' | 'in-progress' | 'pending' }> = [
      { label: 'Downloading video', status: 'pending' },
      { label: 'Extracting audio', status: 'pending' },
      { label: 'Transcribing speech', status: 'pending' },
      { label: 'Editing captions', status: 'pending' },
      { label: 'Rendering video', status: 'pending' },
    ];

    // Map backend status to step progression
    if (status.status === JobStatus.DOWNLOADING) {
      steps[0].status = 'in-progress';
    } else if (status.status === JobStatus.TRANSCRIBING) {
      steps[0].status = 'completed';
      steps[1].status = 'completed';
      steps[2].status = 'in-progress';
    } else if (status.status === JobStatus.EDITING) {
      steps[0].status = 'completed';
      steps[1].status = 'completed';
      steps[2].status = 'completed';
      steps[3].status = 'in-progress';
    } else if (status.status === JobStatus.RENDERING) {
      steps[0].status = 'completed';
      steps[1].status = 'completed';
      steps[2].status = 'completed';
      steps[3].status = 'completed';
      steps[4].status = 'in-progress';
    } else if (status.status === JobStatus.COMPLETED) {
      steps.forEach(step => step.status = 'completed');
    }

    return steps;
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 animate-fadeIn">
      <div className="w-full max-w-2xl flex flex-col items-center text-center space-y-12">
        <CircularProgress progress={status.progress} />

        <div className="space-y-4">
          <h2 className="text-3xl font-bold">
            {status.status === JobStatus.COMPLETED
              ? 'Processing Complete!'
              : status.message}
          </h2>
          <p className="text-muted-foreground">
            {status.status === JobStatus.COMPLETED
              ? 'Your video is ready to download'
              : 'This may take a few moments depending on video length'}
          </p>
        </div>

        <StepChecklist steps={getSteps()} />

        {status.status === JobStatus.COMPLETED && (
          <div className="text-muted-foreground text-sm animate-scaleIn">
            Redirecting to preview...
          </div>
        )}
      </div>
    </div>
  );
};
