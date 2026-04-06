import { useState } from 'react';
import { Bot, Sparkles, LifeBuoy, Database, Search, Trash2, Image, Mic, X, ChevronRight, Clock, Key, CheckCircle } from 'lucide-react';
import type { AITrialStatus } from '../hooks/useAITrial';

interface Props {
  trialStatus: AITrialStatus;
  onClose: () => void;
}

const FEATURES = [
  {
    icon: <Database className="w-5 h-5 text-blue-400" />,
    title: 'Survey & POI Intelligence',
    desc: 'Ask questions about your active survey, find POIs, bulk-update fields, filter by type or road — all in plain language.',
  },
  {
    icon: <Search className="w-5 h-5 text-purple-400" />,
    title: 'Smart Search & Filter',
    desc: 'Search across all your measurements, distances, and notes. Ask "show all POIs on Hwy 16 above 5m" and get instant results.',
  },
  {
    icon: <Trash2 className="w-5 h-5 text-orange-400" />,
    title: 'Bulk Operations',
    desc: 'Merge duplicates, delete incomplete POIs, batch-update statuses — with a full preview before any change is applied.',
  },
  {
    icon: <Image className="w-5 h-5 text-green-400" />,
    title: 'Photo & Measurement Analysis',
    desc: 'Attach a photo from a POI and ask the AI to identify clearance issues, structural risks, or just describe what it sees.',
  },
  {
    icon: <LifeBuoy className="w-5 h-5 text-cyan-400" />,
    title: 'Support Ticket Integration',
    desc: 'Ask the AI to search the help centre or open a support ticket on your behalf — right from the chat window. The Tools menu also has a direct "Submit Support Ticket" button that\'s always available, even without the AI.',
  },
  {
    icon: <Mic className="w-5 h-5 text-red-400" />,
    title: 'Voice Commands',
    desc: 'Combine with the built-in voice system to capture measurements, create POIs, and interact hands-free in the cab.',
  },
];

