import type { KeyboardShortcut } from '../keyboard';

/**
 * Programmatically trigger a keyboard shortcut
 * This allows voice commands to reuse existing keyboard shortcut handlers
 * instead of requiring duplicate callback systems
 */
export function triggerKeyboardShortcut(shortcut: KeyboardShortcut): void {
  const key = shortcut.key.toUpperCase();
  const code = /^[0-9]$/.test(key) ? `Digit${key}` : `Key${key}`;
  
  const event = new KeyboardEvent('keydown', {
    key: shortcut.key,
    code,
    ctrlKey: shortcut.ctrl || false,
    altKey: shortcut.alt || false,
    shiftKey: shortcut.shift || false,
    bubbles: true,
    cancelable: true
  });
  
  window.dispatchEvent(event);
}

/**
 * Helper function to trigger a shortcut by key combination
 */
export function triggerShortcutByKeys(key: string, modifiers?: {
  ctrl?: boolean;
  alt?: boolean;
  shift?: boolean;
}): void {
  triggerKeyboardShortcut({
    key,
    ctrl: modifiers?.ctrl,
    alt: modifiers?.alt,
    shift: modifiers?.shift,
    description: `${modifiers?.ctrl ? 'Ctrl+' : ''}${modifiers?.alt ? 'Alt+' : ''}${modifiers?.shift ? 'Shift+' : ''}${key}`
  });
}
