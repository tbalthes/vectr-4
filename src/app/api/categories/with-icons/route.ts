/**
 * Categories with Icons API Route
 * Returns all categories used by the current user's transactions, including their icons
 * Endpoint: GET /api/categories/with-icons
 */
import { NextResponse } from "next/server";

const CACHE_HEADERS = {
  "Cache-Control": "s-maxage=300, stale-while-revalidate=600", // 5 min cache
};

export interface CategoryWithIcon {
  id: string;
  name: string;
  icon: string;
  transaction_count?: number;
}

const FASTAPI_BASE = process.env.FASTAPI_BASE_URL || "http://localhost:8000";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("user_id");

    // Build FastAPI URL for categories tree; include user_id if provided
    const fastApiUrl = userId
      ? `${FASTAPI_BASE}/categories/tree?user_id=${encodeURIComponent(
          userId
        )}&include_counts=true`
      : `${FASTAPI_BASE}/categories/tree?include_counts=true`;
    const response = await fetch(fastApiUrl);

    if (!response.ok) {
      throw new Error(`FastAPI responded with ${response.status}`);
    }

    const treeData = await response.json();

    // Flatten tree into a simple array of categories
    const flatten: Record<string, any>[] = [];
    const walk = (nodes: any[]) => {
      for (const n of nodes || []) {
        flatten.push({
          id: n.id,
          name: n.name,
          icon: n.icon,
          transaction_count: n.transaction_count || 0,
        });
        if (n.children && n.children.length > 0) {walk(n.children);}
      }
    };

    walk(treeData.categories || []);

    return NextResponse.json({ data: flatten }, { headers: CACHE_HEADERS });
  } catch (error) {
    console.error("Categories API error:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch categories",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
