// src/app/api/stripe/verify-payment/route.ts
import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import dbConnect from '@/lib/mongodb';
import { Donor } from '@/lib/models/Donor';
import { Donation } from '@/lib/models/Donation';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: '2025-07-30.basil',
});

export async function POST(request: Request) {
    try {
        await dbConnect();

        const { paymentIntentId } = await request.json();

        const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

        if (paymentIntent.status !== 'succeeded') {
            return NextResponse.json({ status: paymentIntent.status });
        }

        // Check if donation already exists
        const existingDonation = await Donation.findOne({
            stripePaymentIntentId: paymentIntentId,
        });

        if (existingDonation) {
            return NextResponse.json({ status: 'already_processed' });
        }

        // Get customer email from metadata or payment intent
        const customerEmail = paymentIntent.metadata.email ||
            (paymentIntent.customer ?
                (await stripe.customers.retrieve(paymentIntent.customer as string) as Stripe.Customer).email :
                null);

        if (!customerEmail) {
            return NextResponse.json({ error: 'Customer email not found' }, { status: 400 });
        }

        // Find donor
        const donor = await Donor.findOne({ email: customerEmail });
        if (!donor) {
            return NextResponse.json({ error: 'Donor not found' }, { status: 404 });
        }

        // Save donation
        const donation = new Donation({
            donorId: donor._id,
            amount: paymentIntent.amount / 100,
            currency: paymentIntent.currency,
            frequency: paymentIntent.metadata.frequency || 'one-time',
            status: 'succeeded',
            stripePaymentIntentId: paymentIntent.id,
            receiptUrl: paymentIntent.charges.data[0]?.receipt_url,
            metadata: paymentIntent.metadata,
        });

        await donation.save();

        return NextResponse.json({ status: paymentIntent.status });
    } catch (error: any) {
        console.error('Error verifying payment:', error);
        return NextResponse.json(
            { error: error.message || 'Failed to verify payment' },
            { status: 500 }
        );
    }
}