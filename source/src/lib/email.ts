// src/lib/email.ts
import nodemailer from 'nodemailer';
import { renderFile } from 'ejs';
import path from 'path';
import { IDonation } from './models/Donation';
import { IDonor } from './models/Donor';

const transporter = nodemailer.createTransport({
    service: process.env.EMAIL_SERVICE,
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD,
    },
    tls: {
        rejectUnauthorized: false
    }
});

export const sendDonationReceipt = async (donor: IDonor, donation: IDonation) => {
    try {
        const templatePath = path.join(process.cwd(), 'src/emails/donation-receipt.ejs');
        const html = await renderFile(templatePath, {
            donor: donor.toObject ? donor.toObject() : donor,
            donation: donation.toObject ? donation.toObject() : donation
        });

        const mailOptions = {
            from: process.env.EMAIL_FROM,
            to: donor.email,
            subject: `Thank you for your ${donation.frequency} donation`,
            html,
            attachments: donation.invoicePdfUrl ? [
                {
                    filename: 'invoice.pdf',
                    path: donation.invoicePdfUrl,
                }
            ] : undefined,
        };

        await transporter.sendMail(mailOptions);
        console.log('Receipt email sent to:', donor.email);
    } catch (error) {
        console.error('Error sending receipt email:', error);
        throw error;
    }
};

export const sendDonationFailed = async (donor: IDonor, donation: IDonation) => {
    try {
        const templatePath = path.join(process.cwd(), 'src/emails/donation-failed.ejs');
        const html = await renderFile(templatePath, {
            donor: donor.toObject ? donor.toObject() : donor,
            donation: donation.toObject ? donation.toObject() : donation
        });

        const mailOptions = {
            from: process.env.EMAIL_FROM,
            to: donor.email,
            subject: `Issue with your ${donation.frequency} donation`,
            html,
        };

        await transporter.sendMail(mailOptions);
        console.log('Failure notification sent to:', donor.email);
    } catch (error) {
        console.error('Error sending failure email:', error);
        throw error;
    }
};