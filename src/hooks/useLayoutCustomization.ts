import { useState, useEffect } from 'react';
import { useSettingsStore } from '../lib/settings';

export interface LayoutCard {
  id: string;
  name: string;
  visible: boolean;
  collapsed: boolean;
  position: { column: 1 | 2; row: number; span: 'full' | 'half' };
  defaultPosition: { column: 1 | 2; row: number; span: 'full' | 'half' };
}

const DEFAULT_LAYOUT_CONFIG: LayoutCard[] = [
  // Left Column Cards - Reordered: Current measurement → POI Selector → Vehicle map → Logging controls → Rest
  {
    id: 'measurement-cards',
    name: 'Measurement Cards',
    defaultPosition: { column: 1, row: 1, span: 'full' },
    visible: true,
    collapsed: false,
    position: { column: 1, row: 1, span: 'full' }
  },
  {
    id: 'poi-height-row',
    name: 'POI Selector & Height Settings',
    defaultPosition: { column: 1, row: 2, span: 'full' },
    visible: true,
    collapsed: false,
    position: { column: 1, row: 2, span: 'full' }
  },
  {
    id: 'route-map',
    name: 'Route Map',
    defaultPosition: { column: 1, row: 3, span: 'full' },
    visible: true,
    collapsed: false,
    position: { column: 1, row: 3, span: 'full' }
  },
  {
    id: 'logging-controls',
    name: 'Logging Controls',
    defaultPosition: { column: 1, row: 4, span: 'full' },
    visible: true,
    collapsed: false,
    position: { column: 1, row: 4, span: 'full' }
  },
  {
    id: 'measurement-log',
    name: 'Activity Log',
    defaultPosition: { column: 1, row: 5, span: 'full' },
    visible: true,
    collapsed: false,
    position: { column: 1, row: 5, span: 'full' }
  },
  {
    id: 'measurement-mode-selector',
    name: 'Measurement Mode',
    defaultPosition: { column: 1, row: 6, span: 'full' },
    visible: false,
    collapsed: false,
    position: { column: 1, row: 6, span: 'full' }
  },
  {
    id: 'survey-manager',
    name: 'Survey Manager',
    defaultPosition: { column: 1, row: 7, span: 'full' },
    visible: false,
    collapsed: false,
    position: { column: 1, row: 7, span: 'full' }
  },
  {
    id: 'gps-data',
    name: 'GPS Data',
    defaultPosition: { column: 1, row: 8, span: 'full' },
    visible: false,
    collapsed: false,
    position: { column: 1, row: 8, span: 'full' }
  },
  {
    id: 'gnss-status',
    name: 'GNSS Status',
    defaultPosition: { column: 1, row: 9, span: 'full' },
    visible: false,
    collapsed: false,
    position: { column: 1, row: 9, span: 'full' }
  },
  {
    id: 'road-profile',
    name: 'Road Profile',
    defaultPosition: { column: 1, row: 10, span: 'full' },
    visible: false,
    collapsed: false,
    position: { column: 1, row: 10, span: 'full' }
  },
  {
    id: 'lateral-width',
    name: 'Lateral Width',
    defaultPosition: { column: 1, row: 11, span: 'full' },
    visible: false,
    collapsed: false,
    position: { column: 1, row: 11, span: 'full' }
  },
  {
    id: 'rear-overhang',
    name: 'Rear Overhang',
    defaultPosition: { column: 1, row: 12, span: 'full' },
    visible: false,
    collapsed: false,
    position: { column: 1, row: 12, span: 'full' }
  },
  
  // Right Column Cards - Reordered: Live Camera → Captured Images → Timelapse → Settings tabs → Rest
  {
    id: 'live-camera',
    name: 'Live Camera',
    defaultPosition: { column: 2, row: 1, span: 'full' },
    visible: true,
    collapsed: false,
    position: { column: 2, row: 1, span: 'full' }
  },
  {
    id: 'captured-images',
    name: 'Captured Images',
    defaultPosition: { column: 2, row: 2, span: 'full' },
    visible: true,
    collapsed: false,
    position: { column: 2, row: 2, span: 'full' }
  },
  {
    id: 'timelapse',
    name: 'Timelapse',
    defaultPosition: { column: 2, row: 3, span: 'full' },
    visible: true,
    collapsed: false,
    position: { column: 2, row: 3, span: 'full' }
  },
  {
    id: 'settings-tabs',
    name: 'Settings Tabs',
    defaultPosition: { column: 2, row: 4, span: 'full' },
    visible: true,
    collapsed: false,
    position: { column: 2, row: 4, span: 'full' }
  },
  {
    id: 'measurement-controls',
    name: 'Measurement Controls',
    defaultPosition: { column: 2, row: 5, span: 'full' },
    visible: false,
    collapsed: false,
    position: { column: 2, row: 5, span: 'full' }
  }
];

