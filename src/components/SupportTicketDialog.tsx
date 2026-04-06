import React, { useState, useEffect } from 'react';
import { X, LifeBuoy, Send, Loader2, CheckCircle, AlertCircle, ChevronDown } from 'lucide-react';
import { toast } from 'sonner';
import { getCurrentUser } from '../lib/firebase';
import { useSettingsStore } from '../lib/settings';
import { useSurveyStore } from '../lib/survey';

interface Props {
  onClose: () => void;
}

type Priority = 'low' | 'normal' | 'high' | 'urgent';

function getBrowserInfo(): string {
  const ua = navigator.userAgent;
  let browser = 'Unknown browser';
  if (ua.includes('Chrome') && !ua.includes('Edg')) browser = `Chrome ${ua.match(/Chrome\/([\d.]+)/)?.[1] ?? ''}`;
  else if (ua.includes('Firefox')) browser = `Firefox ${ua.match(/Firefox\/([\d.]+)/)?.[1] ?? ''}`;
  else if (ua.includes('Safari') && !ua.includes('Chrome')) browser = `Safari ${ua.match(/Version\/([\d.]+)/)?.[1] ?? ''}`;
  else if (ua.includes('Edg')) browser = `Edge ${ua.match(/Edg\/([\d.]+)/)?.[1] ?? ''}`;

  let os = 'Unknown OS';
  if (ua.includes('Windows NT 10')) os = 'Windows 10/11';
  else if (ua.includes('Windows')) os = 'Windows';
  else if (ua.includes('Mac OS X')) os = `macOS ${ua.match(/Mac OS X ([\d_]+)/)?.[1]?.replace(/_/g, '.') ?? ''}`;
  else if (ua.includes('iPad')) os = 'iPadOS';
  else if (ua.includes('iPhone')) os = 'iOS';
  else if (ua.includes('Android')) os = `Android ${ua.match(/Android ([\d.]+)/)?.[1] ?? ''}`;
  else if (ua.includes('Linux')) os = 'Linux';

  const screen = `${window.screen.width}×${window.screen.height} (${Math.round(window.devicePixelRatio * 100) / 100}x DPR)`;
  return `OS: ${os} | Browser: ${browser.trim()} | Screen: ${screen}`;
}

const PRIORITIES: { value: Priority; label: string; color: string }[] = [
  { value: 'low', label: 'Low — general question', color: 'text-gray-400' },
  { value: 'normal', label: 'Normal — something not working', color: 'text-blue-400' },
  { value: 'high', label: 'High — blocking my work', color: 'text-orange-400' },
  { value: 'urgent', label: 'Urgent — critical / data at risk', color: 'text-red-400' },
];

