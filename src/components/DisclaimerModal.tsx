/**
 * DisclaimerModal — shown once on first launch, re-shown when disclaimer version changes
 * User must accept before using the app. Accepted = stored in localStorage.
 */
import React, { useState, useEffect } from 'react';
import { AlertTriangle, CheckSquare } from 'lucide-react';

const DISCLAIMER_VERSION = '2026-04-07-v1';
const STORAGE_KEY = 'disclaimer_accepted_version';

export function useDisclaimerAccepted() {
  const [accepted, setAccepted] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) === DISCLAIMER_VERSION;
    } catch { return false; }
  });

  const accept = () => {
    try { localStorage.setItem(STORAGE_KEY, DISCLAIMER_VERSION); } catch {}
    setAccepted(true);
  };

  return { accepted, accept };
}

interface DisclaimerModalProps {
  onAccept: () => void;
}

export function DisclaimerModal({ onAccept }: DisclaimerModalProps) {
  const [checked1, setChecked1] = useState(false);
  const [checked2, setChecked2] = useState(false);
  const [checked3, setChecked3] = useState(false);
  const [checked4, setChecked4] = useState(false);
  const allChecked = checked1 && checked2 && checked3 && checked4;

  const Check = ({ checked, onChange, label }: { checked: boolean; onChange: () => void; label: string }) => (
    <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer', marginBottom: 14 }}>
      <div
        onClick={onChange}
        style={{
          width: 20, height: 20, borderRadius: 4, flexShrink: 0, marginTop: 1,
          border: `2px solid ${checked ? '#FF6B2B' : '#2a3a4a'}`,
          background: checked ? '#FF6B2B' : 'transparent',
          display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
        }}
      >
        {checked && <span style={{ color: 'white', fontSize: 13, fontWeight: 700 }}>✓</span>}
      </div>
      <span style={{ color: '#C0C8D4', fontSize: 13, lineHeight: 1.5 }}>{label}</span>
    </label>
  );

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 10000,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
    }}>
      <div style={{
        background: '#0F1923', border: '1px solid #2a3a4a', borderRadius: 16,
        width: '100%', maxWidth: 560, maxHeight: '90vh', overflowY: 'auto',
        boxShadow: '0 24px 64px rgba(0,0,0,0.8)',
      }}>
        {/* Header */}
        <div style={{ padding: '24px 28px 16px', borderBottom: '1px solid #1e2f40' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <div style={{ background: 'rgba(255,107,43,0.15)', padding: 8, borderRadius: 10 }}>
              <AlertTriangle size={20} color="#FF6B2B" />
            </div>
            <div>
              <div style={{ color: '#E8ECF1', fontWeight: 700, fontSize: 18, fontFamily: 'DM Sans' }}>
                Terms of Use — MeasurePRO
              </div>
              <div style={{ color: '#8899AA', fontSize: 12 }}>Please read and accept before continuing</div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div style={{ padding: '20px 28px 8px' }}>
          <p style={{ color: '#8899AA', fontSize: 13, lineHeight: 1.6, marginBottom: 20 }}>
            By using MeasurePRO, you acknowledge and accept the following conditions.
            This notice will reappear only when terms are updated.
          </p>

          <Check
            checked={checked1}
            onChange={() => setChecked1(v => !v)}
            label="I understand that Soltec Innovation is not responsible for the accuracy of survey results. It is my responsibility to verify all measurements and maintain backup copies of my data in a separate location."
          />

          <Check
            checked={checked2}
            onChange={() => setChecked2(v => !v)}
            label="I understand that operating survey equipment, recording video, or using voice commands while driving may be illegal in my jurisdiction. I commit to operating this software safely and in compliance with all applicable laws."
          />

          <Check
            checked={checked3}
            onChange={() => setChecked3(v => !v)}
            label="I understand that using a remote control, Stream Deck, or other input device while operating a vehicle may be restricted or illegal. Voice commands do not replace my obligation to keep my eyes on the road at all times."
          />

          <Check
            checked={checked4}
            onChange={() => setChecked4(v => !v)}
            label="I understand that MeasurePRO is a professional tool that assists with data collection. It does not replace any legal obligations, permit requirements, or safety standards imposed on transport operations. I remain fully responsible for all permit compliance."
          />
        </div>

        {/* Footer */}
        <div style={{ padding: '16px 28px 24px', borderTop: '1px solid #1e2f40' }}>
          <button
            onClick={onAccept}
            disabled={!allChecked}
            style={{
              width: '100%', background: allChecked ? '#FF6B2B' : '#2a3a4a',
              border: 'none', color: allChecked ? 'white' : '#5a6a7a',
              borderRadius: 10, padding: '12px 0', cursor: allChecked ? 'pointer' : 'not-allowed',
              fontWeight: 700, fontSize: 15, fontFamily: 'DM Sans',
              transition: 'all 0.2s',
            }}>
            {allChecked ? 'I Accept — Continue to MeasurePRO' : 'Check all boxes to continue'}
          </button>
          <p style={{ color: '#5a6a7a', fontSize: 11, textAlign: 'center', marginTop: 10 }}>
            Your acceptance is recorded locally and will not be shared.
          </p>
        </div>
      </div>
    </div>
  );
}
