import { useEffect, useState, useRef } from 'react';
import { useDemoStore } from '@/lib/demo/demoStore';
import { X, ChevronLeft, ChevronRight, Play, Pause } from 'lucide-react';

export function DemoOverlay() {
  const {
    isActive,
    isPlaying,
    getCurrentStep,
    getCurrentChapter,
    getProgress,
    nextStep,
    prevStep,
    pauseDemo,
    resumeDemo,
    stopDemo,
    currentStepIndex,
    currentChapterIndex,
    chapters,
  } = useDemoStore();

  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const step = getCurrentStep();
  const chapter = getCurrentChapter();
  const progress = getProgress();

  useEffect(() => {
    if (!step?.targetSelector) {
      setTargetRect(null);
      return;
    }

    const findTarget = () => {
      const target = document.querySelector(step.targetSelector!);
      if (target) {
        setTargetRect(target.getBoundingClientRect());
      } else {
        setTargetRect(null);
      }
    };

    findTarget();
    const interval = setInterval(findTarget, 500);
    return () => clearInterval(interval);
  }, [step?.targetSelector]);

  useEffect(() => {
    if (!isActive || !isPlaying || !step) return;

    timerRef.current = setTimeout(() => {
      nextStep();
    }, step.duration);

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [isActive, isPlaying, step, currentStepIndex, currentChapterIndex, nextStep]);

  if (!isActive || !step) return null;

  const getTooltipPosition = () => {
    if (!targetRect || step.position === 'center') {
      return {
        position: 'fixed' as const,
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
      };
    }

    const padding = 16;
    const tooltipWidth = 320;
    const tooltipHeight = 180;

    switch (step.position) {
      case 'top':
        return {
          position: 'fixed' as const,
          top: `${targetRect.top - tooltipHeight - padding}px`,
          left: `${targetRect.left + targetRect.width / 2 - tooltipWidth / 2}px`,
        };
      case 'bottom':
        return {
          position: 'fixed' as const,
          top: `${targetRect.bottom + padding}px`,
          left: `${targetRect.left + targetRect.width / 2 - tooltipWidth / 2}px`,
        };
      case 'left':
        return {
          position: 'fixed' as const,
          top: `${targetRect.top + targetRect.height / 2 - tooltipHeight / 2}px`,
          left: `${targetRect.left - tooltipWidth - padding}px`,
        };
      case 'right':
        return {
          position: 'fixed' as const,
          top: `${targetRect.top + targetRect.height / 2 - tooltipHeight / 2}px`,
          left: `${targetRect.right + padding}px`,
        };
      default:
        return {
          position: 'fixed' as const,
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
        };
    }
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-[9998] pointer-events-none" />
      
      {targetRect && step.position !== 'center' && (
        <div
          className="fixed z-[9999] pointer-events-none"
          style={{
            top: targetRect.top - 4,
            left: targetRect.left - 4,
            width: targetRect.width + 8,
            height: targetRect.height + 8,
            boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.5)',
            borderRadius: '8px',
            border: '2px solid #8b5cf6',
          }}
        />
      )}

      <div
        className="z-[10000] bg-gray-900 border border-purple-500/50 rounded-xl p-5 shadow-2xl w-80"
        style={getTooltipPosition()}
        data-testid="demo-tooltip"
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="text-purple-400 text-sm font-medium">
              {chapter?.title}
            </span>
            <span className="text-gray-500 text-xs">
              {progress.chapter}/{chapters.length}
            </span>
          </div>
          <button
            onClick={stopDemo}
            className="text-gray-400 hover:text-white p-1"
            data-testid="demo-close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <h3 className="text-lg font-semibold text-white mb-2">
          {step.title}
        </h3>
        <p className="text-gray-300 text-sm leading-relaxed mb-4">
          {step.description}
        </p>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={prevStep}
              className="p-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-white transition-colors"
              data-testid="demo-prev"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={isPlaying ? pauseDemo : resumeDemo}
              className="p-2 bg-purple-600 hover:bg-purple-500 rounded-lg text-white transition-colors"
              data-testid="demo-play-pause"
            >
              {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            </button>
            <button
              onClick={nextStep}
              className="p-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-white transition-colors"
              data-testid="demo-next"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-center gap-2">
            <div className="w-24 h-1.5 bg-gray-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-purple-500 to-blue-500 transition-all duration-300"
                style={{ width: `${progress.percent}%` }}
              />
            </div>
            <span className="text-xs text-gray-400">
              {Math.round(progress.percent)}%
            </span>
          </div>
        </div>
      </div>
    </>
  );
}
