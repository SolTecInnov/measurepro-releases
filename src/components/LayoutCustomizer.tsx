import React, { useState, useEffect } from 'react';
import { X, Eye, EyeOff, GripVertical, Save, RotateCcw } from 'lucide-react';
import { LayoutCard } from '@/hooks/useLayoutCustomization';

interface LayoutCustomizerProps {
  cards: LayoutCard[];
  onLayoutChange: (cards: LayoutCard[]) => void;
  isOpen: boolean;
  onClose: () => void;
}

export const LayoutCustomizer: React.FC<LayoutCustomizerProps> = ({
  cards,
  onLayoutChange,
  isOpen,
  onClose
}) => {
  const [localCards, setLocalCards] = useState<LayoutCard[]>(cards);
  const [draggedCard, setDraggedCard] = useState<string | null>(null);

  // Sync localCards with latest cards prop whenever modal opens
  useEffect(() => {
    if (isOpen) {
      setLocalCards(cards);
    }
  }, [isOpen, cards]);

  if (!isOpen) return null;

  const handleVisibilityToggle = (cardId: string) => {
    setLocalCards(prev => 
      prev.map(card => 
        card.id === cardId 
          ? { ...card, visible: !card.visible }
          : card
      )
    );
  };

  const handleDragStart = (e: React.DragEvent, cardId: string) => {
    setDraggedCard(cardId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent, targetCardId: string, targetColumn: 1 | 2) => {
    e.preventDefault();
    
    if (!draggedCard || draggedCard === targetCardId) return;

    setLocalCards(prev => {
      const draggedIndex = prev.findIndex(card => card.id === draggedCard);
      const targetIndex = prev.findIndex(card => card.id === targetCardId);
      
      if (draggedIndex === -1 || targetIndex === -1) return prev;

      const newCards = [...prev];
      const [draggedItem] = newCards.splice(draggedIndex, 1);
      
      // Update the dragged card's column to match target
      draggedItem.position = { ...draggedItem.position, column: targetColumn };
      
      newCards.splice(targetIndex, 0, draggedItem);

      // Update row positions for each column separately
      const leftColumnCards = newCards.filter(c => c.position.column === 1);
      const rightColumnCards = newCards.filter(c => c.position.column === 2);
      
      leftColumnCards.forEach((card, idx) => {
        card.position.row = idx + 1;
      });
      
      rightColumnCards.forEach((card, idx) => {
        card.position.row = idx + 1;
      });

      return newCards;
    });

    setDraggedCard(null);
  };

  // Handle dropping on column drop zone (empty area)
  const handleColumnDrop = (e: React.DragEvent, targetColumn: 1 | 2) => {
    e.preventDefault();
    
    if (!draggedCard) return;

    setLocalCards(prev => {
      const draggedIndex = prev.findIndex(card => card.id === draggedCard);
      if (draggedIndex === -1) return prev;

      const newCards = [...prev];
      const draggedItem = newCards[draggedIndex];
      
      // Only move if it's a different column
      if (draggedItem.position.column !== targetColumn) {
        draggedItem.position.column = targetColumn;
        
        // Update row positions for each column
        const leftColumnCards = newCards.filter(c => c.position.column === 1);
        const rightColumnCards = newCards.filter(c => c.position.column === 2);
        
        leftColumnCards.forEach((card, idx) => {
          card.position.row = idx + 1;
        });
        
        rightColumnCards.forEach((card, idx) => {
          card.position.row = idx + 1;
        });
      }

      return newCards;
    });

    setDraggedCard(null);
  };

  const handleSave = () => {
    onLayoutChange(localCards);
    onClose();
  };

  const handleCancel = () => {
    setLocalCards(cards);
    onClose();
  };

  const handleReset = () => {
    const resetCards = localCards.map(card => ({
      ...card,
      visible: true,
      collapsed: false,
      position: { ...card.defaultPosition }
    }));
    setLocalCards(resetCards);
  };

  // Group cards by column
  const leftColumnCards = localCards.filter(card => card.position.column === 1);
  const rightColumnCards = localCards.filter(card => card.position.column === 2);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex-shrink-0 flex items-center justify-between p-6 border-b border-gray-700">
          <h2 className="text-xl font-semibold text-white">Customize Layout</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-300 p-1"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content - scrollable */}
        <div className="flex-1 overflow-y-auto p-6 min-h-0">
          <div className="grid grid-cols-2 gap-6">
            {/* Left Column */}
            <div
              onDragOver={handleDragOver}
              onDrop={(e) => handleColumnDrop(e, 1)}
              className="min-h-[200px]"
            >
              <h3 className="text-lg font-medium text-white mb-4">Left Column</h3>
              <div className="space-y-3">
                {leftColumnCards.map((card) => (
                  <div
                    key={card.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, card.id)}
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDrop(e, card.id, 1)}
                    className={`flex items-center justify-between p-4 rounded-lg border-2 transition-all cursor-move ${
                      card.visible
                        ? 'bg-gray-700 border-gray-600 text-white'
                        : 'bg-gray-800 border-gray-700 text-gray-400'
                    } ${draggedCard === card.id ? 'opacity-50' : ''}`}
                  >
                    <div className="flex items-center gap-3">
                      <GripVertical className="w-4 h-4 text-gray-500" />
                      <span className="font-medium">{card.name}</span>
                    </div>
                    <button
                      onClick={() => handleVisibilityToggle(card.id)}
                      className={`p-2 rounded-lg transition-colors ${
                        card.visible
                          ? 'text-green-400 hover:bg-green-500/20'
                          : 'text-gray-500 hover:bg-gray-600'
                      }`}
                    >
                      {card.visible ? (
                        <Eye className="w-5 h-5" />
                      ) : (
                        <EyeOff className="w-5 h-5" />
                      )}
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Right Column */}
            <div
              onDragOver={handleDragOver}
              onDrop={(e) => handleColumnDrop(e, 2)}
              className="min-h-[200px]"
            >
              <h3 className="text-lg font-medium text-white mb-4">Right Column</h3>
              <div className="space-y-3">
                {rightColumnCards.map((card) => (
                  <div
                    key={card.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, card.id)}
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDrop(e, card.id, 2)}
                    className={`flex items-center justify-between p-4 rounded-lg border-2 transition-all cursor-move ${
                      card.visible
                        ? 'bg-gray-700 border-gray-600 text-white'
                        : 'bg-gray-800 border-gray-700 text-gray-400'
                    } ${draggedCard === card.id ? 'opacity-50' : ''}`}
                  >
                    <div className="flex items-center gap-3">
                      <GripVertical className="w-4 h-4 text-gray-500" />
                      <span className="font-medium">{card.name}</span>
                    </div>
                    <button
                      onClick={() => handleVisibilityToggle(card.id)}
                      className={`p-2 rounded-lg transition-colors ${
                        card.visible
                          ? 'text-green-400 hover:bg-green-500/20'
                          : 'text-gray-500 hover:bg-gray-600'
                      }`}
                    >
                      {card.visible ? (
                        <Eye className="w-5 h-5" />
                      ) : (
                        <EyeOff className="w-5 h-5" />
                      )}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Instructions */}
          <div className="mt-6 bg-blue-900/20 border border-blue-800/30 rounded-lg p-4">
            <h4 className="text-sm font-medium text-blue-400 mb-2">Instructions</h4>
            <ul className="space-y-1 text-sm text-gray-300">
              <li>• Click the eye icon to show/hide components</li>
              <li>• Drag cards to reorder within a column or move between columns</li>
              <li>• Green eye = visible, Gray eye = hidden</li>
              <li>• Each card can be collapsed/expanded from its header (on the main screen)</li>
              <li>• Changes are applied when you click "Save Changes"</li>
            </ul>
          </div>
        </div>

        {/* Footer with buttons */}
        <div className="flex-shrink-0 flex items-center justify-between p-6 border-t border-gray-700 bg-gray-800">
          <button
            onClick={handleReset}
            className="flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
            Reset to Default
          </button>
          
          <div className="flex gap-3">
            <button
              onClick={handleCancel}
              className="px-6 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="flex items-center gap-2 px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
            >
              <Save className="w-4 h-4" />
              Save Changes
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};