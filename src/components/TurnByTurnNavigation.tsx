import React, { useState, useEffect } from 'react';
import { ArrowRight, ArrowLeft, ArrowUp, CornerDownRight, CornerDownLeft, CornerUpRight, CornerUpLeft, Volume2, VolumeX, Maximize2, Minimize2, X, ChevronUp, ChevronDown } from 'lucide-react';
import { speakInstruction, getSimplifiedInstruction } from '../lib/utils/routeUtils';

interface Instruction {
  text: string;
  distance: number;
  time: number;
  type: string;
  modifier?: string;
  icon: React.ReactNode;
}

interface TurnByTurnNavigationProps {
  instructions: Instruction[];
  currentInstructionIndex: number;
  distanceToNextInstruction: number;
  estimatedTimeToArrival: string;
  isMuted: boolean;
  onToggleMute: () => void;
  isNavigating: boolean;
  onStopNavigation: () => void;
  onToggleFullScreen?: () => void;
  isFullScreen?: boolean;
}

const TurnByTurnNavigation: React.FC<TurnByTurnNavigationProps> = ({
  instructions,
  currentInstructionIndex,
  distanceToNextInstruction,
  estimatedTimeToArrival,
  isMuted,
  onToggleMute,
  isNavigating,
  onStopNavigation,
  onToggleFullScreen,
  isFullScreen = true
}) => {
  const [showInstructionsList, setShowInstructionsList] = useState(false);
  const [lastSpokenIndex, setLastSpokenIndex] = useState(-1);
  
  // Get current and next instructions
  const currentInstruction = instructions[currentInstructionIndex];
  const nextInstruction = instructions[currentInstructionIndex + 1];
  
  // Speak instructions when they change
  useEffect(() => {
    if (!isMuted && currentInstructionIndex !== lastSpokenIndex && currentInstruction) {
      speakInstruction(getSimplifiedInstruction(currentInstruction));
      setLastSpokenIndex(currentInstructionIndex);
    }
  }, [currentInstructionIndex, currentInstruction, isMuted, lastSpokenIndex]);
  
  // Get icon for instruction type
  const getInstructionIcon = (instruction: Instruction) => {
    if (!instruction) return <ArrowUp className="w-6 h-6" />;
    
    const { type, modifier } = instruction;
    
    switch (type) {
      case 'turn':
        if (modifier === 'right') return <CornerDownRight className="w-6 h-6" />;
        if (modifier === 'left') return <CornerDownLeft className="w-6 h-6" />;
        if (modifier === 'slight right') return <CornerUpRight className="w-6 h-6" />;
        if (modifier === 'slight left') return <CornerUpLeft className="w-6 h-6" />;
        if (modifier === 'sharp right') return <ArrowRight className="w-6 h-6" />;
        if (modifier === 'sharp left') return <ArrowLeft className="w-6 h-6" />;
        return <ArrowUp className="w-6 h-6" />;
      case 'depart':
        return <ArrowUp className="w-6 h-6" />;
      case 'arrive':
        return <ArrowUp className="w-6 h-6 text-green-500" />;
      default:
        return <ArrowUp className="w-6 h-6" />;
    }
  };
  
  if (!isNavigating || !currentInstruction) {
    return null;
  }
  
  return (
    <div className="fixed bottom-0 left-0 right-0 bg-gray-800 border-t border-gray-700 p-4 z-50">
      <div className="max-w-3xl mx-auto">
        {/* Current instruction */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-4">
            <div className="bg-blue-500 p-3 rounded-full">
              {getInstructionIcon(currentInstruction)}
            </div>
            <div>
              <h3 className="text-lg font-medium">{currentInstruction.text}</h3>
              <p className="text-sm text-gray-400">
                {distanceToNextInstruction < 1000 
                  ? `${distanceToNextInstruction} m` 
                  : `${(distanceToNextInstruction / 1000).toFixed(1)} km`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={onToggleMute}
              className="p-2 bg-gray-700 hover:bg-gray-600 rounded-full"
            >
              {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
            </button>
            <button
              onClick={onToggleFullScreen}
              className="p-2 bg-gray-700 hover:bg-gray-600 rounded-full"
            >
              {isFullScreen ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
            </button>
            <button
              onClick={onStopNavigation}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg text-sm"
            >
              Stop Navigation
            </button>
          </div>
        </div>
        
        {/* Next instruction preview */}
        {nextInstruction && (
          <div className="flex items-center gap-4 bg-gray-700 p-2 rounded-lg">
            <div className="bg-gray-600 p-2 rounded-full">
              {getInstructionIcon(nextInstruction)}
            </div>
            <div>
              <p className="text-sm">Then: {nextInstruction.text}</p>
            </div>
          </div>
        )}
        
        {/* ETA */}
        <div className="mt-2 text-xs text-gray-400 flex justify-between">
          <span>ETA: {estimatedTimeToArrival}</span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowInstructionsList(!showInstructionsList)}
              className="flex items-center gap-1 text-blue-400 hover:text-blue-300"
            >
              {showInstructionsList ? (
                <>
                  <ChevronDown className="w-4 h-4" />
                  Hide instructions
                </>
              ) : (
                <>
                  <ChevronUp className="w-4 h-4" />
                  Show instructions
                </>
              )}
            </button>
          </div>
        </div>
        
        {/* Full instructions list */}
        {showInstructionsList && (
          <div className="mt-4 bg-gray-700 rounded-lg max-h-60 overflow-y-auto relative">
            <div className="p-2 text-sm font-medium border-b border-gray-600 flex justify-between items-center">
              <span>All Instructions</span>
              <button 
                onClick={() => setShowInstructionsList(false)}
                className="p-1 hover:bg-gray-600 rounded-full"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <ul className="divide-y divide-gray-600">
              {instructions.map((instruction, index) => (
                <li 
                  key={index} 
                  className={`p-3 flex items-center gap-3 ${
                    index === currentInstructionIndex ? 'bg-blue-500/20' : ''
                  }`}
                >
                  <div className={`p-1 rounded-full ${
                    index === currentInstructionIndex ? 'bg-blue-500' : 'bg-gray-600'
                  }`}>
                    {getInstructionIcon(instruction)}
                  </div>
                  <div>
                    <p className={`${index === currentInstructionIndex ? 'font-medium' : ''}`}>
                      {instruction.text}
                    </p>
                    <p className="text-xs text-gray-400">
                      {instruction.distance < 1000 
                        ? `${instruction.distance} m` 
                        : `${(instruction.distance / 1000).toFixed(1)} km`}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
};

export default TurnByTurnNavigation;