const AIWelcomeDialog = ({ trialStatus, onClose }: Props) => {
  const [page, setPage] = useState<'welcome' | 'features' | 'ticket'>('welcome');
  const pct = trialStatus.inTrial
    ? Math.round(((trialStatus.trialDuration - trialStatus.daysRemaining) / trialStatus.trialDuration) * 100)
    : 100;

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] flex flex-col overflow-hidden">

        {/* Header */}
        <div className="relative bg-gradient-to-br from-emerald-900/60 via-blue-900/40 to-gray-900 px-6 pt-6 pb-5 flex-shrink-0">
          <button onClick={onClose} className="absolute top-4 right-4 p-1.5 rounded-lg hover:bg-gray-700 text-gray-400 hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-3 mb-3">
            <div className="w-11 h-11 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center">
              <Bot className="w-6 h-6 text-emerald-400" />
            </div>
            <div>
              <h2 className="text-white font-bold text-lg leading-tight">MeasurePRO AI Assistant</h2>
              <p className="text-emerald-400 text-xs font-medium">Powered by GPT-4o</p>
            </div>
          </div>

          {trialStatus.inTrial && trialStatus.hasTrialKey ? (
            <div className="bg-emerald-900/30 border border-emerald-700/40 rounded-xl px-4 py-3">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-emerald-400" />
                  <span className="text-emerald-300 text-sm font-semibold">Free Trial Active</span>
                </div>
                <span className="text-white font-bold text-sm">
                  {trialStatus.daysRemaining} <span className="text-gray-400 font-normal">days left</span>
                </span>
              </div>
              <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-emerald-500 to-blue-500 rounded-full transition-all"
                  style={{ width: `${100 - pct}%` }}
                />
              </div>
              <p className="text-xs text-gray-400 mt-2">
                Your team's AI access is complimentary for {trialStatus.trialDuration} days. After that, each user can add their own OpenAI API key to continue.
              </p>
            </div>
          ) : !trialStatus.inTrial ? (
            <div className="bg-amber-900/30 border border-amber-700/40 rounded-xl px-4 py-3 flex items-start gap-3">
              <Clock className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-amber-300 text-sm font-semibold">Trial period ended</p>
                <p className="text-xs text-amber-400/80 mt-0.5">Add your own OpenAI API key in Settings → AI Assistant to keep using the assistant.</p>
              </div>
            </div>
          ) : (
            <div className="bg-blue-900/30 border border-blue-700/40 rounded-xl px-4 py-3 flex items-start gap-3">
              <Key className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-blue-300">Add your OpenAI API key in Settings → AI Assistant to activate the assistant.</p>
            </div>
          )}
        </div>

        {/* Tab nav */}
        <div className="flex border-b border-gray-700 flex-shrink-0">
          {(['welcome', 'features', 'ticket'] as const).map((tab) => {
            const labels = { welcome: 'Getting Started', features: 'What It Can Do', ticket: 'Support Tickets' };
            return (
              <button
                key={tab}
                onClick={() => setPage(tab)}
                className={`flex-1 py-2.5 text-xs font-medium transition-colors ${
                  page === tab
                    ? 'text-white border-b-2 border-emerald-500 -mb-px'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                {labels[tab]}
              </button>
            );
          })}
        </div>

        {/* Content */}
        <div className="overflow-y-auto flex-1 px-6 py-5">

          {page === 'welcome' && (
            <div className="space-y-4">
              <p className="text-gray-300 text-sm leading-relaxed">
                The AI Assistant is built directly into MeasurePRO. Access it any time from <strong className="text-white">Tools → AI Assistant</strong>. It understands your surveys, POIs, and measurements — and can take action on your behalf.
              </p>
              <div className="space-y-3">
                {[
                  'Ask plain-language questions about your active survey',
                  'Bulk-update, merge or delete POIs with a preview first',
                  'Analyse clearance photos and identify risks',
                  'Search your help centre and submit support tickets',
                ].map((item, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                    <span className="text-sm text-gray-300">{item}</span>
                  </div>
                ))}
              </div>
              <div className="bg-gray-800/60 border border-gray-700 rounded-lg px-4 py-3">
                <p className="text-xs text-gray-400 leading-relaxed">
                  <span className="text-white font-medium">Tip:</span> The AI always shows you a preview of any changes before applying them — you stay in full control.
                </p>
              </div>
              <button
                onClick={() => setPage('features')}
                className="w-full flex items-center justify-center gap-2 py-2.5 bg-emerald-600 hover:bg-emerald-500 rounded-lg text-sm font-medium transition-colors"
              >
                See what it can do <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {page === 'features' && (
            <div className="space-y-3">
              {FEATURES.map((f, i) => (
                <div key={i} className="flex gap-3 bg-gray-800/50 border border-gray-700/60 rounded-lg px-4 py-3">
                  <div className="flex-shrink-0 mt-0.5">{f.icon}</div>
                  <div>
                    <p className="text-sm font-medium text-white mb-0.5">{f.title}</p>
                    <p className="text-xs text-gray-400 leading-relaxed">{f.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {page === 'ticket' && (
            <div className="space-y-4">
              <div className="flex items-start gap-3 bg-blue-900/20 border border-blue-700/30 rounded-lg px-4 py-3">
                <LifeBuoy className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-white mb-1">Two ways to get support</p>
                  <p className="text-xs text-gray-400 leading-relaxed">You can submit a support ticket directly — with or without the AI assistant.</p>
                </div>
              </div>

              <div className="space-y-3">
                <div className="bg-gray-800/60 border border-gray-700 rounded-lg px-4 py-3">
                  <p className="text-sm font-semibold text-emerald-400 mb-1">Via AI Assistant</p>
                  <p className="text-xs text-gray-400 leading-relaxed">
                    Open the AI Assistant from <strong className="text-white">Tools → AI Assistant</strong> and say <em className="text-gray-300">"I need help with..."</em> or <em className="text-gray-300">"Create a support ticket about..."</em>. The AI will gather details and submit a ticket automatically, including your session info.
                  </p>
                </div>
                <div className="bg-gray-800/60 border border-gray-700 rounded-lg px-4 py-3">
                  <p className="text-sm font-semibold text-blue-400 mb-1">Via Tools Menu (always available)</p>
                  <p className="text-xs text-gray-400 leading-relaxed">
                    Click <strong className="text-white">Tools → Submit Support Ticket</strong> at any time. The form pre-fills your name and email, lets you add your phone number, and automatically attaches your browser, OS, screen info, and the current app URL so our team can reproduce the issue fast.
                  </p>
                </div>
              </div>

              <div className="bg-gray-800/50 rounded-lg px-4 py-3">
                <p className="text-xs text-gray-400">Our team typically responds within 24 hours. Urgent tickets are flagged for same-day response.</p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-700 flex-shrink-0 flex items-center justify-between">
          <p className="text-xs text-gray-500">MeasurePRO · AI Assistant</p>
          <button
            onClick={onClose}
            className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-lg text-sm font-medium transition-colors"
            data-testid="button-close-ai-welcome"
          >
            Get Started
          </button>
        </div>
      </div>
    </div>
  );
};

export default AIWelcomeDialog;
