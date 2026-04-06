import { CHANGELOG, type ChangelogEntry } from '@/lib/changelog';
import { APP_NAME } from '@/lib/version';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, Zap, Bug, Shield, ArrowRight, FileText } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';

const changeTypeConfig = {
  added: { icon: Plus, label: 'New', className: 'bg-green-500/20 text-green-400 border-green-500/30' },
  improved: { icon: Zap, label: 'Improved', className: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
  fixed: { icon: Bug, label: 'Fixed', className: 'bg-orange-500/20 text-orange-400 border-orange-500/30' },
  security: { icon: Shield, label: 'Security', className: 'bg-red-500/20 text-red-400 border-red-500/30' }
};

function ChangelogEntryCard({ entry, isLatest }: { entry: ChangelogEntry; isLatest: boolean }) {
  return (
    <article className="mb-8" itemScope itemType="https://schema.org/SoftwareApplication">
      <meta itemProp="name" content={`${APP_NAME} ${entry.version}`} />
      <meta itemProp="softwareVersion" content={entry.version} />
      <meta itemProp="datePublished" content={entry.date} />
      
      <Card 
        className={`bg-gray-800/50 border-gray-700 ${isLatest ? 'ring-2 ring-blue-500/50' : ''}`}
        data-testid={`changelog-entry-${entry.version}`}
      >
        <CardHeader className="pb-4">
          <div className="flex items-start justify-between flex-wrap gap-3">
            <div className="flex items-center gap-4">
              <Badge 
                variant="outline" 
                className={`text-lg font-mono px-3 py-1 ${isLatest ? 'bg-blue-500/20 text-blue-400 border-blue-500/50' : 'bg-gray-700 text-gray-300 border-gray-600'}`}
                data-testid={`version-badge-${entry.version}`}
              >
                v{entry.version}
              </Badge>
              {isLatest && (
                <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
                  Latest
                </Badge>
              )}
            </div>
            <time 
              dateTime={entry.date} 
              className="text-sm text-gray-400"
              data-testid={`date-${entry.version}`}
            >
              {new Date(entry.date).toLocaleDateString('en-US', { 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
              })}
            </time>
          </div>
          
          <CardTitle className="text-2xl text-white mt-3" itemProp="description">
            {entry.title}
          </CardTitle>
          
          {entry.highlights.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-4">
              {entry.highlights.map((highlight, idx) => (
                <Badge 
                  key={idx} 
                  variant="secondary" 
                  className="bg-purple-500/20 text-purple-300 border-purple-500/30 text-sm"
                  data-testid={`highlight-${entry.version}-${idx}`}
                >
                  {highlight}
                </Badge>
              ))}
            </div>
          )}
        </CardHeader>
        
        <CardContent>
          <ul className="space-y-3" role="list">
            {entry.changes.map((change, idx) => {
              const config = changeTypeConfig[change.type];
              const Icon = config.icon;
              return (
                <li 
                  key={idx} 
                  className="flex items-start gap-3"
                  data-testid={`change-${entry.version}-${idx}`}
                >
                  <Badge className={`${config.className} shrink-0 mt-0.5 text-xs`} variant="outline">
                    <Icon className="h-3 w-3 mr-1" />
                    {config.label}
                  </Badge>
                  <span className="text-gray-300">{change.description}</span>
                </li>
              );
            })}
          </ul>
        </CardContent>
      </Card>
    </article>
  );
}

