import { useState, useEffect, useCallback, useRef } from 'react';
import type { PoiEventRecord } from '../../shared/worker-types';

interface UsePaginatedMeasurementsOptions {
  surveyId: string | null;
  pageSize?: number;
}

interface PaginationState {
  records: PoiEventRecord[];
  currentPage: number;
  totalCount: number;
  hasMore: boolean;
  isLoading: boolean;
  error: string | null;
}

let paginatedWorker: Worker | null = null;

function getPaginatedWorker(): Worker {
  if (!paginatedWorker) {
    paginatedWorker = new Worker(
      new URL('../workers/paginated-loader.worker.ts', import.meta.url),
      { type: 'module' }
    );
  }
  return paginatedWorker;
}

export function usePaginatedMeasurements(options: UsePaginatedMeasurementsOptions) {
  const { surveyId, pageSize = 100 } = options;
  
  const [state, setState] = useState<PaginationState>({
    records: [],
    currentPage: 0,
    totalCount: 0,
    hasMore: false,
    isLoading: false,
    error: null
  });
  
  const workerRef = useRef<Worker | null>(null);
  const pendingRequestRef = useRef<string | null>(null);
  
  useEffect(() => {
    workerRef.current = getPaginatedWorker();
    
    return () => {
      // Don't terminate shared worker
    };
  }, []);
  
  const loadPage = useCallback((page: number) => {
    if (!surveyId || !workerRef.current) {
      setState(prev => ({ ...prev, records: [], isLoading: false }));
      return;
    }
    
    setState(prev => ({ ...prev, isLoading: true, error: null }));
    
    const requestId = `${surveyId}-${page}-${Date.now()}`;
    pendingRequestRef.current = requestId;
    
    const handleMessage = (event: MessageEvent) => {
      const response = event.data;
      
      // Ignore stale responses
      if (response.requestId !== requestId && !response.requestId?.startsWith(surveyId)) {
        return;
      }
      
      if (response.type === 'PAGE_LOADED') {
        // Only update if this is still the pending request
        if (pendingRequestRef.current === requestId || response.requestId.startsWith(surveyId)) {
          setState({
            records: response.records,
            currentPage: page,
            totalCount: response.totalCount,
            hasMore: response.hasMore,
            isLoading: false,
            error: null
          });
        }
      } else if (response.type === 'COUNT_RESPONSE' && response.surveyId === surveyId) {
        setState(prev => ({ ...prev, totalCount: response.totalCount }));
      }
    };
    
    workerRef.current.addEventListener('message', handleMessage);
    
    workerRef.current.postMessage({
      type: 'LOAD_PAGE',
      surveyId,
      pageSize,
      offset: page * pageSize
    });
    
    // Cleanup listener after response or timeout
    setTimeout(() => {
      workerRef.current?.removeEventListener('message', handleMessage);
    }, 5000);
  }, [surveyId, pageSize]);
  
  const nextPage = useCallback(() => {
    if (state.hasMore && !state.isLoading) {
      loadPage(state.currentPage + 1);
    }
  }, [state.hasMore, state.isLoading, state.currentPage, loadPage]);
  
  const prevPage = useCallback(() => {
    if (state.currentPage > 0 && !state.isLoading) {
      loadPage(state.currentPage - 1);
    }
  }, [state.currentPage, state.isLoading, loadPage]);
  
  const gotoPage = useCallback((page: number) => {
    if (page >= 0 && !state.isLoading) {
      loadPage(page);
    }
  }, [state.isLoading, loadPage]);
  
  const refresh = useCallback(() => {
    loadPage(state.currentPage);
  }, [state.currentPage, loadPage]);
  
  // Load initial page when surveyId changes
  useEffect(() => {
    if (surveyId) {
      loadPage(0);
    } else {
      setState({
        records: [],
        currentPage: 0,
        totalCount: 0,
        hasMore: false,
        isLoading: false,
        error: null
      });
    }
  }, [surveyId, loadPage]);
  
  // Request count update periodically
  useEffect(() => {
    if (!surveyId || !workerRef.current) return;
    
    const interval = setInterval(() => {
      workerRef.current?.postMessage({
        type: 'COUNT',
        surveyId
      });
    }, 5000);
    
    return () => clearInterval(interval);
  }, [surveyId]);
  
  return {
    ...state,
    nextPage,
    prevPage,
    gotoPage,
    refresh,
    totalPages: Math.ceil(state.totalCount / pageSize)
  };
}
