import { NextRequest } from 'next/server';

export async function POST(request: NextRequest) {
    try {
        const data = await request.json(); // Parse JSON from the request
        console.log('Incoming Data:', data); // Log the data

        return new Response(
            JSON.stringify({ message: 'Data received successfully' }),
            {
                status: 200,
                headers: {
                    'Content-Type': 'application/json',
                },
            }
        );
    } catch (error) {
        console.error('Error parsing request:', error);

        return new Response(
            JSON.stringify({ message: 'Invalid request format' }),
            {
                status: 400,
                headers: {
                    'Content-Type': 'application/json',
                },
            }
        );
    }
}