const SupportTicketDialog: React.FC<Props> = ({ onClose }) => {
  const user = getCurrentUser();
  const { aiAssistantSettings } = useSettingsStore();
  const { activeSurvey } = useSurveyStore();

  const isConfigured = !!(
    aiAssistantSettings?.zendeskSubdomain?.trim() &&
    aiAssistantSettings?.zendeskEmail?.trim() &&
    aiAssistantSettings?.zendeskApiToken?.trim()
  );

  const [name, setName] = useState(user?.displayName ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [phone, setPhone] = useState('');
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<Priority>('normal');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [ticketId, setTicketId] = useState<number | null>(null);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  const buildDescription = () => {
    const lines: string[] = [];
    lines.push(description.trim());
    lines.push('');
    lines.push('─────────────────────────────');
    lines.push('SUBMITTED BY');
    lines.push(`Name: ${name.trim() || '(not provided)'}`);
    lines.push(`Email: ${email.trim() || '(not provided)'}`);
    if (phone.trim()) lines.push(`Phone/Cell: ${phone.trim()}`);
    lines.push('');
    lines.push('ENVIRONMENT');
    lines.push(getBrowserInfo());
    lines.push(`App URL: ${window.location.href}`);
    if (activeSurvey) {
      lines.push(`Active survey: ${activeSurvey.name ?? activeSurvey.id}`);
    }
    lines.push(`Submitted: ${new Date().toLocaleString()}`);
    return lines.join('\n');
  };

  const handleSubmit = async () => {
    if (!subject.trim()) { toast.error('Please enter a subject'); return; }
    if (!description.trim()) { toast.error('Please describe your issue'); return; }
    if (!email.trim()) { toast.error('Please enter your email so we can reply'); return; }

    setIsSubmitting(true);
    try {
      const response = await fetch('/api/zendesk/ticket', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subdomain: aiAssistantSettings!.zendeskSubdomain,
          email: aiAssistantSettings!.zendeskEmail,
          token: aiAssistantSettings!.zendeskApiToken,
          subject: subject.trim(),
          description: buildDescription(),
          priority,
          requesterEmail: email.trim(),
          requesterName: name.trim() || email.trim(),
        }),
      });
      const data = await response.json() as { success: boolean; ticket?: { id: number }; error?: string };
      if (data.success) {
        setTicketId(data.ticket?.id ?? null);
        setSubmitted(true);
      } else {
        toast.error(`Failed to submit ticket: ${data.error ?? 'Unknown error'}`, { duration: 10000 });
      }
    } catch (err: any) {
      toast.error(`Submission failed: ${err.message ?? 'Network error'}`, { duration: 10000 });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-gray-900 border border-gray-700 rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-700 flex-shrink-0">
          <LifeBuoy className="w-5 h-5 text-blue-400 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <h2 className="text-white font-semibold text-sm leading-tight">Submit a Support Ticket</h2>
            <p className="text-gray-400 text-xs mt-0.5">Our team typically responds within 24 hours</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-700 text-gray-400 hover:text-white transition-colors" data-testid="button-close-ticket-dialog">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-4">

          {/* Not configured */}
          {!isConfigured && (
            <div className="flex items-start gap-3 bg-amber-900/20 border border-amber-700/40 rounded-lg p-4">
              <AlertCircle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm text-amber-300 font-medium">Support portal not yet connected</p>
                <p className="text-xs text-amber-400/80 mt-1">
                  An administrator needs to configure the Zendesk integration in Settings → AI Assistant before tickets can be submitted. In the meantime, email us directly at <a href="mailto:support@soltec.ca" className="underline">support@soltec.ca</a>.
                </p>
              </div>
            </div>
          )}

          {/* Success state */}
          {submitted ? (
            <div className="flex flex-col items-center gap-4 py-8 text-center">
              <div className="w-14 h-14 rounded-full bg-green-500/20 flex items-center justify-center">
                <CheckCircle className="w-8 h-8 text-green-400" />
              </div>
              <div>
                <p className="text-white font-semibold">Ticket submitted!</p>
                {ticketId && <p className="text-gray-400 text-sm mt-1">Ticket #{ticketId}</p>}
                <p className="text-gray-400 text-sm mt-2">We'll reply to <span className="text-white">{email}</span> as soon as possible.</p>
              </div>
              <button onClick={onClose} className="px-5 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm font-medium transition-colors" data-testid="button-close-after-submit">
                Close
              </button>
            </div>
          ) : (
            <>
              {/* Your info */}
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wide font-medium mb-2">Your information</p>
                <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">Full Name</label>
                      <input
                        type="text"
                        value={name}
                        onChange={e => setName(e.target.value)}
                        placeholder="Your name"
                        className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-white"
                        data-testid="input-ticket-name"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">Phone / Cell</label>
                      <input
                        type="tel"
                        value={phone}
                        onChange={e => setPhone(e.target.value)}
                        placeholder="+1 (555) 000-0000"
                        className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-white"
                        data-testid="input-ticket-phone"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Email <span className="text-red-400">*</span></label>
                    <input
                      type="email"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      placeholder="your@email.com"
                      className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-white"
                      data-testid="input-ticket-email"
                    />
                  </div>
                </div>
              </div>

              {/* Issue */}
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wide font-medium mb-2">Issue details</p>
                <div className="space-y-2">
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Subject <span className="text-red-400">*</span></label>
                    <input
                      type="text"
                      value={subject}
                      onChange={e => setSubject(e.target.value)}
                      placeholder="Brief summary of the issue"
                      className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-white"
                      data-testid="input-ticket-subject"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Description <span className="text-red-400">*</span></label>
                    <textarea
                      value={description}
                      onChange={e => setDescription(e.target.value)}
                      placeholder="Describe the issue in detail — what happened, what you expected, and any steps to reproduce it."
                      rows={5}
                      className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-white resize-none"
                      data-testid="input-ticket-description"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Priority</label>
                    <div className="relative">
                      <select
                        value={priority}
                        onChange={e => setPriority(e.target.value as Priority)}
                        className="w-full appearance-none px-3 py-2 pr-8 bg-gray-800 border border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-white"
                        data-testid="select-ticket-priority"
                      >
                        {PRIORITIES.map(p => (
                          <option key={p.value} value={p.value}>{p.label}</option>
                        ))}
                      </select>
                      <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Auto-info notice */}
              <div className="bg-gray-800/60 border border-gray-700 rounded-lg px-3 py-2.5">
                <p className="text-xs text-gray-400 leading-relaxed">
                  <span className="text-gray-300 font-medium">Automatically included:</span> your browser, OS, screen resolution, and current app URL — so our team can reproduce the issue faster.
                </p>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        {!submitted && (
          <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-gray-700 flex-shrink-0">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
              data-testid="button-cancel-ticket"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={isSubmitting || !isConfigured}
              className="flex items-center gap-2 px-5 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:text-gray-500 disabled:cursor-not-allowed rounded-lg text-sm font-medium transition-colors"
              data-testid="button-submit-ticket"
            >
              {isSubmitting ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Submitting...</>
              ) : (
                <><Send className="w-4 h-4" /> Submit Ticket</>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default SupportTicketDialog;
