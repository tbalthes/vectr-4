import { createClient } from '@supabase/supabase-js'

async function fixInstitutionsRLS() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  try {
    const { error } = await supabase.rpc('exec_sql', {
      sql: `
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM pg_policies WHERE tablename = 'institutions' AND policyname = 'institutions_insert_auth'
          ) THEN
            CREATE POLICY institutions_insert_auth ON public.institutions
              FOR INSERT TO authenticated WITH CHECK (true);
          END IF;
        END $$;
      `
    })

    if (error) {
      console.error('Failed to create policy:', error)
      return false
    }

    console.log('✅ Successfully created institutions INSERT policy')
    return true
  } catch (error) {
    console.error('Error:', error)
    return false
  }
}

// Test run
fixInstitutionsRLS().then(() => process.exit(0))
