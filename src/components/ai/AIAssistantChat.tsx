import { useState, useRef, useEffect } from 'react';
import { Bot, Send, Loader2, Settings, Trash2, CheckCircle, XCircle, AlertTriangle, Eye, Play, Undo2, History, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { getAIAssistant, isAIAssistantConfigured, type AIResponse, type PreviewChange, type OperationHistoryEntry } from '../../lib/ai/aiAssistant';
import { useSurveyStore } from '../../lib/survey/store';
import AIAssistantSettings from '../settings/AIAssistantSettings';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  previewChanges?: PreviewChange[];
  applied?: boolean;
  operationId?: string;
}

const AIAssistantChat = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [operationHistory, setOperationHistory] = useState<OperationHistoryEntry[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  const { activeSurvey } = useSurveyStore();
  const isConfigured = isAIAssistantConfigured();

  const refreshHistory = () => {
    const assistant = getAIAssistant();
    setOperationHistory(assistant.getOperationHistory());
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (activeSurvey) {
      const assistant = getAIAssistant();
      assistant.setSurveyId(activeSurvey.id);
    }
  }, [activeSurvey?.id]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;
    
    if (!isConfigured) {
      toast.error('Please configure your OpenAI API key first');
      setShowSettings(true);
      return;
    }

    if (!activeSurvey) {
      toast.error('Please open a survey first to use the AI Assistant');
      return;
    }

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: input.trim(),
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const assistant = getAIAssistant();
      const response: AIResponse = await assistant.chat(input.trim());

      const assistantMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: response.message,
        timestamp: new Date(),
        previewChanges: response.previewChanges
      };

      setMessages(prev => [...prev, assistantMessage]);

      if (response.error) {
        toast.error(response.error);
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to process request');
      
      const errorMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: `Error: ${error.message || 'Something went wrong'}`,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleApplyChanges = async (changes: PreviewChange[], messageId: string) => {
    setIsLoading(true);
    try {
      const assistant = getAIAssistant();
      const result = await assistant.applyPreviewedChanges(changes);
      
      if (result.success) {
        // toast suppressed
        
        setMessages(prev => prev.map(msg => 
          msg.id === messageId 
            ? { ...msg, applied: true, operationId: result.operationId }
            : msg
        ));
        refreshHistory();
      } else {
        toast.error(result.details[0] || 'Failed to apply changes');
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to apply changes');
    } finally {
      setIsLoading(false);
    }
  };

  const handleUndoOperation = async (operationId: string) => {
    setIsLoading(true);
    try {
      const assistant = getAIAssistant();
      const result = await assistant.undoOperation(operationId);
      
      if (result.success) {
        // toast suppressed
        refreshHistory();
        
        // Update messages to reflect the undo
        setMessages(prev => prev.map(msg => 
          msg.operationId === operationId 
            ? { ...msg, applied: false, operationId: undefined }
            : msg
        ));
      } else {
        toast.error(result.details[0] || 'Failed to undo');
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to undo operation');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearChat = () => {
    const assistant = getAIAssistant();
    assistant.clearHistory();
    setMessages([]);
    // toast suppressed
  };

  if (showSettings) {
    return (
      <div className="h-full flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Settings className="w-5 h-5" />
            AI Assistant Settings
          </h3>
          <button
            onClick={() => setShowSettings(false)}
            className="text-gray-400 hover:text-white"
            data-testid="button-close-settings"
          >
            Back to Chat
          </button>
        </div>
        <div className="flex-1 overflow-auto">
          <AIAssistantSettings />
        </div>
      </div>
    );
  }

  if (showHistory) {
    return (
      <div className="h-full flex flex-col bg-gray-900">
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <History className="w-5 h-5" />
            Operation History
          </h3>
          <button
            onClick={() => setShowHistory(false)}
            className="text-gray-400 hover:text-white"
            data-testid="button-close-history"
          >
            Back to Chat
          </button>
        </div>
        <div className="flex-1 overflow-auto p-4">
          {operationHistory.length === 0 ? (
            <div className="text-center text-gray-500 py-8">
              <History className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p className="text-sm">No operations yet</p>
              <p className="text-xs mt-1">Applied changes will appear here for undo</p>
            </div>
          ) : (
            <div className="space-y-3">
              {operationHistory.map((entry) => (
                <div
                  key={entry.id}
                  className={`p-3 rounded-lg border ${
                    entry.undone 
                      ? 'bg-gray-800/50 border-gray-700 opacity-60' 
                      : 'bg-gray-800 border-gray-600'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-sm">{entry.description}</span>
                    {entry.undone ? (
                      <span className="text-xs text-gray-400 flex items-center gap-1">
                        <RotateCcw className="w-3 h-3" />
                        Undone
                      </span>
                    ) : (
                      <button
                        onClick={() => handleUndoOperation(entry.id)}
                        disabled={isLoading}
                        className="flex items-center gap-1 px-2 py-1 bg-amber-600 hover:bg-amber-700 disabled:bg-gray-600 rounded text-xs"
                        data-testid={`button-undo-history-${entry.id}`}
                      >
                        <RotateCcw className="w-3 h-3" />
                        Undo
                      </button>
                    )}
                  </div>
                  <div className="text-xs text-gray-400">
                    {entry.timestamp.toLocaleString()} • {entry.changes.length} changes
                  </div>
                  <div className="mt-2 space-y-1 max-h-24 overflow-auto">
                    {entry.changes.slice(0, 3).map((change, i) => (
                      <div key={i} className={`text-xs p-1 rounded ${
                        change.action === 'delete' ? 'bg-red-900/20 text-red-300' : 'bg-blue-900/20 text-blue-300'
                      }`}>
                        {change.description}
                      </div>
                    ))}
                    {entry.changes.length > 3 && (
                      <p className="text-xs text-gray-500">...and {entry.changes.length - 3} more</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-gray-900">
      <div className="flex items-center justify-between p-3 border-b border-gray-700">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-gradient-to-br from-emerald-600 to-teal-600 rounded-lg">
            <Bot className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-semibold">AI Data Assistant</h3>
            {activeSurvey ? (
              <p className="text-xs text-gray-400">Survey: {activeSurvey.surveyTitle || 'Unnamed'}</p>
            ) : (
              <p className="text-xs text-amber-400">No survey open</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isConfigured ? (
            <span className="flex items-center gap-1 text-xs text-green-400">
              <CheckCircle className="w-3 h-3" />
              Connected
            </span>
          ) : (
            <span className="flex items-center gap-1 text-xs text-amber-400">
              <AlertTriangle className="w-3 h-3" />
              Not configured
            </span>
          )}
          <button
            onClick={() => { refreshHistory(); setShowHistory(true); }}
            className="p-1.5 hover:bg-gray-700 rounded transition-colors"
            title="Operation History"
            data-testid="button-open-history"
          >
            <History className="w-4 h-4" />
          </button>
          <button
            onClick={() => setShowSettings(true)}
            className="p-1.5 hover:bg-gray-700 rounded transition-colors"
            title="Settings"
            data-testid="button-open-settings"
          >
            <Settings className="w-4 h-4" />
          </button>
          <button
            onClick={handleClearChat}
            className="p-1.5 hover:bg-gray-700 rounded transition-colors text-gray-400 hover:text-red-400"
            title="Clear chat"
            data-testid="button-clear-chat"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center text-gray-500 py-8">
            <Bot className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p className="text-sm mb-2">Ask me anything about your survey data</p>
            <div className="text-xs space-y-1 text-gray-600">
              <p>"Show all bridge POIs with height under 5m"</p>
              <p>"Change all power_line POIs to utility_pole"</p>
              <p>"Delete POIs from road 3 that have no photos"</p>
              <p>"Analyze the image on POI #42"</p>
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[85%] rounded-lg p-3 ${
                msg.role === 'user'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-gray-800 text-gray-100'
              }`}
            >
              <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
              
              {msg.previewChanges && msg.previewChanges.length > 0 && (
                <div className="mt-3 pt-3 border-t border-gray-600">
                  <div className="flex items-center gap-2 mb-2">
                    <Eye className="w-4 h-4 text-amber-400" />
                    <span className="text-xs font-medium text-amber-400">
                      Preview: {msg.previewChanges.length} changes
                    </span>
                  </div>
                  
                  <div className="space-y-1 max-h-32 overflow-auto text-xs">
                    {msg.previewChanges.slice(0, 5).map((change, i) => (
                      <div key={i} className={`flex items-center gap-2 p-1 rounded ${
                        change.action === 'delete' ? 'bg-red-900/30' : 'bg-blue-900/30'
                      }`}>
                        {change.action === 'delete' ? (
                          <XCircle className="w-3 h-3 text-red-400" />
                        ) : (
                          <CheckCircle className="w-3 h-3 text-blue-400" />
                        )}
                        <span className="truncate">{change.description}</span>
                      </div>
                    ))}
                    {msg.previewChanges.length > 5 && (
                      <p className="text-gray-400">...and {msg.previewChanges.length - 5} more</p>
                    )}
                  </div>

                  {!msg.applied && (
                    <div className="flex gap-2 mt-2">
                      <button
                        onClick={() => handleApplyChanges(msg.previewChanges!, msg.id)}
                        disabled={isLoading}
                        className="flex items-center gap-1 px-2 py-1 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-600 rounded text-xs"
                        data-testid={`button-apply-changes-${msg.id}`}
                      >
                        <Play className="w-3 h-3" />
                        Apply Changes
                      </button>
                      <button
                        onClick={() => setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, previewChanges: undefined } : m))}
                        className="flex items-center gap-1 px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded text-xs"
                        data-testid={`button-cancel-changes-${msg.id}`}
                      >
                        <Undo2 className="w-3 h-3" />
                        Cancel
                      </button>
                    </div>
                  )}

                  {msg.applied && msg.operationId && (
                    <div className="flex items-center justify-between mt-2">
                      <div className="flex items-center gap-1 text-green-400 text-xs">
                        <CheckCircle className="w-3 h-3" />
                        Changes applied
                      </div>
                      <button
                        onClick={() => handleUndoOperation(msg.operationId!)}
                        disabled={isLoading}
                        className="flex items-center gap-1 px-2 py-1 bg-amber-600 hover:bg-amber-700 disabled:bg-gray-600 rounded text-xs"
                        data-testid={`button-undo-${msg.id}`}
                      >
                        <RotateCcw className="w-3 h-3" />
                        Undo
                      </button>
                    </div>
                  )}

                  {msg.applied && !msg.operationId && (
                    <div className="flex items-center gap-1 mt-2 text-green-400 text-xs">
                      <CheckCircle className="w-3 h-3" />
                      Changes applied
                    </div>
                  )}
                </div>
              )}
              
              <p className="text-xs opacity-50 mt-1">
                {msg.timestamp.toLocaleTimeString()}
              </p>
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-gray-800 rounded-lg p-3">
              <Loader2 className="w-5 h-5 animate-spin text-emerald-400" />
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <div className="p-3 border-t border-gray-700">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
            placeholder={isConfigured ? "Ask about your survey data..." : "Configure API key to start"}
            disabled={!isConfigured || isLoading}
            className="flex-1 px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50"
            data-testid="input-chat-message"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isLoading || !isConfigured}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg transition-colors"
            data-testid="button-send-message"
          >
            {isLoading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Send className="w-5 h-5" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AIAssistantChat;
