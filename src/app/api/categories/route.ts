import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

import { createSupabaseServerClient } from '@/lib/supabase-server';

interface CreateCategoryRequest {
  name: string;
  description?: string;
  category?: string;
  parent_category?: string;
  icon?: string;
  parent_id?: string | null;
  user_id?: string;
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createSupabaseServerClient();

    // Check authentication
    const { data: userData, error: userError } = await supabase.auth.getUser();
    const user = userError ? null : userData?.user;
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body: CreateCategoryRequest = await request.json();
    const {
      name,
      description,
      category,
      parent_category,
      icon = 'heart',
      parent_id,
      user_id,
    } = body;

    const finalUserId = user_id || user.id;
    console.log('Creating category for user:', finalUserId);
    console.log('Payload received:', {
      name,
      description,
      category,
      parent_category,
      icon,
      parent_id,
    });

    if (!name?.trim()) {
      return NextResponse.json({ error: 'Category name is required' }, { status: 400 });
    }

    // Check for duplicate categories for this user and parent
    const { data: existingCategories } = await supabase
      .from('categories')
      .select('name, parent_id')
      .eq('user_id', finalUserId)
      .eq('name', name.trim())
      .eq('parent_id', parent_id || null);

    if (existingCategories && existingCategories.length > 0) {
      return NextResponse.json(
        {
          error: 'A category with this name already exists in the selected parent group',
        },
        { status: 400 },
      );
    }

    // Create the new category - generate UUID for category_id
    const categoryId = crypto.randomUUID();
    console.log('Generated category_id:', categoryId);

    const insertData = {
      category_id: categoryId,
      category: category || name.trim().toUpperCase().replace(/\s+/g, '_'), // Use provided category or generate from name
      name: name.trim(),
      description: description || null,
      parent_category: parent_category || null,
      icon,
      parent_id: parent_id || null,
      user_id: finalUserId,
      plain_name: name.trim(),
      lucide_icon: icon,
    };

    console.log('About to insert:', insertData);

    const { data: newCategory, error } = await supabase
      .from('categories')
      .insert(insertData)
      .select(
        `
        category_id,
        category,
        name,
        description,
        parent_category,
        icon,
        parent_id,
        user_id,
        plain_name,
        lucide_icon
      `,
      )
      .single();

    console.log('Database response:', { data: newCategory, error });

    if (error) {
      console.error('Error creating category:', error);
      return NextResponse.json({ error: 'Failed to create category' }, { status: 500 });
    }

    if (!newCategory) {
      console.error('No category returned from database');
      return NextResponse.json(
        { error: 'Category creation failed - no data returned' },
        { status: 500 },
      );
    }

    console.log('Successfully created category:', newCategory);

    // Return the created category with proper structure
    const response = {
      category_id: newCategory.category_id,
      name: newCategory.name,
      icon: newCategory.icon || newCategory.lucide_icon,
      parent_id: newCategory.parent_id,
      children: [],
      depth: 0,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error in category creation:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const supabase = createSupabaseServerClient();

    const { data: userData, error: userError } = await supabase.auth.getUser();
    const user = userError ? null : userData?.user;
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('user_id') || user.id;

    const { data: categories, error } = await supabase
      .from('categories')
      .select(
        `
        category_id,
        name,
        icon,
        parent_id,
        user_id,
        plain_name,
        lucide_icon
      `,
      )
      .or(`user_id.is.null,user_id.eq.${userId}`)
      .order('name');

    if (error) {
      console.error('Error fetching categories:', error);
      return NextResponse.json({ error: 'Failed to fetch categories' }, { status: 500 });
    }

    return NextResponse.json({ data: categories });
  } catch (error) {
    console.error('Error in category fetch:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
