import { ReactNode } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

interface CardWrapperProps {
  cardId: string;
  title: string;
  collapsed: boolean;
  onToggleCollapse: (cardId: string) => void;
  children: ReactNode;
  className?: string;
  headerAction?: ReactNode;
}

export const CardWrapper = ({
  cardId,
  title,
  collapsed,
  onToggleCollapse,
  children,
  className = '',
  headerAction
}: CardWrapperProps) => {
  return (
    <div className={`bg-gray-800 rounded-lg overflow-hidden ${className}`} data-testid={`card-${cardId}`}>
      {/* Card Header with Collapse Button */}
      <div className="flex items-center justify-between px-4 py-3 bg-gray-750 border-b border-gray-700">
        <h3 className="text-sm font-semibold text-gray-200">{title}</h3>
        <div className="flex items-center gap-2">
          {headerAction}
          <button
            onClick={() => onToggleCollapse(cardId)}
            className="p-1 hover:bg-gray-600 rounded transition-colors"
            data-testid={`button-collapse-${cardId}`}
            aria-label={collapsed ? `Expand ${title}` : `Collapse ${title}`}
          >
            {collapsed ? (
              <ChevronDown className="w-4 h-4 text-gray-400" />
            ) : (
              <ChevronUp className="w-4 h-4 text-gray-400" />
            )}
          </button>
        </div>
      </div>

      {/* Card Content - Hidden when collapsed */}
      {!collapsed && (
        <div className="transition-all duration-200">
          {children}
        </div>
      )}
    </div>
  );
};
