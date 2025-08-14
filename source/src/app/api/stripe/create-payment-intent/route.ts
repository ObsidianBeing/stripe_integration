// src/app/api/stripe/create-payment-intent/route.ts
import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import dbConnect from '@/lib/mongodb';
import { Donor } from '@/lib/models/Donor';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: '2025-07-30.basil',
});

export async function POST(request: Request) {
    try {
        await dbConnect();

        const { amount, frequency, donor, metadata } = await request.json();
        const db = await dbConnect();

        // Validate frequency
        const validFrequencies = ['one-time', 'daily', 'weekly', 'monthly', 'yearly'];
        if (!validFrequencies.includes(frequency)) {
            return NextResponse.json({ error: 'Invalid donation frequency' }, { status: 400 });
        }

        // Validate amount
        if (amount < 1) {
            return NextResponse.json({ error: 'Amount must be at least 1' }, { status: 400 });
        }

        if (frequency === 'one-time') {
            const paymentIntent = await stripe.paymentIntents.create({
                amount: Math.round(amount * 100),
                currency: 'usd',
                metadata: {
                    ...metadata,
                    frequency,
                },
            });

            // Save or update donor
            let donorRecord = await Donor.findOneAndUpdate(
                { email: donor.email },
                {
                    $setOnInsert: { // Only set these fields on insert
                        ...donor,
                        createdAt: new Date(),
                        updatedAt: new Date(),
                    },
                    $set: { // Always update these fields
                        updatedAt: new Date(),
                    }
                },
                { upsert: true, new: true }
            );

            return NextResponse.json({
                clientSecret: paymentIntent.client_secret,
                paymentIntentId: paymentIntent.id,
            });
        } else {
            // Recurring donation logic...
            let customer: Stripe.Customer;
            const existingCustomer = await stripe.customers.list({ email: donor.email });

            if (existingCustomer.data.length > 0) {
                customer = existingCustomer.data[0];
            } else {
                customer = await stripe.customers.create({
                    email: donor.email,
                    name: donor.name,
                    phone: donor.phone,
                    address: donor.address,
                    metadata: {
                        ...metadata,
                    },
                });
            }

            // Save or update donor
            const donorRecord = await Donor.findOneAndUpdate(
                { email: donor.email },
                {
                    $set: {
                        ...donor,
                        stripeCustomerId: customer.id,
                        updatedAt: new Date(),
                    },
                    $setOnInsert: {
                        createdAt: new Date(),
                    }
                },
                { upsert: true, new: true }
            );

            // Map frequency to Stripe interval
            const intervalMap = {
                daily: 'day',
                weekly: 'week',
                monthly: 'month',
                yearly: 'year',
            };

            const price = await stripe.prices.create({
                unit_amount: Math.round(amount * 100),
                currency: 'usd',
                recurring: {
                    interval: intervalMap[frequency],
                },
                product_data: {
                    name: `${frequency} donation`,
                },
            });

            const subscription = await stripe.subscriptions.create({
                customer: customer.id,
                items: [{ price: price.id }],
                payment_behavior: 'default_incomplete',
                expand: ['latest_invoice.payment_intent'],
                metadata: {
                    ...metadata,
                    frequency,
                },
            });

            const latestInvoice = subscription.latest_invoice as Stripe.Invoice;
            const paymentIntent = (latestInvoice as any).payment_intent as Stripe.PaymentIntent;

            return NextResponse.json({
                clientSecret: paymentIntent.client_secret,
                subscriptionId: subscription.id,
            });
        }
    } catch (error: any) {
        console.error('Error creating payment intent:', error);
        return NextResponse.json(
            { error: error.message || 'Failed to create payment intent' },
            { status: 500 }
        );
    }
}