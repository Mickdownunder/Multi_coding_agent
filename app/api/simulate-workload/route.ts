import { NextRequest, NextResponse } from 'next/server';

/**
 * API Route to simulate a workload and return the execution duration.
 * Supports an optional 'delay' parameter in the request body.
 */
export async function POST(request: NextRequest) {
  const startTime = performance.now();

  try {
    let delay = 500; // Default delay in ms

    // Parse request body for custom delay
    try {
      const body = await request.json();
      if (typeof body.delay === 'number') {
        delay = body.delay;
      }
    } catch (e) {
      // Use default if body is empty or invalid
    }

    // Simulate workload using a Promise-based timeout
    await new Promise((resolve) => setTimeout(resolve, delay));

    const endTime = performance.now();
    const durationMs = endTime - startTime;

    return NextResponse.json({
      status: 'success',
      workload: 'simulated_delay',
      requestedDelayMs: delay,
      actualDurationMs: parseFloat(durationMs.toFixed(3)),
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to simulate workload', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}