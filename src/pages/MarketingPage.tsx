import { useState, useEffect } from 'react';
import { Video, Calendar, BookOpen, Mail, Users, Camera, Presentation, MessageSquare, ListChecks, HelpCircle, Play, ChevronRight, ArrowLeft, Printer, X, Mic } from 'lucide-react';
import { MarketingPasswordGate } from '../components/MarketingPasswordGate';
import { CommentSection } from '../components/marketing/CommentSection';
import DOMPurify from 'dompurify';
import { EditHistory } from '../components/marketing/EditHistory';

interface Document {
  id: string;
  title: string;
  description: string;
  fileName: string;
  icon: JSX.Element;
  category: 'video' | 'sales' | 'training' | 'support' | 'podcasts';
  color: string;
}

const documents: Document[] = [
  {
    id: 'vlog-script',
    title: 'Vlog Discussion Script',
    description: 'Engaging vlog content and discussion points for authentic product storytelling',
    fileName: 'VLOG_DISCUSSION_SCRIPT.md',
    icon: <MessageSquare className="w-6 h-6" />,
    category: 'video',
    color: 'from-purple-500 to-pink-500'
  },
  {
    id: 'promo-video',
    title: 'Promotional Video Script',
    description: 'Complete production-ready script with shot breakdowns and voiceover timing',
    fileName: 'PROMOTIONAL_VIDEO_SCRIPT.md',
    icon: <Video className="w-6 h-6" />,
    category: 'video',
    color: 'from-blue-500 to-cyan-500'
  },
  {
    id: 'broll-shots',
    title: 'B-Roll Shot List',
    description: 'Comprehensive list of supplementary footage for video production',
    fileName: 'BROLL_SHOT_LIST.md',
    icon: <Camera className="w-6 h-6" />,
    category: 'video',
    color: 'from-indigo-500 to-purple-500'
  },
  {
    id: 'shot-cards',
    title: 'Shot Card Templates',
    description: 'Professional shot cards for organized film production planning',
    fileName: 'SHOT_CARD_TEMPLATE.md',
    icon: <ListChecks className="w-6 h-6" />,
    category: 'video',
    color: 'from-violet-500 to-fuchsia-500'
  },
  {
    id: 'production-guide',
    title: 'Master Production Guide',
    description: 'Complete guide to producing professional MeasurePRO marketing materials',
    fileName: 'MASTER_PRODUCTION_GUIDE.md',
    icon: <Play className="w-6 h-6" />,
    category: 'video',
    color: 'from-pink-500 to-rose-500'
  },
  {
    id: 'social-calendar',
    title: 'Social Media Content Calendar',
    description: '3-month social media strategy with posts, themes, and engagement tactics',
    fileName: 'SOCIAL_MEDIA_CONTENT_CALENDAR.md',
    icon: <Calendar className="w-6 h-6" />,
    category: 'sales',
    color: 'from-green-500 to-emerald-500'
  },
  {
    id: 'sales-deck',
    title: 'Sales Presentation Deck',
    description: 'Persuasive sales presentation with ROI calculations and customer stories',
    fileName: 'SALES_PRESENTATION_DECK.md',
    icon: <Presentation className="w-6 h-6" />,
    category: 'sales',
    color: 'from-orange-500 to-amber-500'
  },
  {
    id: 'email-templates',
    title: 'Email Templates',
    description: 'Professional email templates for customer outreach and support',
    fileName: 'EMAIL_TEMPLATES.md',
    icon: <Mail className="w-6 h-6" />,
    category: 'sales',
    color: 'from-teal-500 to-cyan-500'
  },
  {
    id: 'admin-training',
    title: 'Admin Training Manual',
    description: 'Comprehensive training for administrators and power users',
    fileName: 'ADMIN_TRAINING_MANUAL.md',
    icon: <Users className="w-6 h-6" />,
    category: 'training',
    color: 'from-blue-500 to-indigo-500'
  },
  {
    id: 'user-manual',
    title: 'User Manual Slides',
    description: 'Visual slide-based user manual for easy learning',
    fileName: 'USER_MANUAL_SLIDES.md',
    icon: <BookOpen className="w-6 h-6" />,
    category: 'training',
    color: 'from-cyan-500 to-blue-500'
  },
  {
    id: 'quick-start',
    title: 'Quick Start Guide',
    description: 'Get users up and running in minutes with this concise guide',
    fileName: 'QUICK_START_GUIDE.md',
    icon: <ChevronRight className="w-6 h-6" />,
    category: 'training',
    color: 'from-emerald-500 to-teal-500'
  },
  {
    id: 'troubleshooting',
    title: 'Troubleshooting Flowcharts',
    description: 'Visual flowcharts to diagnose and resolve common issues',
    fileName: 'TROUBLESHOOTING_FLOWCHARTS.md',
    icon: <ListChecks className="w-6 h-6" />,
    category: 'support',
    color: 'from-red-500 to-orange-500'
  },
  {
    id: 'faq',
    title: 'Frequently Asked Questions',
    description: 'Answers to the most common customer questions',
    fileName: 'FAQ.md',
    icon: <HelpCircle className="w-6 h-6" />,
    category: 'support',
    color: 'from-yellow-500 to-orange-500'
  },
  {
    id: 'podcast-ep01',
    title: 'Podcast Episode 1: Introduction to MeasurePRO',
    description: '30-minute introduction covering the revolution in field surveying and core platform capabilities',
    fileName: 'PODCAST_EP01_INTRODUCTION.md',
    icon: <Mic className="w-6 h-6" />,
    category: 'podcasts',
    color: 'from-purple-500 to-indigo-500'
  },
  {
    id: 'podcast-ep02',
    title: 'Podcast Episode 2: Technical Deep Dive',
    description: 'Technical exploration of AI, GPS, laser integration, and offline-first architecture',
    fileName: 'PODCAST_EP02_TECHNICAL.md',
    icon: <Mic className="w-6 h-6" />,
    category: 'podcasts',
    color: 'from-blue-500 to-purple-500'
  },
  {
    id: 'podcast-ep03',
    title: 'Podcast Episode 3: Premium Features',
    description: 'Comprehensive overview of MeasurePRO+, Convoy Guardian, and Route Enforcement systems',
    fileName: 'PODCAST_EP03_PREMIUM.md',
    icon: <Mic className="w-6 h-6" />,
    category: 'podcasts',
    color: 'from-indigo-500 to-cyan-500'
  },
  {
    id: 'podcast-ep04',
    title: 'Podcast Episode 4: Success Stories (Dual Speakers)',
    description: 'Real-world customer applications across transportation, utilities, and infrastructure',
    fileName: 'PODCAST_EP04_SUCCESS_STORIES.md',
    icon: <Mic className="w-6 h-6" />,
    category: 'podcasts',
    color: 'from-cyan-500 to-teal-500'
  },
  {
    id: 'podcast-ep05',
    title: 'Podcast Episode 5: The Future',
    description: 'Exploring the future of field data collection and industry transformation',
    fileName: 'PODCAST_EP05_FUTURE.md',
    icon: <Mic className="w-6 h-6" />,
    category: 'podcasts',
    color: 'from-teal-500 to-green-500'
  }
];

