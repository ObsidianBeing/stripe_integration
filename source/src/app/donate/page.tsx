// src/app/donate/page.tsx
'use client';

import { useState } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import {
    Elements,
    useStripe,
    useElements,
    PaymentElement,
} from '@stripe/react-stripe-js';

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

const DonationForm = () => {
    const [amount, setAmount] = useState<number>(50);
    const [frequency, setFrequency] = useState<'one-time' | 'daily' | 'weekly' | 'monthly' | 'yearly'>('one-time');
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const [message, setMessage] = useState<string | null>(null);
    const [clientSecret, setClientSecret] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsProcessing(true);
        setMessage(null);

        try {
            const response = await fetch('/api/stripe/create-payment-intent', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    amount,
                    frequency,
                    donor: {
                        name,
                        email,
                    },
                }),
            });

            const data = await response.json();
            if (data.error) {
                setMessage(data.error);
            } else {
                setClientSecret(data.clientSecret);
            }
        } catch (error) {
            setMessage('Failed to create donation. Please try again.');
        } finally {
            setIsProcessing(false);
        }
    };

    if (clientSecret) {
        return (
            <Elements stripe={stripePromise} options={{ clientSecret }}>
                <CheckoutForm
                    onSuccess={() => {
                        setMessage('Thank you for your donation!');
                        setClientSecret(null);
                    }}
                    onError={(error) => {
                        setMessage(error);
                        setClientSecret(null);
                    }}
                />
            </Elements>
        );
    }

    return (
        <form onSubmit={handleSubmit}>
            <h1>Make a Donation</h1>

            <div>
                <label>Amount</label>
                <input
                    type="number"
                    min="1"
                    value={amount}
                    onChange={(e) => setAmount(Number(e.target.value))}
                    required
                />
            </div>

            <div>
                <label>Frequency</label>
                <select
                    value={frequency}
                    onChange={(e) => setFrequency(e.target.value as any)}
                >
                    <option value="one-time">One-time</option>
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                    <option value="yearly">Yearly</option>
                </select>
            </div>

            <div>
                <label>Name</label>
                <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                />
            </div>

            <div>
                <label>Email</label>
                <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                />
            </div>

            <button type="submit" disabled={isProcessing}>
                {isProcessing ? 'Processing...' : 'Donate'}
            </button>

            {message && <div>{message}</div>}
        </form>
    );
};

const CheckoutForm = ({ onSuccess, onError }: {
    onSuccess: () => void;
    onError: (error: string) => void
}) => {
    const stripe = useStripe();
    const elements = useElements();
    const [isProcessing, setIsProcessing] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!stripe || !elements) {
            return;
        }

        setIsProcessing(true);

        try {
            const { error } = await stripe.confirmPayment({
                elements,
                confirmParams: {
                    return_url: `${window.location.origin}/donate/thank-you`,
                },
            });

            if (error) {
                onError(error.message || 'Payment failed');
            } else {
                onSuccess();
            }
        } catch (error: any) {
            onError(error.message || 'Payment failed');
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <form onSubmit={handleSubmit}>
            <PaymentElement />
            <button type="submit" disabled={!stripe || isProcessing}>
                {isProcessing ? 'Processing...' : 'Submit Donation'}
            </button>
        </form>
    );
};

export default function DonatePage() {
    return (
        <div>
            <DonationForm />
        </div>
    );
}