// Layout version - increment this when adding/removing cards (not for full reset)
// v3: Added GNSS Status and Road Profile cards (migration: append new cards to existing layout)
const LAYOUT_VERSION = 3;

export const useLayoutCustomization = () => {
  const [layoutConfig, setLayoutConfig] = useState<LayoutCard[]>(() => {
    const savedVersion = localStorage.getItem('layout_version');
    const currentVersion = savedVersion ? parseInt(savedVersion) : 1;
    
    const saved = localStorage.getItem('layout_config');
    
    // Migration approach: merge existing user preferences with new default cards
    // This preserves user customizations while adding any new cards
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // Merge with default config to ensure all cards exist, preserving user settings
        const mergedConfig = DEFAULT_LAYOUT_CONFIG.map(defaultCard => {
          const savedCard = parsed.find((c: any) => c.id === defaultCard.id);
          return savedCard ? { ...defaultCard, ...savedCard } : defaultCard;
        });
        
        // Update version if changed (just tracking, no reset)
        if (currentVersion < LAYOUT_VERSION) {
          localStorage.setItem('layout_version', LAYOUT_VERSION.toString());
          // Save merged config to persist new cards
          localStorage.setItem('layout_config', JSON.stringify(mergedConfig));
        }
        
        return mergedConfig;
      } catch (error) {
        // Invalid JSON, fall back to defaults
      }
    }
    
    // No saved config, use defaults
    localStorage.setItem('layout_version', LAYOUT_VERSION.toString());
    return DEFAULT_LAYOUT_CONFIG;
  });

  const [leftColumnWidth, setLeftColumnWidth] = useState(() => {
    const saved = localStorage.getItem('left_column_width');
    return saved ? parseFloat(saved) : 50;
  });

  // Listen for layout changes from other hook instances
  useEffect(() => {
    const handleLayoutChange = () => {
      const saved = localStorage.getItem('layout_config');
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          const mergedConfig = DEFAULT_LAYOUT_CONFIG.map(defaultCard => {
            const savedCard = parsed.find((c: any) => c.id === defaultCard.id);
            return savedCard ? { ...defaultCard, ...savedCard } : defaultCard;
          });
          setLayoutConfig(mergedConfig);
        } catch (error) {
        }
      }
    };
    
    window.addEventListener('layout-config-changed', handleLayoutChange);
    return () => window.removeEventListener('layout-config-changed', handleLayoutChange);
  }, []);

  const saveLayout = (newCards: LayoutCard[]) => {
    setLayoutConfig(newCards);
    
    // Save to localStorage
    localStorage.setItem('layout_config', JSON.stringify(newCards));
    
    // Update store via setter which triggers debounced DB sync
    useSettingsStore.getState().setLayoutConfig(newCards);
    
    // Dispatch event to notify components
    window.dispatchEvent(new CustomEvent('layout-config-changed', { 
      detail: { cards: newCards }
    }));
  };

  const handleColumnResize = (newWidth: number) => {
    const clampedWidth = Math.max(25, Math.min(75, newWidth));
    setLeftColumnWidth(clampedWidth);
    useSettingsStore.getState().setUISettings({ leftColumnWidth: clampedWidth });
  };

  // Get cards for a specific column
  const getCardsForColumn = (column: 1 | 2) => {
    return layoutConfig
      .filter(card => card.visible && card.position.column === column)
      .sort((a, b) => a.position.row - b.position.row);
  };

  // Toggle card collapsed state
  const toggleCardCollapsed = (cardId: string) => {
    const updatedConfig = layoutConfig.map(card =>
      card.id === cardId
        ? { ...card, collapsed: !card.collapsed }
        : card
    );
    saveLayout(updatedConfig);
  };

  // Get card by ID
  const getCardById = (cardId: string) => {
    return layoutConfig.find(card => card.id === cardId);
  };

  return {
    layoutConfig,
    leftColumnWidth,
    saveLayout,
    handleColumnResize,
    setLeftColumnWidth: handleColumnResize,
    getCardsForColumn,
    toggleCardCollapsed,
    getCardById
  };
};