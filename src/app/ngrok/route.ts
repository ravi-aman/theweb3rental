import { NextRequest, NextResponse } from "next/server";

// In-memory storage for the latest ngrok URL
let latestGrokData: { ngrok_url: string; timestamp: string; machine_id: string } | null = null;

/**
 * Handles POST requests to store ngrok data.
 */
export async function POST(request: NextRequest) {
    try {
        console.log("Received request to /api/ngrok");

        const body = await request.json();
        console.log("Request body:", body);

        if (!body.ngrok_url || !body.timestamp || !body.machine_id) {
            console.log("Missing required fields in request");
            return NextResponse.json(
                { error: "Invalid data format. Required: ngrok_url, timestamp, machine_id" },
                { status: 400 }
            );
        }

        // Store latest data in memory
        latestGrokData = body;
        console.log("Updated latestGrokData:", latestGrokData);

        return NextResponse.json({ message: "ngrok data stored successfully" });
    } catch (error) {
        console.error("Error processing request:", error);
        return NextResponse.json(
            { error: "Internal Server Error", details: String(error) },
            { status: 500 }
        );
    }
}

/**
 * Handles GET requests to retrieve the latest ngrok URL.
 */
export async function GET() {
    console.log("GET request received, current data:", latestGrokData);

    if (!latestGrokData) {
        return NextResponse.json(
            { error: "No ngrok data available" },
            { status: 404 }
        );
    }

    return NextResponse.json(latestGrokData);
}