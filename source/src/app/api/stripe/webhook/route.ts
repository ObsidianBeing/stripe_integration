// src/app/api/stripe/webhook/route.ts
import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import dbConnect from '@/lib/mongodb';
import { Donor } from '@/lib/models/Donor';
import { Donation } from '@/lib/models/Donation';
import { sendDonationReceipt, sendDonationFailed } from '@/lib/email';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: '2025-07-30.basil',
});

export async function POST(request: Request) {
    const payload = await request.text();
    const sig = request.headers.get('stripe-signature')!;
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

    let event: Stripe.Event;

    try {
        event = stripe.webhooks.constructEvent(payload, sig, webhookSecret);
    } catch (err: any) {
        console.error(`Webhook Error: ${err.message}`);
        return NextResponse.json({ error: `Webhook Error: ${err.message}` }, { status: 400 });
    }

    await dbConnect();

    try {
        switch (event.type) {
            case 'payment_intent.succeeded': {
                const paymentIntent = event.data.object as Stripe.PaymentIntent;

                if (paymentIntent.metadata.frequency === 'one-time') {
                    const donor = await Donor.findOne({
                        $or: [
                            { email: paymentIntent.metadata.email },
                            { stripeCustomerId: paymentIntent.customer as string },
                        ],
                    });

                    if (!donor) {
                        console.error('Donor not found for payment intent:', paymentIntent.id);
                        break;
                    }

                    const existingDonation = await Donation.findOne({
                        stripePaymentIntentId: paymentIntent.id,
                    });

                    if (!existingDonation) {
                        const donation = new Donation({
                            donorId: donor._id,
                            amount: paymentIntent.amount / 100,
                            currency: paymentIntent.currency,
                            frequency: 'one-time',
                            status: 'succeeded',
                            stripePaymentIntentId: paymentIntent.id,
                            receiptUrl: paymentIntent.charges.data[0]?.receipt_url,
                            metadata: paymentIntent.metadata,
                        });

                        await donation.save();
                        await sendDonationReceipt(donor, donation);
                    }
                }
                break;
            }

            case 'invoice.paid': {
                const invoice = event.data.object as Stripe.Invoice;

                if (invoice.billing_reason === 'subscription_cycle') {
                    const subscription = await stripe.subscriptions.retrieve(
                        invoice.subscription as string
                    );

                    const donor = await Donor.findOne({
                        stripeCustomerId: invoice.customer as string,
                    });

                    if (!donor) {
                        console.error('Donor not found for invoice:', invoice.id);
                        break;
                    }

                    const invoicePdfUrl = await stripe.invoices.retrieve(invoice.id, {
                        expand: ['invoice_pdf'],
                    }).then(inv => inv.invoice_pdf);

                    const donation = new Donation({
                        donorId: donor._id,
                        amount: invoice.amount_paid / 100,
                        currency: invoice.currency,
                        frequency: subscription.metadata.frequency as Donation['frequency'],
                        status: 'succeeded',
                        stripeSubscriptionId: invoice.subscription as string,
                        stripeInvoiceId: invoice.id,
                        receiptUrl: invoice.hosted_invoice_url,
                        invoicePdfUrl,
                        metadata: subscription.metadata,
                    });

                    await donation.save();
                    await sendDonationReceipt(donor, donation);
                }
                break;
            }

            case 'invoice.payment_failed': {
                const invoice = event.data.object as Stripe.Invoice;

                if (invoice.attempt_count > 1) {
                    const donor = await Donor.findOne({
                        stripeCustomerId: invoice.customer as string,
                    });

                    if (!donor) {
                        console.error('Donor not found for failed invoice:', invoice.id);
                        break;
                    }

                    const subscription = await stripe.subscriptions.retrieve(
                        invoice.subscription as string
                    );

                    const donation = new Donation({
                        donorId: donor._id,
                        amount: invoice.amount_due / 100,
                        currency: invoice.currency,
                        frequency: subscription.metadata.frequency as Donation['frequency'],
                        status: 'failed',
                        stripeSubscriptionId: invoice.subscription as string,
                        stripeInvoiceId: invoice.id,
                        metadata: subscription.metadata,
                    });

                    await donation.save();
                    await sendDonationFailed(donor, donation);
                }
                break;
            }

            case 'customer.subscription.deleted': {
                const subscription = event.data.object as Stripe.Subscription;

                await Donation.updateMany(
                    { stripeSubscriptionId: subscription.id },
                    { status: 'canceled' }
                );
                break;
            }

            default:
                console.log(`Unhandled event type ${event.type}`);
        }

        return NextResponse.json({ received: true });
    } catch (error: any) {
        console.error('Error processing webhook:', error);
        return NextResponse.json(
            { error: error.message || 'Failed to process webhook' },
            { status: 500 }
        );
    }
}

export const dynamic = 'force-dynamic';