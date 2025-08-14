// src/lib/models/Donor.ts
import { Schema, model, models, Document } from 'mongoose';

export interface IDonor extends Document {
  stripeCustomerId?: string; // Changed to optional
  email: string;
  name: string;
  phone?: string;
  address?: {
    line1: string;
    line2?: string;
    city: string;
    state: string;
    postal_code: string;
    country: string;
  };
}

const DonorSchema = new Schema<IDonor>({
  stripeCustomerId: { type: String }, // Removed required: true
  email: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  phone: { type: String },
  address: {
    line1: String,
    line2: String,
    city: String,
    state: String,
    postal_code: String,
    country: String,
  },
}, { timestamps: true });

export const Donor = models.Donor || model<IDonor>('Donor', DonorSchema);