import { NextResponse } from 'next/server';
import mongoose from 'mongoose';

export async function GET() {
    try {
        await mongoose.connect(process.env.MONGODB_URI!);
        const readyState = mongoose.connection.readyState;
        return NextResponse.json({
            status: readyState === 1 ? 'connected' : 'not connected',
            readyState,
            dbName: mongoose.connection.name
        });
    } catch (error: any) {
        return NextResponse.json(
            {
                error: 'Connection failed',
                details: error.message,
                stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
            },
            { status: 500 }
        );
    }
}