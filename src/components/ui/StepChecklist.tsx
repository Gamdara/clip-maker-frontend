import { CheckCircle2, Circle, Loader2 } from 'lucide-react';

interface Step {
  label: string;
  status: 'completed' | 'in-progress' | 'pending';
}

interface StepChecklistProps {
  steps: Step[];
}

export const StepChecklist = ({ steps }: StepChecklistProps) => {
  return (
    <div className="space-y-4 w-full max-w-md mx-auto">
      {steps.map((step, index) => (
        <div
          key={index}
          className={`flex items-center gap-4 p-4 rounded-xl border transition-all ${
            step.status === 'completed'
              ? 'bg-card border-primary/30'
              : step.status === 'in-progress'
              ? 'bg-card border-primary'
              : 'bg-secondary border-border'
          }`}
        >
          {step.status === 'completed' ? (
            <CheckCircle2 className="w-6 h-6 text-primary flex-shrink-0" />
          ) : step.status === 'in-progress' ? (
            <Loader2 className="w-6 h-6 text-primary animate-spin flex-shrink-0" />
          ) : (
            <Circle className="w-6 h-6 text-muted-foreground flex-shrink-0" />
          )}
          <span
            className={`text-base ${
              step.status === 'pending' ? 'text-muted-foreground' : 'text-foreground'
            }`}
          >
            {step.label}
          </span>
        </div>
      ))}
    </div>
  );
};
