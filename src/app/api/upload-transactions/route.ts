import type { NextRequest} from 'next/server';
import { NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    console.log('Proxy: Received request body:', body);
    
    const response = await fetch('http://127.0.0.1:8000/transactions/transaction-upload', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    
    console.log('Proxy: Backend response status:', response.status);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Proxy: Backend error:', errorText);
      return NextResponse.json(
        { error: errorText || 'Backend request failed' },
        { status: response.status }
      );
    }
    
    const data = await response.json();
    console.log('Proxy: Backend response data:', data);
    
    return NextResponse.json(data);
  } catch (error) {
    console.error('Proxy: Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}