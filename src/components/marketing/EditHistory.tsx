import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { History, Save, Loader2, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { apiRequest, queryClient } from '@/lib/queryClient';
import type { MarketingEdit, InsertMarketingEdit } from '../../../shared/schema';

interface EditHistoryProps {
  documentId: string;
  documentTitle: string;
}

export function EditHistory({ documentId, documentTitle }: EditHistoryProps) {
  const [editorName, setEditorName] = useState('');
  const [editNote, setEditNote] = useState('');

  // Fetch edits
  const { data: edits, isLoading } = useQuery<{ success: boolean; edits: MarketingEdit[] }>({
    queryKey: ['/api/marketing/edits', documentId],
    enabled: !!documentId,
  });

  // Create edit mutation
  const createEditMutation = useMutation({
    mutationFn: async (data: InsertMarketingEdit & { password: string }) => {
      const response = await apiRequest('/api/marketing/edits', {
        method: 'POST',
        body: JSON.stringify(data),
      });
      
      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Unauthorized - Invalid password');
        }
        throw new Error('Failed to record edit');
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/marketing/edits', documentId] });
      setEditorName('');
      setEditNote('');
      // toast suppressed
    },
    onError: (error: Error) => {
      toast.error('Failed to record edit', {
        description: error.message,
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!editorName.trim()) {
      toast.error('Editor name is required');
      return;
    }
    
    if (!editNote.trim()) {
      toast.error('Edit description is required');
      return;
    }

    const password = sessionStorage.getItem('marketingPassword');
    if (!password) {
      toast.error('Session expired - please refresh the page');
      return;
    }

    createEditMutation.mutate({
      documentId,
      editorName: editorName.trim(),
      editNote: editNote.trim(),
      originalContent: `Edit to ${documentTitle}`,
      editedContent: `Modified by ${editorName.trim()}`,
      password,
    });
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
    });
  };

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <History className="w-5 h-5 text-pink-400" />
        <h3 className="text-lg font-semibold text-white">Edit History</h3>
        {edits?.edits && (
          <span className="ml-auto text-sm text-gray-400">
            {edits.edits.length}
          </span>
        )}
      </div>

      {/* Edit Form */}
      <form onSubmit={handleSubmit} className="mb-6 space-y-3">
        <div>
          <input
            type="text"
            value={editorName}
            onChange={(e) => setEditorName(e.target.value)}
            placeholder="Editor name"
            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent"
            data-testid="input-edit-editor"
            disabled={createEditMutation.isPending}
          />
        </div>
        <div>
          <textarea
            value={editNote}
            onChange={(e) => setEditNote(e.target.value)}
            placeholder="What did you change?"
            rows={3}
            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent resize-none"
            data-testid="input-edit-note"
            disabled={createEditMutation.isPending}
          />
        </div>
        <button
          type="submit"
          disabled={createEditMutation.isPending || !editorName.trim() || !editNote.trim()}
          className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-gradient-to-r from-pink-500 to-purple-500 text-white rounded-lg font-medium hover:from-pink-600 hover:to-purple-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          data-testid="button-record-edit"
        >
          {createEditMutation.isPending ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Recording...
            </>
          ) : (
            <>
              <Save className="w-4 h-4" />
              Record Edit
            </>
          )}
        </button>
      </form>

      {/* Edit Timeline */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-pink-400" />
          </div>
        ) : edits?.edits && edits.edits.length > 0 ? (
          <div className="relative">
            {/* Timeline line */}
            <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gradient-to-b from-pink-500/50 to-purple-500/20"></div>
            
            <div className="space-y-4">
              {edits.edits.map((edit) => (
                <div
                  key={edit.id}
                  className="relative pl-10"
                  data-testid={`edit-${edit.id}`}
                >
                  {/* Timeline dot */}
                  <div className="absolute left-2.5 top-2 w-3 h-3 rounded-full bg-gradient-to-br from-pink-400 to-purple-400 ring-4 ring-gray-900"></div>
                  
                  {/* Edit card */}
                  <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
                    <div className="flex items-start justify-between mb-2">
                      <span className="font-medium text-white" data-testid={`text-edit-editor-${edit.id}`}>
                        {edit.editorName}
                      </span>
                      <div className="flex items-center gap-1 text-xs text-gray-500">
                        <Clock className="w-3 h-3" />
                        <span data-testid={`text-edit-time-${edit.id}`}>
                          {formatDate(edit.createdAt.toString())}
                        </span>
                      </div>
                    </div>
                    {edit.editNote && (
                      <p className="text-gray-300 text-sm leading-relaxed whitespace-pre-wrap" data-testid={`text-edit-note-${edit.id}`}>
                        {edit.editNote}
                      </p>
                    )}
                    <p className="text-xs text-gray-500 mt-2" data-testid={`text-edit-datetime-${edit.id}`}>
                      {formatDateTime(edit.createdAt.toString())}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            <History className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p>No edit history yet</p>
            <p className="text-sm">Record your first edit!</p>
          </div>
        )}
      </div>
    </div>
  );
}
