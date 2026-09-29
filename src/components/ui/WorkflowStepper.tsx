import React from 'react';
import { Check } from 'lucide-react';
import { cn } from '../../utils/cn';

interface Step {
  label: string;
  status: 'completed' | 'current' | 'pending';
  date?: string;
}

interface WorkflowStepperProps {
  steps: Step[];
  orientation?: 'horizontal' | 'vertical';
}

export const WorkflowStepper: React.FC<WorkflowStepperProps> = ({
  steps,
  orientation = 'horizontal',
}) => {
  if (orientation === 'vertical') {
    return (
      <div className="space-y-0">
        {steps.map((step, i) => (
          <div key={i} className="flex gap-3">
            <div className="flex flex-col items-center">
              <div className={cn(
                'w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-semibold transition-colors',
                step.status === 'completed' ? 'bg-emerald-500 text-white' :
                step.status === 'current' ? 'bg-blue-600 text-white ring-4 ring-blue-100' :
                'bg-white border-2 border-slate-200 text-slate-400'
              )}>
                {step.status === 'completed' ? <Check className="w-3.5 h-3.5" /> : i + 1}
              </div>
              {i < steps.length - 1 && (
                <div className={cn(
                  'w-0.5 h-8 mt-1',
                  step.status === 'completed' ? 'bg-emerald-300' : 'bg-slate-200'
                )} />
              )}
            </div>
            <div className="pb-6 pt-0.5">
              <div className={cn(
                'text-sm font-medium',
                step.status === 'pending' ? 'text-slate-400' : 'text-slate-900'
              )}>
                {step.label}
              </div>
              {step.date && (
                <div className="text-xs text-slate-400 mt-0.5">{step.date}</div>
              )}
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-2">
      {steps.map((step, i) => (
        <React.Fragment key={i}>
          <div className="flex flex-col items-center gap-1.5 flex-shrink-0">
            <div className={cn(
              'w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold transition-all',
              step.status === 'completed' ? 'bg-emerald-500 text-white' :
              step.status === 'current' ? 'bg-blue-600 text-white ring-4 ring-blue-100' :
              'bg-white border-2 border-slate-200 text-slate-400'
            )}>
              {step.status === 'completed' ? <Check className="w-3.5 h-3.5" /> : i + 1}
            </div>
            <span className={cn(
              'text-xs font-medium text-center max-w-16',
              step.status === 'pending' ? 'text-slate-400' :
              step.status === 'current' ? 'text-blue-700' : 'text-slate-700'
            )}>
              {step.label}
            </span>
          </div>
          {i < steps.length - 1 && (
            <div className={cn(
              'flex-1 h-0.5 mb-4',
              step.status === 'completed' ? 'bg-emerald-300' : 'bg-slate-200'
            )} />
          )}
        </React.Fragment>
      ))}
    </div>
  );
};
