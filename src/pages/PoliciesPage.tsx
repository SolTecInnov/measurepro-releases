import { Link } from 'react-router-dom';
import { ArrowLeft, FileText, RefreshCw, Shield, Clock, HeadphonesIcon } from 'lucide-react';

export default function PoliciesPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 via-gray-800 to-gray-900 text-gray-100">
      {/* Header */}
      <nav className="border-b border-gray-700 bg-gray-900/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center gap-4">
            <Link
              to="/"
              className="text-gray-300 hover:text-white transition-colors flex items-center gap-2"
              data-testid="link-back"
            >
              <ArrowLeft className="w-5 h-5" />
              Back to Home
            </Link>
          </div>
        </div>
      </nav>

      {/* Content */}
      <div className="container mx-auto px-6 py-12 max-w-4xl">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <FileText className="w-10 h-10 text-blue-500" />
            <h1 className="text-4xl font-bold text-white" data-testid="text-page-title">Policies</h1>
          </div>
          <p className="text-gray-400 text-lg" data-testid="text-last-updated">
            Last Updated: October 17, 2025
          </p>
        </div>

        <div className="space-y-8">
          {/* Introduction */}
          <section className="bg-gray-800 border border-gray-700 rounded-lg p-6" data-testid="section-introduction">
            <p className="text-gray-300 leading-relaxed">
              These policies govern your use of MeasurePRO and the services provided by SolTecInnovation. By using our application, you agree to comply with these policies. Please read them carefully.
            </p>
          </section>

          {/* Refund Policy */}
          <section className="bg-gray-800 border border-gray-700 rounded-lg p-6" data-testid="section-refund">
            <div className="flex items-center gap-3 mb-4">
              <RefreshCw className="w-6 h-6 text-blue-500" />
              <h2 className="text-2xl font-semibold text-white">Refund Policy</h2>
            </div>
            <div className="space-y-4 text-gray-300">
              <div>
                <h3 className="text-lg font-semibold text-white mb-2">MeasurePRO Subscription ($300/month)</h3>
                <ul className="list-disc list-inside space-y-2 ml-4">
                  <li><strong>Trial Period:</strong> New subscribers receive a 14-day money-back guarantee from the date of first payment</li>
                  <li><strong>Monthly Refunds:</strong> Refund requests within the first 14 days will receive a full refund</li>
                  <li><strong>Partial Refunds:</strong> No partial refunds are provided for unused portions of the billing cycle</li>
                  <li><strong>Cancellation:</strong> You may cancel at any time; service continues until the end of the current billing period</li>
                  <li><strong>Processing Time:</strong> Approved refunds are processed within 5-10 business days</li>
                </ul>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white mb-2">MeasurePRO Lite (One-time Purchase - $850)</h3>
                <ul className="list-disc list-inside space-y-2 ml-4">
                  <li><strong>30-Day Guarantee:</strong> Full refund available within 30 days of purchase</li>
                  <li><strong>Condition:</strong> Refund requires that the software has not been extensively used (defined as less than 10 surveys created)</li>
                  <li><strong>Lifetime License:</strong> No refunds after the 30-day period, but lifetime support is included</li>
                  <li><strong>Upgrade Refunds:</strong> Upgrade purchases ($300) are non-refundable once downloaded</li>
                </ul>
              </div>
              <div className="mt-4 p-4 bg-blue-900/30 border border-blue-700 rounded-lg">
                <p className="text-blue-300 text-sm">
                  <strong>How to Request a Refund:</strong> Email us at <a href="mailto:Info@SolTecInnovation.com" className="text-blue-400 hover:text-blue-300 underline">Info@SolTecInnovation.com</a> with your order number and reason for the refund request.
                </p>
              </div>
            </div>
          </section>

          {/* Usage Policy */}
          <section className="bg-gray-800 border border-gray-700 rounded-lg p-6" data-testid="section-usage">
            <div className="flex items-center gap-3 mb-4">
              <Shield className="w-6 h-6 text-blue-500" />
              <h2 className="text-2xl font-semibold text-white">Acceptable Usage Policy</h2>
            </div>
            <div className="space-y-4 text-gray-300">
              <p className="leading-relaxed">
                You agree to use MeasurePRO in compliance with all applicable laws and regulations. The following activities are prohibited:
              </p>
              <div>
                <h3 className="text-lg font-semibold text-white mb-2">Prohibited Activities</h3>
                <ul className="list-disc list-inside space-y-2 ml-4">
                  <li>Using the service for any unlawful purpose or in violation of any local, state, national, or international law</li>
                  <li>Attempting to gain unauthorized access to our systems, servers, or networks</li>
                  <li>Interfering with or disrupting the service or servers connected to the service</li>
                  <li>Reverse engineering, decompiling, or disassembling the software</li>
                  <li>Sharing your account credentials with unauthorized users</li>
                  <li>Using the service to transmit malware, viruses, or harmful code</li>
                  <li>Scraping, data mining, or harvesting data from the service without permission</li>
                  <li>Reselling or redistributing the service without authorization</li>
                </ul>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white mb-2">Permitted Use</h3>
                <ul className="list-disc list-inside space-y-2 ml-4">
                  <li>Professional measurement and surveying activities</li>
                  <li>Legitimate business and commercial applications</li>
                  <li>Educational and research purposes</li>
                  <li>Personal projects and non-commercial use</li>
                </ul>
              </div>
              <div className="mt-4 p-4 bg-red-900/30 border border-red-700 rounded-lg">
                <p className="text-red-300 text-sm">
                  <strong>Violation Consequences:</strong> Violation of this policy may result in immediate suspension or termination of your account without refund.
                </p>
              </div>
            </div>
          </section>

          {/* Data Retention Policy */}
          <section className="bg-gray-800 border border-gray-700 rounded-lg p-6" data-testid="section-retention">
            <div className="flex items-center gap-3 mb-4">
              <Clock className="w-6 h-6 text-blue-500" />
              <h2 className="text-2xl font-semibold text-white">Data Retention Policy</h2>
            </div>
            <div className="space-y-4 text-gray-300">
              <p className="leading-relaxed">
                We retain your data in accordance with legal requirements and business needs:
              </p>
              <div>
                <h3 className="text-lg font-semibold text-white mb-2">Active Accounts</h3>
                <ul className="list-disc list-inside space-y-2 ml-4">
                  <li><strong>Survey Data:</strong> Retained indefinitely while your account is active</li>
                  <li><strong>Measurement Data:</strong> Retained indefinitely while your account is active</li>
                  <li><strong>GPS Logs:</strong> Retained for the duration of the associated survey</li>
                  <li><strong>Usage Data:</strong> Retained for 2 years for analytics and improvement purposes</li>
                  <li><strong>Account Information:</strong> Retained while your account is active</li>
                </ul>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white mb-2">Closed/Terminated Accounts</h3>
                <ul className="list-disc list-inside space-y-2 ml-4">
                  <li><strong>Account Data:</strong> Deleted within 90 days of account closure</li>
                  <li><strong>Survey Data:</strong> Available for export for 30 days after closure, then permanently deleted</li>
                  <li><strong>Payment Records:</strong> Retained for 7 years for tax and legal compliance</li>
                  <li><strong>Support Tickets:</strong> Retained for 3 years for quality assurance</li>
                  <li><strong>Backup Data:</strong> Removed from backups within 90 days</li>
                </ul>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white mb-2">Data Export</h3>
                <p className="leading-relaxed">
                  You can export your data at any time through the application. We provide data in standard formats (CSV, JSON, GeoJSON) for easy migration to other systems.
                </p>
              </div>
              <div className="mt-4 p-4 bg-blue-900/30 border border-blue-700 rounded-lg">
                <p className="text-blue-300 text-sm">
                  <strong>Data Deletion Request:</strong> To request immediate deletion of your data, contact us at <a href="mailto:Info@SolTecInnovation.com" className="text-blue-400 hover:text-blue-300 underline">Info@SolTecInnovation.com</a>
                </p>
              </div>
            </div>
          </section>

          {/* Support Policy */}
          <section className="bg-gray-800 border border-gray-700 rounded-lg p-6" data-testid="section-support">
            <div className="flex items-center gap-3 mb-4">
              <HeadphonesIcon className="w-6 h-6 text-blue-500" />
              <h2 className="text-2xl font-semibold text-white">Support Policy</h2>
            </div>
            <div className="space-y-4 text-gray-300">
              <p className="leading-relaxed">
                We are committed to providing excellent support to all MeasurePRO users:
              </p>
              <div>
                <h3 className="text-lg font-semibold text-white mb-2">MeasurePRO Subscription - Priority Support</h3>
                <ul className="list-disc list-inside space-y-2 ml-4">
                  <li><strong>Response Time:</strong> Within 4 business hours for critical issues</li>
                  <li><strong>Support Hours:</strong> Monday-Friday, 8 AM - 8 PM EST</li>
                  <li><strong>Support Channels:</strong> Email, phone, and live chat</li>
                  <li><strong>Emergency Support:</strong> 24/7 for critical production issues</li>
                  <li><strong>Dedicated Support:</strong> Assigned support specialist for enterprise accounts</li>
                  <li><strong>Training:</strong> Complimentary onboarding and training sessions</li>
                </ul>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white mb-2">MeasurePRO Lite - Standard Support</h3>
                <ul className="list-disc list-inside space-y-2 ml-4">
                  <li><strong>Response Time:</strong> Within 2 business days</li>
                  <li><strong>Support Hours:</strong> Monday-Friday, 9 AM - 5 PM EST</li>
                  <li><strong>Support Channels:</strong> Email and help center</li>
                  <li><strong>Documentation:</strong> Access to comprehensive user guides and FAQs</li>
                  <li><strong>Community:</strong> Access to user community forums</li>
                </ul>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white mb-2">What We Support</h3>
                <ul className="list-disc list-inside space-y-2 ml-4">
                  <li>Software bugs and technical issues</li>
                  <li>Feature guidance and best practices</li>
                  <li>Account and billing questions</li>
                  <li>Data export and migration assistance</li>
                  <li>Integration and setup help</li>
                  <li>Performance optimization guidance</li>
                </ul>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white mb-2">Out of Scope</h3>
                <ul className="list-disc list-inside space-y-2 ml-4">
                  <li>Custom development or modifications</li>
                  <li>Third-party hardware troubleshooting (laser devices, GPS units)</li>
                  <li>General IT support unrelated to MeasurePRO</li>
                  <li>Data recovery from unauthorized modifications</li>
                </ul>
              </div>
              <div className="mt-4 p-4 bg-blue-900/30 border border-blue-700 rounded-lg">
                <p className="text-blue-300 text-sm">
                  <strong>Contact Support:</strong><br />
                  Email: <a href="mailto:Info@SolTecInnovation.com" className="text-blue-400 hover:text-blue-300 underline">Info@SolTecInnovation.com</a><br />
                  Website: <a href="https://Soltecinnovation.com" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 underline">Soltecinnovation.com</a>
                </p>
              </div>
            </div>
          </section>

          {/* Updates and Maintenance */}
          <section className="bg-gray-800 border border-gray-700 rounded-lg p-6" data-testid="section-maintenance">
            <h2 className="text-2xl font-semibold text-white mb-4">Updates and Maintenance</h2>
            <div className="space-y-4 text-gray-300">
              <div>
                <h3 className="text-lg font-semibold text-white mb-2">Software Updates</h3>
                <ul className="list-disc list-inside space-y-2 ml-4">
                  <li><strong>MeasurePRO Subscription:</strong> Automatic updates included at no additional cost</li>
                  <li><strong>MeasurePRO Lite:</strong> Major updates available for $300 each</li>
                  <li><strong>Security Patches:</strong> Critical security updates provided free to all users</li>
                  <li><strong>Update Frequency:</strong> Regular updates released monthly; critical patches as needed</li>
                </ul>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white mb-2">Scheduled Maintenance</h3>
                <ul className="list-disc list-inside space-y-2 ml-4">
                  <li>Scheduled maintenance windows: Sundays 2:00 AM - 6:00 AM EST</li>
                  <li>Users notified at least 48 hours in advance</li>
                  <li>Emergency maintenance performed as needed with minimal notice</li>
                  <li>Service Level Agreement (SLA): 99.5% uptime for subscription users</li>
                </ul>
              </div>
            </div>
          </section>

          {/* Contact Section */}
          <section className="bg-gradient-to-br from-blue-900/40 to-purple-900/40 border-2 border-blue-500 rounded-lg p-6" data-testid="section-contact">
            <h2 className="text-2xl font-semibold text-white mb-4">Questions About Our Policies?</h2>
            <p className="text-gray-300 leading-relaxed mb-4">
              If you have any questions or concerns about these policies, please don't hesitate to contact us:
            </p>
            <div className="space-y-2 text-gray-300 mb-6">
              <p><strong className="text-white">Company:</strong> SolTecInnovation</p>
              <p><strong className="text-white">Website:</strong> <a href="https://Soltecinnovation.com" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 underline">Soltecinnovation.com</a></p>
              <p><strong className="text-white">Email:</strong> <a href="mailto:Info@SolTecInnovation.com" className="text-blue-400 hover:text-blue-300 underline">Info@SolTecInnovation.com</a></p>
            </div>
            <Link
              to="/contact"
              className="inline-block bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-semibold transition-colors"
              data-testid="button-contact"
            >
              Contact Support
            </Link>
          </section>
        </div>

        {/* Back to Top */}
        <div className="mt-12 text-center">
          <Link
            to="/"
            className="text-blue-400 hover:text-blue-300 transition-colors inline-flex items-center gap-2"
            data-testid="link-back-home"
          >
            <ArrowLeft className="w-5 h-5" />
            Back to Home
          </Link>
        </div>
      </div>
    </div>
  );
}