const MarketingPageContent = () => {
  const [selectedDoc, setSelectedDoc] = useState<Document | null>(null);
  const [content, setContent] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [printOrientation, setPrintOrientation] = useState<'portrait' | 'landscape'>('portrait');
  const [showCollabSidebar, setShowCollabSidebar] = useState(false);

  // ESC key handler to close sidebar
  useEffect(() => {
    const handleEscKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && showCollabSidebar) {
        setShowCollabSidebar(false);
      }
    };

    document.addEventListener('keydown', handleEscKey);
    return () => {
      document.removeEventListener('keydown', handleEscKey);
    };
  }, [showCollabSidebar]);

  const categories = [
    { id: 'all', label: 'All Documents', count: documents.length },
    { id: 'video', label: 'Video Production', count: documents.filter(d => d.category === 'video').length },
    { id: 'sales', label: 'Sales & Marketing', count: documents.filter(d => d.category === 'sales').length },
    { id: 'training', label: 'Training', count: documents.filter(d => d.category === 'training').length },
    { id: 'support', label: 'Support', count: documents.filter(d => d.category === 'support').length },
    { id: 'podcasts', label: 'Podcasts', count: documents.filter(d => d.category === 'podcasts').length }
  ];

  const filteredDocs = selectedCategory === 'all' 
    ? documents 
    : documents.filter(d => d.category === selectedCategory);

  const loadDocument = async (doc: Document) => {
    setLoading(true);
    setSelectedDoc(doc);
    try {
      const response = await fetch(`/docs/${doc.fileName}`);
      if (!response.ok) throw new Error('Failed to load document');
      const text = await response.text();
      setContent(text);
    } catch (error) {
      setContent('# Error\n\nFailed to load document. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    // Remove any existing print style injection
    const existingStyle = document.getElementById('dynamic-print-orientation');
    if (existingStyle) {
      existingStyle.remove();
    }

    // Dynamically inject @page rule for selected orientation
    const styleElement = document.createElement('style');
    styleElement.id = 'dynamic-print-orientation';
    styleElement.media = 'print';
    styleElement.textContent = `
      @page {
        size: letter ${printOrientation};
        margin: 0.5in;
      }
    `;
    document.head.appendChild(styleElement);

    // Trigger print after a short delay to ensure styles are applied
    setTimeout(() => {
      window.print();
    }, 100);
  };

  if (selectedDoc) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-gray-900/95 backdrop-blur-sm border-b border-gray-700 no-print">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
            <button
              onClick={() => setSelectedDoc(null)}
              className="flex items-center gap-2 text-gray-300 hover:text-white transition-colors group"
              data-testid="button-back"
            >
              <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
              <span>Back to Documents</span>
            </button>

            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowCollabSidebar(!showCollabSidebar)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
                  showCollabSidebar
                    ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white'
                    : 'bg-purple-500/10 border border-purple-500/50 text-purple-400 hover:bg-purple-500/20'
                }`}
                data-testid="button-toggle-collaboration"
              >
                <MessageSquare className="w-4 h-4" />
                <span>Collaborate</span>
              </button>

              <select
                value={printOrientation}
                onChange={(e) => setPrintOrientation(e.target.value as 'portrait' | 'landscape')}
                className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                data-testid="select-print-orientation"
              >
                <option value="portrait">Portrait</option>
                <option value="landscape">Landscape</option>
              </select>

              <button
                onClick={handlePrint}
                className="flex items-center gap-2 px-4 py-2 bg-green-500/10 border border-green-500/50 text-green-400 hover:bg-green-500/20 rounded-lg transition-colors"
                data-testid="button-print"
              >
                <Printer className="w-4 h-4" />
                <span>Print</span>
              </button>
            </div>
          </div>
        </div>

        {/* Document Content */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className={`bg-gradient-to-br ${selectedDoc.color} p-1 rounded-2xl mb-8`}>
            <div className="bg-gray-900 rounded-xl p-8">
              <div className="flex items-start gap-4 mb-6">
                <div className={`bg-gradient-to-br ${selectedDoc.color} p-3 rounded-xl`}>
                  {selectedDoc.icon}
                </div>
                <div className="flex-1">
                  <h1 className="text-3xl font-bold text-white mb-2">{selectedDoc.title}</h1>
                  <p className="text-gray-400">{selectedDoc.description}</p>
                </div>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
            </div>
          ) : (
            <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-8 border border-gray-700">
              <div 
                className="prose prose-invert prose-lg max-w-none
                  prose-headings:text-white prose-headings:font-bold
                  prose-h1:text-4xl prose-h1:mb-6 prose-h1:pb-4 prose-h1:border-b prose-h1:border-gray-700
                  prose-h2:text-2xl prose-h2:mt-8 prose-h2:mb-4 prose-h2:text-blue-400
                  prose-h3:text-xl prose-h3:mt-6 prose-h3:mb-3 prose-h3:text-cyan-400
                  prose-p:text-gray-300 prose-p:leading-relaxed
                  prose-a:text-blue-400 prose-a:no-underline hover:prose-a:text-blue-300
                  prose-strong:text-white prose-strong:font-semibold
                  prose-ul:text-gray-300 prose-ol:text-gray-300
                  prose-li:my-2
                  prose-code:text-pink-400 prose-code:bg-gray-900 prose-code:px-2 prose-code:py-1 prose-code:rounded
                  prose-pre:bg-gray-900 prose-pre:border prose-pre:border-gray-700
                  prose-blockquote:border-l-4 prose-blockquote:border-blue-500 prose-blockquote:bg-gray-900/50 prose-blockquote:py-2 prose-blockquote:px-4"
                dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(renderMarkdown(content)) }}
              />
            </div>
          )}
        </div>

        {/* Collaboration Sidebar */}
        <div
          className={`fixed top-0 right-0 h-full w-full sm:w-96 bg-gray-900 border-l border-gray-700 transform transition-transform duration-300 ease-in-out z-50 no-print ${
            showCollabSidebar ? 'translate-x-0' : 'translate-x-full'
          }`}
          data-testid="collaboration-sidebar"
        >
          <div className="flex flex-col h-full">
            {/* Sidebar Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-700 bg-gray-800">
              <h2 className="text-lg font-bold text-white">Team Collaboration</h2>
              <button
                onClick={() => setShowCollabSidebar(false)}
                className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
                data-testid="button-close-sidebar"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Sidebar Content */}
            <div className="flex-1 overflow-y-auto p-4 space-y-6">
              {/* Comments Section */}
              <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700">
                <CommentSection
                  documentId={selectedDoc.id}
                />
              </div>

              {/* Divider */}
              <div className="border-t border-gray-700"></div>

              {/* Edit History Section */}
              <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700">
                <EditHistory
                  documentId={selectedDoc.id}
                  documentTitle={selectedDoc.title}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Overlay for mobile */}
        {showCollabSidebar && (
          <div
            className="fixed inset-0 bg-black/50 z-40 sm:hidden no-print"
            onClick={() => setShowCollabSidebar(false)}
            data-testid="sidebar-overlay"
          ></div>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-600/10 via-purple-600/10 to-pink-600/10"></div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
          <div className="text-center">
            <h1 className="text-5xl sm:text-6xl font-bold text-white mb-6">
              Marketing & Training
              <span className="block text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400">
                Resource Center
              </span>
            </h1>
            <p className="text-xl text-gray-300 max-w-3xl mx-auto mb-8">
              Professional video scripts, sales materials, training guides, and support documentation 
              to help you market and master MeasurePRO
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-lg px-6 py-3">
                <div className="text-3xl font-bold text-blue-400">{documents.length}</div>
                <div className="text-sm text-gray-400">Documents</div>
              </div>
              <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-lg px-6 py-3">
                <div className="text-3xl font-bold text-purple-400">4</div>
                <div className="text-sm text-gray-400">Categories</div>
              </div>
              <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-lg px-6 py-3">
                <div className="text-3xl font-bold text-pink-400">100%</div>
                <div className="text-sm text-gray-400">Professional</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Category Filter */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-8">
        <div className="flex flex-wrap justify-center gap-3">
          {categories.map(cat => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-6 py-3 rounded-xl font-medium transition-all ${
                selectedCategory === cat.id
                  ? 'bg-gradient-to-r from-blue-500 to-purple-500 text-white shadow-lg shadow-blue-500/50'
                  : 'bg-gray-800/50 text-gray-300 hover:bg-gray-700/50 border border-gray-700'
              }`}
              data-testid={`button-category-${cat.id}`}
            >
              {cat.label}
              <span className="ml-2 text-sm opacity-75">({cat.count})</span>
            </button>
          ))}
        </div>
      </div>

      {/* Documents Grid */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredDocs.map(doc => (
            <button
              key={doc.id}
              onClick={() => loadDocument(doc)}
              className="group text-left"
              data-testid={`button-document-${doc.id}`}
            >
              <div className={`h-full bg-gradient-to-br ${doc.color} p-1 rounded-2xl transition-all duration-300 group-hover:shadow-2xl group-hover:shadow-blue-500/20 group-hover:scale-105`}>
                <div className="h-full bg-gray-900 rounded-xl p-6 transition-colors group-hover:bg-gray-800">
                  <div className={`bg-gradient-to-br ${doc.color} p-3 rounded-xl w-fit mb-4`}>
                    {doc.icon}
                  </div>
                  <h3 className="text-xl font-bold text-white mb-2 group-hover:text-blue-400 transition-colors">
                    {doc.title}
                  </h3>
                  <p className="text-gray-400 text-sm leading-relaxed mb-4">
                    {doc.description}
                  </p>
                  <div className="flex items-center gap-2 text-blue-400 text-sm font-medium">
                    <span>View Document</span>
                    <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

// Enhanced markdown renderer with visual placeholders
function renderMarkdown(markdown: string): string {
  let html = markdown;

  // Camera direction placeholders - detect [Camera: ...] patterns
  html = html.replace(/\*\*\[Camera:\s*([^\]]+)\]\*\*/g, (_match, description) => {
    return `<div class="my-6 bg-gradient-to-br from-orange-500/20 to-red-500/20 border-2 border-dashed border-orange-500/40 rounded-xl p-6">
      <div class="flex items-center gap-4">
        <div class="bg-orange-500/20 p-4 rounded-xl">
          <svg class="w-8 h-8 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"></path>
          </svg>
        </div>
        <div class="flex-1">
          <div class="text-orange-400 font-bold text-sm uppercase tracking-wide mb-1">🎬 Camera Shot</div>
          <div class="text-white font-medium">${description}</div>
        </div>
      </div>
    </div>`;
  });

  // Detect slide sections (### Visual: followed by content)
  html = html.replace(/###\s*Visual:\s*\n([\s\S]*?)(?=\n###|$)/gi, (_match, content) => {
    return `<div class="my-6 bg-gradient-to-br from-purple-500/20 to-pink-500/20 border-2 border-dashed border-purple-500/40 rounded-xl p-6">
      <div class="flex items-center gap-3 mb-4">
        <div class="bg-purple-500/20 p-3 rounded-lg">
          <svg class="w-7 h-7 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"></path>
          </svg>
        </div>
        <div class="text-purple-400 font-bold text-lg">📊 SLIDE VISUAL</div>
      </div>
      <div class="text-gray-200 space-y-2 pl-2">${content.trim().split('\n').map((line: string) => `<div>${line}</div>`).join('')}</div>
    </div>`;
  });

  // Detect script/notes sections
  html = html.replace(/###\s*(Script\/Notes|Content):\s*\n/gi, (_match, label) => {
    return `<div class="mt-6 mb-3"><div class="text-cyan-400 font-bold text-sm uppercase tracking-wide flex items-center gap-2">
      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
      </svg>
      📝 ${label}
    </div></div>`;
  });

  // Code blocks with better styling
  html = html.replace(/```(\w+)?\n([\s\S]*?)```/g, (_match, lang, code) => {
    const lines = code.trim().split('\n');
    const lineNumbers = lines.map((_: string, i: number) => `<span class="text-gray-600 select-none">${i + 1}</span>`).join('\n');
    const codeContent = code.trim().replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return `<div class="my-6 bg-gray-950 border border-gray-700 rounded-xl overflow-hidden">
      <div class="bg-gray-900 px-4 py-2 border-b border-gray-700 flex items-center gap-2">
        <div class="flex gap-1.5">
          <div class="w-3 h-3 rounded-full bg-red-500"></div>
          <div class="w-3 h-3 rounded-full bg-yellow-500"></div>
          <div class="w-3 h-3 rounded-full bg-green-500"></div>
        </div>
        <span class="text-gray-500 text-xs ml-2">${lang || 'text'}</span>
      </div>
      <div class="flex">
        <pre class="py-4 px-3 text-xs leading-relaxed">${lineNumbers}</pre>
        <pre class="flex-1 py-4 pr-4 overflow-x-auto"><code class="text-sm text-gray-200 font-mono leading-relaxed">${codeContent}</code></pre>
      </div>
    </div>`;
  });

  // Markdown tables - must be done before headers to avoid conflicts
  const tableRegex = /^\|(.+)\|\s*\n\|[-:\s|]+\|\s*\n((?:\|.+\|\s*\n?)*)/gm;
  html = html.replace(tableRegex, (match) => {
    const lines = match.trim().split('\n').filter(line => line.trim());
    if (lines.length < 2) return match;
    
    const headerCells = lines[0].split('|').filter(cell => cell.trim()).map(cell => cell.trim());
    const rows = lines.slice(2).map(line => 
      line.split('|').filter(cell => cell.trim()).map(cell => cell.trim())
    );
    
    let tableHtml = '<div class="my-6 overflow-x-auto"><table class="w-full border-collapse bg-gray-900/50 rounded-lg overflow-hidden">';
    tableHtml += '<thead class="bg-gradient-to-r from-blue-600/20 to-purple-600/20"><tr>';
    headerCells.forEach(cell => {
      tableHtml += `<th class="border border-gray-700 px-4 py-3 text-left text-white font-semibold">${cell}</th>`;
    });
    tableHtml += '</tr></thead><tbody>';
    rows.forEach((row, i) => {
      const bgClass = i % 2 === 0 ? 'bg-gray-800/30' : 'bg-gray-800/50';
      tableHtml += `<tr class="${bgClass}">`;
      row.forEach(cell => {
        tableHtml += `<td class="border border-gray-700 px-4 py-3 text-gray-200">${cell}</td>`;
      });
      tableHtml += '</tr>';
    });
    tableHtml += '</tbody></table></div>';
    return tableHtml;
  });

  // Headers (do this after special sections and tables)
  html = html.replace(/^### (.*$)/gim, '<h3 class="text-xl font-bold text-cyan-400 mt-6 mb-3">$1</h3>');
  html = html.replace(/^## (.*$)/gim, '<h2 class="text-2xl font-bold text-blue-400 mt-8 mb-4 pb-2 border-b border-gray-700">$1</h2>');
  html = html.replace(/^# (.*$)/gim, '<h1 class="text-4xl font-bold text-white mt-0 mb-6 pb-4 border-b-2 border-gray-700">$1</h1>');

  // Bold and italic (before processing inline text)
  html = html.replace(/\*\*([^\*]+)\*\*/g, '<strong class="text-white font-semibold">$1</strong>');
  html = html.replace(/\*([^\*]+)\*/g, '<em class="text-gray-300 italic">$1</em>');

  // Links
  html = html.replace(/\[([^\]]+)\]\(([^\)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-blue-400 hover:text-blue-300 underline">$1</a>');

  // Inline code
  html = html.replace(/`([^`]+)`/g, '<code class="bg-gray-900 text-pink-400 px-2 py-1 rounded text-sm font-mono">$1</code>');

  // Lists
  html = html.replace(/^[•✓✗-]\s+(.*$)/gim, '<li class="text-gray-200 ml-4">$1</li>');
  html = html.replace(/^\*\s+(.*$)/gim, '<li class="text-gray-200 ml-4">$1</li>');
  
  // Wrap consecutive list items in ul
  html = html.replace(/(<li[^>]*>.*?<\/li>\s*)+/gs, '<ul class="space-y-2 my-4">$&</ul>');

  // Horizontal rules
  html = html.replace(/^---$/gm, '<hr class="my-8 border-t-2 border-gray-700">');

  // Paragraphs - make text bright and readable
  html = html.split('\n\n').map(para => {
    if (para.trim().startsWith('<')) return para;
    if (para.trim() === '') return '';
    return `<p class="text-gray-100 leading-relaxed my-4">${para}</p>`;
  }).join('\n');

  // Clean up
  html = html.replace(/<p class="text-gray-100[^>]*><h/g, '<h');
  html = html.replace(/<\/h([1-6])><\/p>/g, '</h$1>');
  html = html.replace(/<p class="text-gray-100[^>]*><div/g, '<div');
  html = html.replace(/<\/div><\/p>/g, '</div>');
  html = html.replace(/<p class="text-gray-100[^>]*><ul/g, '<ul');
  html = html.replace(/<\/ul><\/p>/g, '</ul>');
  html = html.replace(/<p class="text-gray-100[^>]*><hr/g, '<hr');
  html = html.replace(/<\/hr><\/p>/g, '');
  html = html.replace(/<p class="text-gray-100[^>]*>\s*<\/p>/g, '');

  return html;
}

const MarketingPage = () => {
  return (
    <MarketingPasswordGate>
      <MarketingPageContent />
    </MarketingPasswordGate>
  );
};

export default MarketingPage;
