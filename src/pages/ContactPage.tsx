import { Link } from 'react-router-dom';
import { API_BASE_URL } from '@/lib/config/environment';
import { useEffect } from 'react';
import { ArrowLeft, Mail, Send } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';

const contactFormSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(100, 'Name is too long'),
  email: z.string().email('Please enter a valid email address'),
  subject: z.string().min(5, 'Subject must be at least 5 characters').max(200, 'Subject is too long'),
  message: z.string().min(10, 'Message must be at least 10 characters').max(2000, 'Message is too long'),
});

type ContactFormData = z.infer<typeof contactFormSchema>;

export default function ContactPage() {
  // Per-page SEO: unique title + meta description for this route
  useEffect(() => {
    document.title = 'Contact & Book a Demo — MeasurePRO OS/OW Road Survey | measure-pro.app';
    const meta = document.querySelector('meta[name="description"]');
    if (meta) meta.setAttribute('content', 'Contact SolTec Innovation to book a MeasurePRO demo, request a hardware bundle quote, or get support for your OS/OW heavy haul road survey project.');
    const canonical = document.querySelector('link[rel="canonical"]');
    if (canonical) canonical.setAttribute('href', 'https://measure-pro.app/contact');
    return () => {
      document.title = 'MeasurePRO — LiDAR Road Survey App for Oversize & Overweight Transport | measure-pro.app';
      if (meta) meta.setAttribute('content', 'MeasurePRO by SolTec Innovation: professional LiDAR & GPS field app for OS/OW heavy haul surveys. Measure bridge clearances, lane widths, road geometry and export permit-ready data.');
      if (canonical) canonical.setAttribute('href', 'https://measure-pro.app/');
    };
  }, []);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ContactFormData>({
    resolver: zodResolver(contactFormSchema),
    defaultValues: {
      name: '',
      email: '',
      subject: '',
      message: '',
    },
  });

  const onSubmit = async (data: ContactFormData) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/email/contact`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (result.success) {
        /* toast removed */
        reset();
      } else {
        toast.error('Failed to send message', {
          description: result.error || 'Please try again later.',
        });
      }
    } catch (error: any) {
      toast.error('Failed to send message', {
        description: 'Please check your connection and try again.',
      });
    }
  };

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
      <div className="container mx-auto px-6 py-12 max-w-6xl">
        <div className="mb-12 text-center">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Mail className="w-10 h-10 text-blue-500" />
            <h1 className="text-4xl font-bold text-white" data-testid="text-page-title">Contact &amp; Book a Demo</h1>
          </div>
          <p className="text-gray-400 text-lg" data-testid="text-page-subtitle">
            Talk to the SolTec Innovation team about MeasurePRO — request a live demo, ask about hardware bundles,
            or get support for your OS/OW heavy haul survey project.
          </p>
          <div className="mt-6 inline-flex gap-4 flex-wrap justify-center">
            <a
              href="mailto:info@soltecinnovation.com"
              className="inline-flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg font-semibold transition-colors"
              data-testid="button-book-demo-email"
            >
              <Mail className="w-5 h-5" />
              Book a Demo by Email
            </a>
            <a
              href="https://soltecinnovation.com"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 bg-gray-700 hover:bg-gray-600 border border-gray-600 text-white px-6 py-3 rounded-lg font-semibold transition-colors"
              data-testid="link-soltec-hardware"
            >
              Request Hardware Bundle Quote
            </a>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Contact Information */}
          <div className="lg:col-span-1 space-y-6">
            {/* Company Info */}
            <div className="bg-gray-800 border border-gray-700 rounded-lg p-6" data-testid="section-company-info">
              <h2 className="text-2xl font-semibold text-white mb-6">Get in Touch</h2>
              <div className="space-y-4">
                <div className="flex items-start gap-4">
                  <div className="bg-blue-900/30 p-3 rounded-lg">
                    <Mail className="w-5 h-5 text-blue-400" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-white mb-1">Email</h3>
                    <a
                      href="mailto:Info@SolTecInnovation.com"
                      className="text-blue-400 hover:text-blue-300 transition-colors"
                      data-testid="link-email"
                    >
                      Info@SolTecInnovation.com
                    </a>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="bg-blue-900/30 p-3 rounded-lg">
                    <Mail className="w-5 h-5 text-blue-400" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-white mb-1">Website</h3>
                    <a
                      href="https://Soltecinnovation.com"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-400 hover:text-blue-300 transition-colors"
                      data-testid="link-website"
                    >
                      Soltecinnovation.com
                    </a>
                  </div>
                </div>
              </div>
            </div>

            {/* Support Hours */}
            <div className="bg-gray-800 border border-gray-700 rounded-lg p-6" data-testid="section-support-hours">
              <h3 className="text-xl font-semibold text-white mb-4">Support Hours</h3>
              <div className="space-y-3 text-gray-300">
                <div>
                  <p className="font-semibold text-white">Priority Support</p>
                  <p className="text-sm">Monday - Friday</p>
                  <p className="text-sm">8:00 AM - 8:00 PM EST</p>
                  <p className="text-sm text-blue-400">For subscription users</p>
                </div>
                <div className="border-t border-gray-700 pt-3">
                  <p className="font-semibold text-white">Standard Support</p>
                  <p className="text-sm">Monday - Friday</p>
                  <p className="text-sm">9:00 AM - 5:00 PM EST</p>
                  <p className="text-sm text-gray-400">For Lite users</p>
                </div>
              </div>
            </div>

            {/* Quick Links */}
            <div className="bg-gray-800 border border-gray-700 rounded-lg p-6" data-testid="section-quick-links">
              <h3 className="text-xl font-semibold text-white mb-4">Quick Links</h3>
              <div className="space-y-2">
                <Link
                  to="/privacy"
                  className="block text-blue-400 hover:text-blue-300 transition-colors"
                  data-testid="link-privacy"
                >
                  Privacy Policy →
                </Link>
                <Link
                  to="/terms"
                  className="block text-blue-400 hover:text-blue-300 transition-colors"
                  data-testid="link-terms"
                >
                  Terms & Conditions →
                </Link>
                <Link
                  to="/policies"
                  className="block text-blue-400 hover:text-blue-300 transition-colors"
                  data-testid="link-policies"
                >
                  Policies →
                </Link>
              </div>
            </div>
          </div>

          {/* Contact Form */}
          <div className="lg:col-span-2">
            <div className="bg-gray-800 border border-gray-700 rounded-lg p-8" data-testid="section-contact-form">
              <h2 className="text-2xl font-semibold text-white mb-6">Send us a Message</h2>
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                <div>
                  <label htmlFor="name" className="block text-sm font-medium text-white mb-2">
                    Name
                  </label>
                  <input
                    id="name"
                    type="text"
                    {...register('name')}
                    className="w-full px-4 py-3 bg-gray-900 border border-gray-600 rounded-lg text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Your full name"
                    data-testid="input-name"
                  />
                  {errors.name && (
                    <p className="mt-1 text-sm text-red-400">{errors.name.message}</p>
                  )}
                </div>

                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-white mb-2">
                    Email
                  </label>
                  <input
                    id="email"
                    type="email"
                    {...register('email')}
                    className="w-full px-4 py-3 bg-gray-900 border border-gray-600 rounded-lg text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="your.email@example.com"
                    data-testid="input-email"
                  />
                  {errors.email && (
                    <p className="mt-1 text-sm text-red-400">{errors.email.message}</p>
                  )}
                </div>

                <div>
                  <label htmlFor="subject" className="block text-sm font-medium text-white mb-2">
                    Subject
                  </label>
                  <input
                    id="subject"
                    type="text"
                    {...register('subject')}
                    className="w-full px-4 py-3 bg-gray-900 border border-gray-600 rounded-lg text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Brief description of your inquiry"
                    data-testid="input-subject"
                  />
                  {errors.subject && (
                    <p className="mt-1 text-sm text-red-400">{errors.subject.message}</p>
                  )}
                </div>

                <div>
                  <label htmlFor="message" className="block text-sm font-medium text-white mb-2">
                    Message
                  </label>
                  <textarea
                    id="message"
                    rows={6}
                    {...register('message')}
                    className="w-full px-4 py-3 bg-gray-900 border border-gray-600 rounded-lg text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                    placeholder="Tell us how we can help you..."
                    data-testid="input-message"
                  />
                  {errors.message && (
                    <p className="mt-1 text-sm text-red-400">{errors.message.message}</p>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  data-testid="button-submit"
                >
                  {isSubmitting ? (
                    'Sending...'
                  ) : (
                    <>
                      <Send className="w-5 h-5" />
                      Send Message
                    </>
                  )}
                </button>
              </form>

              <div className="mt-8 pt-8 border-t border-gray-700">
                <p className="text-gray-400 text-sm text-center">
                  By submitting this form, you agree to our{' '}
                  <Link to="/privacy" className="text-blue-400 hover:text-blue-300 underline">
                    Privacy Policy
                  </Link>
                  {' '}and{' '}
                  <Link to="/terms" className="text-blue-400 hover:text-blue-300 underline">
                    Terms & Conditions
                  </Link>
                </p>
              </div>
            </div>

            {/* Additional Info */}
            <div className="mt-6 bg-blue-900/30 border border-blue-700 rounded-lg p-6" data-testid="section-response-time">
              <h3 className="text-lg font-semibold text-white mb-2">Response Time</h3>
              <p className="text-blue-300 text-sm">
                We typically respond to all inquiries within 24-48 hours during business days. 
                For urgent matters, subscription users can access priority support with a 4-hour response time.
              </p>
            </div>
          </div>
        </div>

        {/* FAQ Section */}
        <div className="mt-16">
          <h2 className="text-3xl font-bold text-white mb-8 text-center" data-testid="text-faq-title">
            Frequently Asked Questions
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-gray-800 border border-gray-700 rounded-lg p-6" data-testid="faq-item-1">
              <h3 className="text-lg font-semibold text-white mb-2">How do I get started with MeasurePRO?</h3>
              <p className="text-gray-300 text-sm">
                Sign up for a free 14-day trial or purchase MeasurePRO Lite. Our onboarding guide will walk you through the setup process step by step.
              </p>
            </div>
            <div className="bg-gray-800 border border-gray-700 rounded-lg p-6" data-testid="faq-item-2">
              <h3 className="text-lg font-semibold text-white mb-2">What payment methods do you accept?</h3>
              <p className="text-gray-300 text-sm">
                We accept all major credit cards and debit cards through our secure Square payment gateway.
              </p>
            </div>
            <div className="bg-gray-800 border border-gray-700 rounded-lg p-6" data-testid="faq-item-3">
              <h3 className="text-lg font-semibold text-white mb-2">Can I cancel my subscription anytime?</h3>
              <p className="text-gray-300 text-sm">
                Yes, you can cancel your subscription at any time from your account settings. Your access continues until the end of the current billing period.
              </p>
            </div>
            <div className="bg-gray-800 border border-gray-700 rounded-lg p-6" data-testid="faq-item-4">
              <h3 className="text-lg font-semibold text-white mb-2">Do you offer technical support?</h3>
              <p className="text-gray-300 text-sm">
                Yes! Subscription users get priority support with 4-hour response times. Lite users receive standard support within 2 business days.
              </p>
            </div>
          </div>
        </div>

        {/* Back to Home */}
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
