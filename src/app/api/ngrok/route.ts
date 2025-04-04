import { NextRequest, NextResponse } from "next/server";

// In-memory storage for the latest ngrok URL
let latestGrokData: { ngrok_url: string; timestamp: string; machine_id: string } | null = null;

/**
 * Handles POST requests to store ngrok data.
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();

        if (!body.ngrok_url || !body.timestamp || !body.machine_id) {
            return NextResponse.json(
                { error: "Invalid data format. Required: ngrok_url, timestamp, machine_id" },
                { status: 400 }
            );
        }

        // Store latest data in memory
        latestGrokData = body;

        return NextResponse.json({ message: "ngrok data stored successfully" });
    } catch (error) {
        return NextResponse.json(
            { error: "Internal Server Error", details: error },
            { status: 500 }
        );
    }
}

/**
 * Handles GET requests to retrieve the latest ngrok URL.
 */
export async function GET() {
    if (!latestGrokData) {
        return NextResponse.json(
            { error: "No ngrok data available" },
            { status: 404 }
        );
    }

    return NextResponse.json(latestGrokData);
}
