/**
 * Library Health Check
 * Validates that critical third-party libraries are loaded correctly before app initialization
 * 
 * NOTE: Since we now bundle Leaflet with esbuild (instead of loading from CDN),
 * we don't need to check for window.L anymore. Leaflet is imported as an ES module.
 */

export interface LibraryHealthStatus {
  healthy: boolean;
  missing: string[];
  details: string[];
}

export function checkLibraryHealth(): LibraryHealthStatus {
  const missing: string[] = [];
  const details: string[] = [];

  const healthy = missing.length === 0;

  if (!healthy) {
    console.error('Library health check FAILED:', { missing, details });
  } else {
    console.log('Library health check PASSED - All critical libraries loaded');
  }

  return { healthy, missing, details };
}

export function showLibraryErrorModal(status: LibraryHealthStatus): void {
  const errorHtml = `
    <div style="
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.95);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 999999;
      font-family: system-ui, -apple-system, sans-serif;
    ">
      <div style="
        background: #1e293b;
        color: #f1f5f9;
        padding: 2rem;
        border-radius: 0.75rem;
        max-width: 600px;
        width: 90%;
        box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5);
      ">
        <h1 style="
          color: #ef4444;
          font-size: 1.5rem;
          margin: 0 0 1rem 0;
          font-weight: 600;
        ">Critical Library Error</h1>
        
        <p style="margin: 0 0 1rem 0; color: #cbd5e1;">
          Some required libraries failed to load. This is often caused by cached old code.
        </p>
        
        <div style="
          background: #0f172a;
          padding: 1rem;
          border-radius: 0.5rem;
          margin: 1rem 0;
        ">
          <strong style="color: #f87171;">Missing Libraries:</strong>
          <ul style="margin: 0.5rem 0 0 1.5rem; padding: 0;">
            ${status.missing.map(lib => `<li style="color: #fca5a5; margin: 0.25rem 0;">${lib}</li>`).join('')}
          </ul>
        </div>
        
        <div style="
          background: #1e3a5f;
          border-left: 4px solid #3b82f6;
          padding: 1rem;
          margin: 1rem 0;
        ">
          <strong style="color: #93c5fd;">How to Fix:</strong>
          <ol style="margin: 0.5rem 0 0 1.5rem; padding: 0; color: #cbd5e1;">
            <li style="margin: 0.25rem 0;">Press <strong>Ctrl+Shift+R</strong> (or Cmd+Shift+R on Mac) to hard refresh</li>
            <li style="margin: 0.25rem 0;">If that doesn't work, clear your browser cache</li>
            <li style="margin: 0.25rem 0;">Try opening in an incognito/private window</li>
          </ol>
        </div>
        
        <button onclick="window.location.reload()" style="
          background: #3b82f6;
          color: white;
          border: none;
          padding: 0.75rem 1.5rem;
          border-radius: 0.5rem;
          cursor: pointer;
          font-size: 1rem;
          margin-top: 0.5rem;
        ">Reload Page</button>
      </div>
    </div>
  `;

  const container = document.createElement('div');
  container.innerHTML = errorHtml;
  document.body.appendChild(container);
}