export default function Changelog() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    "name": APP_NAME,
    "applicationCategory": "BusinessApplication",
    "operatingSystem": "Web, iOS, Android",
    "offers": {
      "@type": "Offer",
      "price": "0",
      "priceCurrency": "USD"
    },
    "releaseNotes": CHANGELOG.map(entry => ({
      "@type": "SoftwareSourceCode",
      "version": entry.version,
      "datePublished": entry.date,
      "description": entry.title
    }))
  };

  return (
    <>
      <Helmet>
        <title>Changelog - {APP_NAME} | Version History & Updates</title>
        <meta 
          name="description" 
          content={`Track all ${APP_NAME} updates, new features, improvements, and bug fixes. Stay informed about the latest changes to our professional measurement and surveying application.`} 
        />
        <meta name="keywords" content="MeasurePRO changelog, version history, updates, new features, bug fixes, surveying software updates" />
        <link rel="canonical" href="/changelog" />
        <script type="application/ld+json">
          {JSON.stringify(jsonLd)}
        </script>
      </Helmet>

      <div className="min-h-screen bg-gradient-to-b from-gray-900 via-gray-800 to-gray-900 text-gray-100">
        {/* Navigation - Same as marketing pages */}
        <nav className="border-b border-gray-700 bg-gray-900/50 backdrop-blur-sm sticky top-0 z-50">
          <div className="container mx-auto px-6 py-4">
            <div className="flex items-center justify-between">
              <Link to="/" className="flex items-center gap-3">
                <Zap className="w-8 h-8 text-blue-500" />
                <h1 className="text-2xl font-bold text-white">MeasurePRO</h1>
              </Link>
              <div className="flex items-center gap-4">
                <Link
                  to="/features"
                  className="text-gray-300 hover:text-white transition-colors hidden sm:block"
                  data-testid="link-features"
                >
                  Features
                </Link>
                <Link
                  to="/pricing"
                  className="text-gray-300 hover:text-white transition-colors hidden sm:block"
                  data-testid="link-pricing"
                >
                  Pricing
                </Link>
                <Link
                  to="/help"
                  className="text-gray-300 hover:text-white transition-colors hidden sm:block"
                  data-testid="link-help"
                >
                  Help
                </Link>
                <Link
                  to="/changelog"
                  className="text-blue-400 hover:text-blue-300 transition-colors"
                  data-testid="link-changelog-active"
                >
                  Changelog
                </Link>
                <Link
                  to="/signup"
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-semibold transition-colors"
                  data-testid="button-signup-nav"
                >
                  Sign Up
                </Link>
              </div>
            </div>
          </div>
        </nav>

        {/* Hero Header */}
        <section className="container mx-auto px-6 py-16">
          <div className="text-center max-w-3xl mx-auto">
            <div className="flex items-center justify-center gap-3 mb-6">
              <FileText className="w-12 h-12 text-blue-500" />
            </div>
            <h1 className="text-4xl md:text-5xl font-bold mb-4 bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent" data-testid="changelog-title">
              What's New in {APP_NAME}
            </h1>
            <p className="text-xl text-gray-300 leading-relaxed" data-testid="changelog-subtitle">
              Track all updates, new features, and improvements to our professional measurement and surveying platform. 
              We're constantly improving based on your feedback.
            </p>
          </div>
        </section>

        {/* Changelog Entries */}
        <section className="container mx-auto px-6 pb-16 max-w-4xl">
          <main role="feed" aria-label="Version history">
            {CHANGELOG.map((entry, index) => (
              <ChangelogEntryCard key={entry.version} entry={entry} isLatest={index === 0} />
            ))}
          </main>
          
          {/* Coming Soon / Roadmap Teaser */}
          <Card className="bg-gradient-to-r from-blue-900/30 to-purple-900/30 border-blue-500/30 mt-8">
            <CardContent className="py-8 text-center">
              <h3 className="text-2xl font-bold text-white mb-3">Coming Soon</h3>
              <p className="text-gray-300 mb-4">
                We're always working on new features. Here's what's on our roadmap:
              </p>
              <div className="flex flex-wrap justify-center gap-3">
                <Badge className="bg-purple-500/20 text-purple-300 border-purple-500/30">
                  Enhanced AI Detection
                </Badge>
                <Badge className="bg-purple-500/20 text-purple-300 border-purple-500/30">
                  Mobile App Improvements
                </Badge>
                <Badge className="bg-purple-500/20 text-purple-300 border-purple-500/30">
                  Advanced Reporting
                </Badge>
                <Badge className="bg-purple-500/20 text-purple-300 border-purple-500/30">
                  Team Collaboration
                </Badge>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Footer - Same as marketing pages */}
        <footer className="border-t border-gray-700 bg-gray-900/50 backdrop-blur-sm">
          <div className="container mx-auto px-6 py-12">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
              {/* Company Info */}
              <div className="col-span-1 md:col-span-2">
                <div className="flex items-center gap-3 mb-4">
                  <Zap className="w-8 h-8 text-blue-500" />
                  <span className="text-xl font-bold text-white">MeasurePRO</span>
                </div>
                <p className="text-gray-400 mb-4" data-testid="text-footer-description">
                  Professional measurement and surveying application for field teams. Precision, reliability, and ease of use in one powerful platform.
                </p>
                <a
                  href="https://Soltecinnovation.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-400 hover:text-blue-300 transition-colors flex items-center gap-1"
                  data-testid="link-company-site"
                >
                  Visit SolTecInnovation
                  <ArrowRight className="w-4 h-4" />
                </a>
              </div>

              {/* Quick Links */}
              <div>
                <h5 className="font-semibold text-white mb-4">Product</h5>
                <ul className="space-y-2">
                  <li>
                    <Link to="/features" className="text-gray-400 hover:text-white transition-colors" data-testid="link-footer-features">
                      Features
                    </Link>
                  </li>
                  <li>
                    <Link to="/pricing" className="text-gray-400 hover:text-white transition-colors" data-testid="link-footer-pricing">
                      Pricing
                    </Link>
                  </li>
                  <li>
                    <Link to="/documentation" className="text-gray-400 hover:text-white transition-colors" data-testid="link-footer-docs">
                      Documentation
                    </Link>
                  </li>
                  <li>
                    <Link to="/changelog" className="text-blue-400 hover:text-blue-300 transition-colors" data-testid="link-footer-changelog">
                      Changelog
                    </Link>
                  </li>
                </ul>
              </div>

              {/* Legal Links */}
              <div>
                <h5 className="font-semibold text-white mb-4">Legal</h5>
                <ul className="space-y-2">
                  <li>
                    <Link to="/privacy" className="text-gray-400 hover:text-white transition-colors flex items-center gap-1" data-testid="link-privacy">
                      <Shield className="w-4 h-4" />
                      Privacy Policy
                    </Link>
                  </li>
                  <li>
                    <Link to="/terms" className="text-gray-400 hover:text-white transition-colors flex items-center gap-1" data-testid="link-terms">
                      <FileText className="w-4 h-4" />
                      Terms & Conditions
                    </Link>
                  </li>
                  <li>
                    <Link to="/contact" className="text-gray-400 hover:text-white transition-colors" data-testid="link-footer-contact">
                      Contact Us
                    </Link>
                  </li>
                </ul>
              </div>
            </div>

            {/* Copyright */}
            <div className="border-t border-gray-700 pt-8 text-center">
              <p className="text-gray-400" data-testid="text-copyright">
                © {new Date().getFullYear()} MeasurePRO by SolTecInnovation. All rights reserved.
              </p>
            </div>
          </div>
        </footer>
      </div>
    </>
  );
}
