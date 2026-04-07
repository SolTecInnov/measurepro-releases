import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { MessageSquare, Send, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { apiRequest, queryClient } from '@/lib/queryClient';
import type { MarketingComment, InsertMarketingComment } from '../../../shared/schema';

interface CommentSectionProps {
  documentId: string;
}

export function CommentSection({ documentId }: CommentSectionProps) {
  const [authorName, setAuthorName] = useState('');
  const [commentText, setCommentText] = useState('');

  // Fetch comments
  const { data: comments, isLoading } = useQuery<{ success: boolean; comments: MarketingComment[] }>({
    queryKey: ['/api/marketing/comments', documentId],
    enabled: !!documentId,
  });

  // Create comment mutation
  const createCommentMutation = useMutation({
    mutationFn: async (data: InsertMarketingComment & { password: string }) => {
      const response = await apiRequest('/api/marketing/comments', {
        method: 'POST',
        body: JSON.stringify(data),
      });
      
      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Unauthorized - Invalid password');
        }
        throw new Error('Failed to add comment');
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/marketing/comments', documentId] });
      setAuthorName('');
      setCommentText('');
      // toast suppressed
    },
    onError: (error: Error) => {
      toast.error('Failed to add comment', {
        description: error.message,
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!authorName.trim()) {
      toast.error('Author name is required');
      return;
    }
    
    if (!commentText.trim()) {
      toast.error('Comment text is required');
      return;
    }

    const password = sessionStorage.getItem('marketingPassword');
    if (!password) {
      toast.error('Session expired - please refresh the page');
      return;
    }

    createCommentMutation.mutate({
      documentId,
      authorName: authorName.trim(),
      commentText: commentText.trim(),
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

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <MessageSquare className="w-5 h-5 text-purple-400" />
        <h3 className="text-lg font-semibold text-white">Comments</h3>
        {comments?.comments && (
          <span className="ml-auto text-sm text-gray-400">
            {comments.comments.length}
          </span>
        )}
      </div>

      {/* Comment Form */}
      <form onSubmit={handleSubmit} className="mb-6 space-y-3">
        <div>
          <input
            type="text"
            value={authorName}
            onChange={(e) => setAuthorName(e.target.value)}
            placeholder="Your name"
            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            data-testid="input-comment-author"
            disabled={createCommentMutation.isPending}
          />
        </div>
        <div>
          <textarea
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            placeholder="Add a comment..."
            rows={3}
            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
            data-testid="input-comment-text"
            disabled={createCommentMutation.isPending}
          />
        </div>
        <button
          type="submit"
          disabled={createCommentMutation.isPending || !authorName.trim() || !commentText.trim()}
          className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg font-medium hover:from-purple-600 hover:to-pink-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          data-testid="button-add-comment"
        >
          {createCommentMutation.isPending ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Adding...
            </>
          ) : (
            <>
              <Send className="w-4 h-4" />
              Add Comment
            </>
          )}
        </button>
      </form>

      {/* Comments List */}
      <div className="flex-1 overflow-y-auto space-y-3">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-purple-400" />
          </div>
        ) : comments?.comments && comments.comments.length > 0 ? (
          comments.comments.map((comment) => (
            <div
              key={comment.id}
              className="bg-gray-800/50 border border-gray-700 rounded-lg p-4"
              data-testid={`comment-${comment.id}`}
            >
              <div className="flex items-start justify-between mb-2">
                <span className="font-medium text-white" data-testid={`text-comment-author-${comment.id}`}>
                  {comment.authorName}
                </span>
                <span className="text-xs text-gray-500" data-testid={`text-comment-time-${comment.id}`}>
                  {formatDate(comment.createdAt.toString())}
                </span>
              </div>
              <p className="text-gray-300 text-sm leading-relaxed whitespace-pre-wrap" data-testid={`text-comment-text-${comment.id}`}>
                {comment.commentText}
              </p>
            </div>
          ))
        ) : (
          <div className="text-center py-8 text-gray-500">
            <MessageSquare className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p>No comments yet</p>
            <p className="text-sm">Be the first to comment!</p>
          </div>
        )}
      </div>
    </div>
  );
}
