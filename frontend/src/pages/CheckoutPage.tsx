import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';
import client from '../api/client';

const publishableKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || '';

function InnerPay({ bookingId }: { bookingId: string }) {
  const stripe = useStripe();
  const elements = useElements();
  const navigate = useNavigate();
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function pay() {
    if (!stripe || !elements) return;
    setBusy(true);
    setErr(null);
    const { error, paymentIntent } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/booking-confirm/${bookingId}`,
      },
      redirect: 'if_required',
    });
    if (error) {
      setErr(error.message || 'Payment failed');
      setBusy(false);
      return;
    }
    if (paymentIntent?.status === 'succeeded') {
      try {
        // TEMP: sync DB after Stripe.js success. Send PI id so backend does not read a newer unused PI
        // (e.g. React Strict Mode double create-intent leaves booking.stripePaymentIntentId stale).
        await client.post('/payments/confirm-client-success', {
          bookingId,
          paymentIntentId: paymentIntent.id,
        });
      } catch {
        // Webhook may still update the booking later.
      }
      navigate(`/booking-confirm/${bookingId}`);
      return;
    }
    setBusy(false);
  }

  return (
    <div className="stack">
      <PaymentElement />
      {err && <p className="muted" style={{ margin: 0 }}>{err}</p>}
      <button className="btn btn-primary" type="button" disabled={busy} onClick={() => void pay()}>
        {busy ? '…' : 'Pay'}
      </button>
    </div>
  );
}

export default function CheckoutPage() {
  const { bookingId } = useParams();
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const stripePromise = useMemo(() => (publishableKey ? loadStripe(publishableKey) : null), []);

  useEffect(() => {
    if (!bookingId) return;
    client
      .post('/payments/create-intent', { bookingId })
      .then((res) => setClientSecret(res.data.clientSecret as string))
      .catch(() => setLoadError('Could not start payment.'));
  }, [bookingId]);

  if (!publishableKey || !stripePromise) {
    return (
      <main className="panel hero">
        <p className="muted" style={{ margin: 0 }}>
          Add <code>VITE_STRIPE_PUBLISHABLE_KEY</code> to <code>frontend/.env</code>.
        </p>
      </main>
    );
  }

  if (loadError) {
    return (
      <main className="panel hero">
        <p className="muted" style={{ margin: 0 }}>{loadError}</p>
      </main>
    );
  }

  if (!clientSecret) {
    return (
      <main className="panel hero">
        <p className="muted" style={{ margin: 0 }}>Loading…</p>
      </main>
    );
  }

  return (
    <main className="panel hero stack">
      <h1 className="page-title">Payment</h1>
      <p className="muted" style={{ margin: 0 }}>Booking {bookingId}</p>
      <Elements stripe={stripePromise} options={{ clientSecret }}>
        <InnerPay bookingId={bookingId!} />
      </Elements>
    </main>
  );
}
