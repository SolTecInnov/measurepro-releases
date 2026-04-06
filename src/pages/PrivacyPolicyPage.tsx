import { Link } from 'react-router-dom';
import { ArrowLeft, Shield, Database, Cookie, Globe, Mail } from 'lucide-react';

export default function PrivacyPolicyPage() {
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
            <Shield className="w-10 h-10 text-blue-500" />
            <h1 className="text-4xl font-bold text-white" data-testid="text-page-title">Privacy Policy</h1>
          </div>
          <p className="text-gray-400 text-lg" data-testid="text-last-updated">
            Last Updated: October 17, 2025
          </p>
        </div>

        <div className="space-y-8">
          {/* Introduction */}
          <section className="bg-gray-800 border border-gray-700 rounded-lg p-6" data-testid="section-introduction">
            <h2 className="text-2xl font-semibold text-white mb-4">Introduction</h2>
            <p className="text-gray-300 leading-relaxed">
              SolTecInnovation ("we," "our," or "us") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use MeasurePRO, our professional measurement and surveying application. Please read this policy carefully to understand our views and practices regarding your personal data.
            </p>
            <div className="mt-4 p-4 bg-blue-900/30 border border-blue-700 rounded-lg">
              <p className="text-blue-300 text-sm">
                <strong>Contact Information:</strong><br />
                SolTecInnovation<br />
                Website: <a href="https://Soltecinnovation.com" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 underline" data-testid="link-company">Soltecinnovation.com</a><br />
                Email: <a href="mailto:Info@SolTecInnovation.com" className="text-blue-400 hover:text-blue-300 underline" data-testid="link-email">Info@SolTecInnovation.com</a>
              </p>
            </div>
          </section>

          {/* Data Collection */}
          <section className="bg-gray-800 border border-gray-700 rounded-lg p-6" data-testid="section-data-collection">
            <div className="flex items-center gap-3 mb-4">
              <Database className="w-6 h-6 text-blue-500" />
              <h2 className="text-2xl font-semibold text-white">Data Collection</h2>
            </div>
            <div className="space-y-4 text-gray-300">
              <div>
                <h3 className="text-lg font-semibold text-white mb-2">Information You Provide</h3>
                <ul className="list-disc list-inside space-y-2 ml-4">
                  <li>Account information (name, email address, password)</li>
                  <li>Profile information and preferences</li>
                  <li>Survey and measurement data you create</li>
                  <li>Communication data when you contact support</li>
                  <li>Payment information (processed securely through Square)</li>
                </ul>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white mb-2">Automatically Collected Information</h3>
                <ul className="list-disc list-inside space-y-2 ml-4">
                  <li>GPS location data (when location services are enabled)</li>
                  <li>Device information (type, operating system, browser)</li>
                  <li>Usage data (features used, time spent, interactions)</li>
                  <li>Log data (IP address, access times, error logs)</li>
                  <li>Camera and sensor data used for measurements</li>
                </ul>
              </div>
            </div>
          </section>

          {/* How We Use Your Data */}
          <section className="bg-gray-800 border border-gray-700 rounded-lg p-6" data-testid="section-data-usage">
            <h2 className="text-2xl font-semibold text-white mb-4">How We Use Your Data</h2>
            <div className="space-y-2 text-gray-300">
              <p className="leading-relaxed">We use the collected data for the following purposes:</p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>Provide, operate, and maintain the MeasurePRO application</li>
                <li>Process your transactions and manage subscriptions</li>
                <li>Improve, personalize, and expand our services</li>
                <li>Understand and analyze usage patterns</li>
                <li>Develop new features and functionality</li>
                <li>Communicate with you about updates, support, and promotional offers</li>
                <li>Detect, prevent, and address technical issues or security concerns</li>
                <li>Comply with legal obligations and enforce our terms</li>
              </ul>
            </div>
          </section>

          {/* Data Storage and Security */}
          <section className="bg-gray-800 border border-gray-700 rounded-lg p-6" data-testid="section-data-storage">
            <h2 className="text-2xl font-semibold text-white mb-4">Data Storage and Security</h2>
            <div className="space-y-4 text-gray-300">
              <p className="leading-relaxed">
                We implement appropriate technical and organizational security measures to protect your personal data:
              </p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>Data encryption in transit and at rest</li>
                <li>Secure cloud storage using Firebase and PostgreSQL databases</li>
                <li>Regular security audits and updates</li>
                <li>Access controls and authentication protocols</li>
                <li>Automated backup and disaster recovery systems</li>
              </ul>
              <p className="leading-relaxed mt-4">
                Your data is stored on secure servers located in data centers that comply with industry-standard security practices. We retain your data only as long as necessary for the purposes outlined in this policy or as required by law.
              </p>
            </div>
          </section>

          {/* Third-Party Services */}
          <section className="bg-gray-800 border border-gray-700 rounded-lg p-6" data-testid="section-third-party">
            <div className="flex items-center gap-3 mb-4">
              <Globe className="w-6 h-6 text-blue-500" />
              <h2 className="text-2xl font-semibold text-white">Third-Party Services</h2>
            </div>
            <div className="space-y-4 text-gray-300">
              <p className="leading-relaxed">
                MeasurePRO integrates with the following third-party services that may collect and process your data:
              </p>
              <div className="space-y-3">
                <div className="bg-gray-900/50 p-4 rounded-lg">
                  <h3 className="text-lg font-semibold text-white mb-2">Square (Payment Processing)</h3>
                  <p className="text-sm">
                    Square processes payment information securely. We do not store your full credit card details. Square's privacy policy: <a href="https://squareup.com/legal/privacy" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 underline">squareup.com/legal/privacy</a>
                  </p>
                </div>
                <div className="bg-gray-900/50 p-4 rounded-lg">
                  <h3 className="text-lg font-semibold text-white mb-2">Firebase (Data Storage & Authentication)</h3>
                  <p className="text-sm">
                    Firebase provides cloud storage, authentication, and real-time database services. Firebase's privacy policy: <a href="https://firebase.google.com/support/privacy" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 underline">firebase.google.com/support/privacy</a>
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* Cookies and Tracking */}
          <section className="bg-gray-800 border border-gray-700 rounded-lg p-6" data-testid="section-cookies">
            <div className="flex items-center gap-3 mb-4">
              <Cookie className="w-6 h-6 text-blue-500" />
              <h2 className="text-2xl font-semibold text-white">Cookies and Tracking Technologies</h2>
            </div>
            <div className="space-y-4 text-gray-300">
              <p className="leading-relaxed">
                We use cookies and similar tracking technologies to track activity on our application and store certain information:
              </p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li><strong>Essential Cookies:</strong> Required for basic functionality and authentication</li>
                <li><strong>Preference Cookies:</strong> Remember your settings and preferences</li>
                <li><strong>Analytics Cookies:</strong> Help us understand how you use the application</li>
                <li><strong>Local Storage:</strong> Store offline data and application state</li>
              </ul>
              <p className="leading-relaxed mt-4">
                You can configure your browser to refuse cookies, but this may limit some functionality of MeasurePRO.
              </p>
            </div>
          </section>

          {/* Your Rights */}
          <section className="bg-gray-800 border border-gray-700 rounded-lg p-6" data-testid="section-user-rights">
            <h2 className="text-2xl font-semibold text-white mb-4">Your Privacy Rights</h2>
            <div className="space-y-4 text-gray-300">
              <p className="leading-relaxed">You have the following rights regarding your personal data:</p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li><strong>Access:</strong> Request a copy of your personal data</li>
                <li><strong>Correction:</strong> Request correction of inaccurate data</li>
                <li><strong>Deletion:</strong> Request deletion of your data ("right to be forgotten")</li>
                <li><strong>Portability:</strong> Request transfer of your data to another service</li>
                <li><strong>Restriction:</strong> Request limitation of data processing</li>
                <li><strong>Objection:</strong> Object to certain types of data processing</li>
                <li><strong>Withdraw Consent:</strong> Withdraw consent for data processing at any time</li>
              </ul>
              <p className="leading-relaxed mt-4">
                To exercise any of these rights, please contact us at <a href="mailto:Info@SolTecInnovation.com" className="text-blue-400 hover:text-blue-300 underline">Info@SolTecInnovation.com</a>. We will respond to your request within 30 days.
              </p>
            </div>
          </section>

          {/* Data Sharing */}
          <section className="bg-gray-800 border border-gray-700 rounded-lg p-6" data-testid="section-data-sharing">
            <h2 className="text-2xl font-semibold text-white mb-4">Data Sharing and Disclosure</h2>
            <div className="space-y-4 text-gray-300">
              <p className="leading-relaxed">We may share your information in the following circumstances:</p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li><strong>With Your Consent:</strong> When you explicitly authorize us to share data</li>
                <li><strong>Service Providers:</strong> With trusted third parties who assist in operating our application</li>
                <li><strong>Legal Requirements:</strong> When required by law or to protect rights and safety</li>
                <li><strong>Business Transfers:</strong> In connection with mergers, acquisitions, or asset sales</li>
                <li><strong>Team Members:</strong> When you share surveys with other authorized users</li>
              </ul>
              <p className="leading-relaxed mt-4">
                We do not sell your personal data to third parties for marketing purposes.
              </p>
            </div>
          </section>

          {/* Children's Privacy */}
          <section className="bg-gray-800 border border-gray-700 rounded-lg p-6" data-testid="section-children">
            <h2 className="text-2xl font-semibold text-white mb-4">Children's Privacy</h2>
            <p className="text-gray-300 leading-relaxed">
              MeasurePRO is not intended for users under the age of 18. We do not knowingly collect personal information from children. If you are a parent or guardian and believe your child has provided us with personal data, please contact us immediately, and we will take steps to remove such information.
            </p>
          </section>

          {/* International Data Transfers */}
          <section className="bg-gray-800 border border-gray-700 rounded-lg p-6" data-testid="section-international">
            <h2 className="text-2xl font-semibold text-white mb-4">International Data Transfers</h2>
            <p className="text-gray-300 leading-relaxed">
              Your information may be transferred to and maintained on servers located outside of your jurisdiction. We ensure appropriate safeguards are in place to protect your data in compliance with this Privacy Policy and applicable data protection laws.
            </p>
          </section>

          {/* Policy Updates */}
          <section className="bg-gray-800 border border-gray-700 rounded-lg p-6" data-testid="section-updates">
            <h2 className="text-2xl font-semibold text-white mb-4">Policy Updates</h2>
            <p className="text-gray-300 leading-relaxed">
              We may update this Privacy Policy from time to time. We will notify you of any changes by posting the new policy on this page and updating the "Last Updated" date. We encourage you to review this policy periodically. Your continued use of MeasurePRO after changes constitutes acceptance of the updated policy.
            </p>
          </section>

          {/* Contact Section */}
          <section className="bg-gradient-to-br from-blue-900/40 to-purple-900/40 border-2 border-blue-500 rounded-lg p-6" data-testid="section-contact">
            <div className="flex items-center gap-3 mb-4">
              <Mail className="w-6 h-6 text-blue-400" />
              <h2 className="text-2xl font-semibold text-white">Contact Us</h2>
            </div>
            <p className="text-gray-300 leading-relaxed mb-4">
              If you have any questions, concerns, or requests regarding this Privacy Policy or our data practices, please contact us:
            </p>
            <div className="space-y-2 text-gray-300">
              <p><strong className="text-white">Company:</strong> SolTecInnovation</p>
              <p><strong className="text-white">Website:</strong> <a href="https://Soltecinnovation.com" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 underline">Soltecinnovation.com</a></p>
              <p><strong className="text-white">Email:</strong> <a href="mailto:Info@SolTecInnovation.com" className="text-blue-400 hover:text-blue-300 underline">Info@SolTecInnovation.com</a></p>
            </div>
            <div className="mt-6">
              <Link
                to="/contact"
                className="inline-block bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-semibold transition-colors"
                data-testid="button-contact"
              >
                Contact Support
              </Link>
            </div>
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
