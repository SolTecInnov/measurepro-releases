import { Link, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { CheckCircle, ArrowLeft, Package, Loader2, AlertCircle } from 'lucide-react';

interface SessionDetails {
  id: string;
  status: string;
  paymentStatus: string;
  customerEmail: string;
  customerName: string;
  amountTotal: number;
  currency: string;
  metadata: {
    customerName?: string;
    items?: string;
    type?: string;
  };
}

export default function CheckoutSuccessPage() {
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get('session_id');

  const { data, isLoading, error } = useQuery<{ success: boolean; session: SessionDetails }>({
    queryKey: ['/api/checkout/session', sessionId],
    enabled: !!sessionId,
  });

  const session = data?.session;

  if (!sessionId) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-900 via-gray-800 to-gray-900 text-gray-100 flex items-center justify-center">
        <div className="text-center max-w-md">
          <AlertCircle className="w-16 h-16 text-yellow-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-white mb-4">Invalid Session</h1>
          <p className="text-gray-400 mb-6">
            No checkout session found. Please try your purchase again.
          </p>
          <Link
            to="/pricing#hardware"
            className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-semibold transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            Back to Pricing
          </Link>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-900 via-gray-800 to-gray-900 text-gray-100 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-blue-500 animate-spin mx-auto mb-4" />
          <p className="text-gray-400">Loading order details...</p>
        </div>
      </div>
    );
  }

  if (error || !session) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-900 via-gray-800 to-gray-900 text-gray-100 flex items-center justify-center">
        <div className="text-center max-w-md">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-white mb-4">Error Loading Order</h1>
          <p className="text-gray-400 mb-6">
            We couldn't retrieve your order details. Please contact support.
          </p>
          <Link
            to="/contact"
            className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-semibold transition-colors"
          >
            Contact Support
          </Link>
        </div>
      </div>
    );
  }

  const isPaid = session.paymentStatus === 'paid';

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 via-gray-800 to-gray-900 text-gray-100">
      <div className="container mx-auto px-6 py-16">
        <div className="max-w-2xl mx-auto text-center">
          {isPaid ? (
            <>
              <div className="mb-8">
                <div className="relative inline-block">
                  <CheckCircle className="w-24 h-24 text-green-500 mx-auto" />
                  <div className="absolute -bottom-2 -right-2 bg-green-500 rounded-full p-2">
                    <Package className="w-6 h-6 text-white" />
                  </div>
                </div>
              </div>

              <h1 className="text-4xl font-bold text-white mb-4" data-testid="text-success-title">
                Order Confirmed!
              </h1>
              <p className="text-xl text-gray-300 mb-8">
                Thank you for your purchase, {session.customerName || 'valued customer'}!
              </p>

              <div className="bg-gray-800 border border-gray-700 rounded-xl p-6 mb-8 text-left">
                <h2 className="text-lg font-semibold text-white mb-4">Order Details</h2>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Order ID:</span>
                    <span className="text-white font-mono text-sm">{session.id.slice(-12)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Email:</span>
                    <span className="text-white">{session.customerEmail}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Total:</span>
                    <span className="text-green-400 font-bold text-xl">
                      ${((session.amountTotal || 0) / 100).toLocaleString()} {session.currency?.toUpperCase()}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Status:</span>
                    <span className="text-green-400 font-semibold">Payment Complete</span>
                  </div>
                </div>
              </div>

              <div className="bg-blue-900/30 border border-blue-500/50 rounded-xl p-6 mb-8">
                <h3 className="text-lg font-semibold text-white mb-2">What's Next?</h3>
                <ul className="text-gray-300 text-left space-y-2">
                  <li className="flex items-start gap-2">
                    <CheckCircle className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                    <span>You'll receive a confirmation email at {session.customerEmail}</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                    <span>Our team will contact you within 24 hours to arrange delivery</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                    <span>Your software licenses will be activated upon hardware delivery</span>
                  </li>
                </ul>
              </div>

              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link
                  to="/"
                  className="inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-semibold transition-colors"
                  data-testid="button-go-home"
                >
                  Go to Home
                </Link>
                <Link
                  to="/contact"
                  className="inline-flex items-center justify-center gap-2 bg-gray-700 hover:bg-gray-600 text-white px-6 py-3 rounded-lg font-semibold transition-colors"
                  data-testid="button-contact"
                >
                  Contact Support
                </Link>
              </div>
            </>
          ) : (
            <>
              <AlertCircle className="w-24 h-24 text-yellow-500 mx-auto mb-8" />
              <h1 className="text-4xl font-bold text-white mb-4">Payment Pending</h1>
              <p className="text-xl text-gray-300 mb-8">
                Your payment is being processed. Please wait or contact support if this persists.
              </p>
              <Link
                to="/contact"
                className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-semibold transition-colors"
              >
                Contact Support
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
