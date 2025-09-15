import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const PYTHON_API_BASE = process.env.PYTHON_API_BASE || 'http://localhost:8000';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    // Forward all query parameters to the Python API
    const params = new URLSearchParams();
    searchParams.forEach((value, key) => {
      params.append(key, value);
    });

    const pythonUrl = `${PYTHON_API_BASE}/categories/tree?${params.toString()}`;

    const response = await fetch(pythonUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Python API error:', response.status, errorText);
      return NextResponse.json(
        { error: 'Failed to fetch categories from backend' },
        { status: response.status },
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error proxying to Python API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
