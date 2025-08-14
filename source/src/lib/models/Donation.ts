// src/lib/models/Donation.ts
import { Schema, model, models, Document } from 'mongoose';

export type DonationFrequency = 'one-time' | 'daily' | 'weekly' | 'monthly' | 'yearly';
export type DonationStatus = 'pending' | 'succeeded' | 'failed' | 'canceled';

export interface IDonation extends Document {
    donorId: Schema.Types.ObjectId;
    amount: number;
    currency: string;
    frequency: DonationFrequency;
    status: DonationStatus;
    stripePaymentIntentId?: string;
    stripeSubscriptionId?: string;
    stripeInvoiceId?: string;
    receiptUrl?: string;
    invoicePdfUrl?: string;
    metadata?: Record<string, any>;
}

const DonationSchema = new Schema<IDonation>({
    donorId: { type: Schema.Types.ObjectId, ref: 'Donor', required: true },
    amount: { type: Number, required: true },
    currency: { type: String, required: true, default: 'usd' },
    frequency: {
        type: String,
        required: true,
        enum: ['one-time', 'daily', 'weekly', 'monthly', 'yearly'],
    },
    status: {
        type: String,
        required: true,
        enum: ['pending', 'succeeded', 'failed', 'canceled'],
        default: 'pending',
    },
    stripePaymentIntentId: String,
    stripeSubscriptionId: String,
    stripeInvoiceId: String,
    receiptUrl: String,
    invoicePdfUrl: String,
    metadata: { type: Schema.Types.Mixed },
}, { timestamps: true });

DonationSchema.index({ donorId: 1 });
DonationSchema.index({ stripePaymentIntentId: 1 });
DonationSchema.index({ stripeSubscriptionId: 1 });
DonationSchema.index({ stripeInvoiceId: 1 });

export const Donation = models.Donation || model<IDonation>('Donation', DonationSchema);