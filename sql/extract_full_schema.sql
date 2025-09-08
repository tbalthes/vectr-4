-- =============================================================================
-- COMPLETE DATABASE SCHEMA EXTRACTION FOR AI ANALYSIS
-- Run these queries to get full schema details for public and user schemas
-- =============================================================================

-- 1. GET ALL TABLES WITH BASIC INFO
-- =============================================================================
SELECT 
    schemaname,
    tablename,
    tableowner,
    hasindexes,
    hasrules,
    hastriggers,
    rowsecurity
FROM pg_tables 
WHERE schemaname IN ('public', 'user')
ORDER BY schemaname, tablename;

-- 2. GET ALL COLUMNS WITH DETAILED INFO
-- =============================================================================
SELECT 
    t.table_schema,
    t.table_name,
    t.column_name,
    t.ordinal_position,
    t.column_default,
    t.is_nullable,
    t.data_type,
    t.character_maximum_length,
    t.numeric_precision,
    t.numeric_scale,
    t.is_identity,
    t.identity_generation,
    t.is_generated,
    t.generation_expression,
    t.is_updatable,
    -- Check if column is part of primary key
    CASE WHEN pk.column_name IS NOT NULL THEN 'YES' ELSE 'NO' END as is_primary_key,
    -- Check if column is part of foreign key
    CASE WHEN fk.column_name IS NOT NULL THEN 'YES' ELSE 'NO' END as is_foreign_key,
    fk.foreign_table_schema,
    fk.foreign_table_name,
    fk.foreign_column_name,
    -- Get column comments
    col_description(pgc.oid, t.ordinal_position) as column_comment
FROM information_schema.columns t
LEFT JOIN (
    -- Primary key columns
    SELECT 
        kcu.table_schema,
        kcu.table_name, 
        kcu.column_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu 
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
    WHERE tc.constraint_type = 'PRIMARY KEY'
) pk ON t.table_schema = pk.table_schema 
    AND t.table_name = pk.table_name 
    AND t.column_name = pk.column_name
LEFT JOIN (
    -- Foreign key columns
    SELECT 
        kcu.table_schema,
        kcu.table_name,
        kcu.column_name,
        ccu.table_schema AS foreign_table_schema,
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu 
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage ccu 
        ON ccu.constraint_name = tc.constraint_name
        AND ccu.table_schema = tc.table_schema
    WHERE tc.constraint_type = 'FOREIGN KEY'
) fk ON t.table_schema = fk.table_schema 
    AND t.table_name = fk.table_name 
    AND t.column_name = fk.column_name
LEFT JOIN pg_class pgc ON pgc.relname = t.table_name
WHERE t.table_schema IN ('public', 'user')
ORDER BY t.table_schema, t.table_name, t.ordinal_position;

-- 3. GET ALL CONSTRAINTS (PRIMARY KEYS, FOREIGN KEYS, UNIQUE, CHECK)
-- =============================================================================
SELECT 
    tc.constraint_schema,
    tc.table_name,
    tc.constraint_name,
    tc.constraint_type,
    kcu.column_name,
    -- For foreign keys, get referenced table info
    ccu.table_schema AS foreign_table_schema,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name,
    -- Get constraint definition for check constraints
    cc.check_clause,
    -- Get referential actions for foreign keys
    rc.update_rule,
    rc.delete_rule
FROM information_schema.table_constraints tc
LEFT JOIN information_schema.key_column_usage kcu 
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
LEFT JOIN information_schema.constraint_column_usage ccu 
    ON ccu.constraint_name = tc.constraint_name
    AND ccu.table_schema = tc.table_schema
LEFT JOIN information_schema.check_constraints cc
    ON cc.constraint_name = tc.constraint_name
    AND cc.constraint_schema = tc.constraint_schema
LEFT JOIN information_schema.referential_constraints rc
    ON rc.constraint_name = tc.constraint_name
    AND rc.constraint_schema = tc.constraint_schema
WHERE tc.table_schema IN ('public', 'user')
ORDER BY tc.table_schema, tc.table_name, tc.constraint_type, tc.constraint_name;

-- 4. GET ALL INDEXES
-- =============================================================================
SELECT 
    schemaname,
    tablename,
    indexname,
    indexdef,
    -- Parse if it's unique, partial, etc.
    CASE WHEN indexdef ILIKE '%UNIQUE%' THEN 'YES' ELSE 'NO' END as is_unique,
    CASE WHEN indexdef ILIKE '%WHERE %' THEN 'YES' ELSE 'NO' END as is_partial,
    CASE WHEN indexdef ILIKE '%USING btree%' THEN 'btree'
         WHEN indexdef ILIKE '%USING hash%' THEN 'hash'
         WHEN indexdef ILIKE '%USING gin%' THEN 'gin'
         WHEN indexdef ILIKE '%USING gist%' THEN 'gist'
         ELSE 'unknown' END as index_type
FROM pg_indexes 
WHERE schemaname IN ('public', 'user')
ORDER BY schemaname, tablename, indexname;

-- 5. GET ALL VIEWS
-- =============================================================================
SELECT 
    table_schema,
    table_name as view_name,
    view_definition,
    check_option,
    is_updatable,
    is_insertable_into,
    is_trigger_updatable,
    is_trigger_deletable,
    is_trigger_insertable_into
FROM information_schema.views 
WHERE table_schema IN ('public', 'user')
ORDER BY table_schema, table_name;

-- 6. GET ALL FUNCTIONS/PROCEDURES
-- =============================================================================
SELECT 
    n.nspname as schema_name,
    p.proname as function_name,
    pg_catalog.pg_get_function_result(p.oid) as return_type,
    pg_catalog.pg_get_function_arguments(p.oid) as arguments,
    p.prokind as function_type, -- 'f' = function, 'p' = procedure, 'a' = aggregate
    p.provolatile as volatility, -- 'i' = immutable, 's' = stable, 'v' = volatile
    p.prosrc as function_body,
    l.lanname as language
FROM pg_proc p
LEFT JOIN pg_namespace n ON n.oid = p.pronamespace
LEFT JOIN pg_language l ON l.oid = p.prolang
WHERE n.nspname IN ('public', 'user')
    AND p.prokind IN ('f', 'p') -- functions and procedures only
ORDER BY n.nspname, p.proname;

-- 7. GET ALL TRIGGERS
-- =============================================================================
SELECT 
    trigger_schema,
    trigger_name,
    event_manipulation,
    event_object_schema,
    event_object_table,
    action_statement,
    action_timing,
    action_condition,
    action_orientation
FROM information_schema.triggers 
WHERE trigger_schema IN ('public', 'user')
ORDER BY trigger_schema, event_object_table, trigger_name;

-- 8. GET ROW LEVEL SECURITY (RLS) POLICIES
-- =============================================================================
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE schemaname IN ('public', 'user')
ORDER BY schemaname, tablename, policyname;

-- 9. GET TABLE COMMENTS AND DESCRIPTIONS
-- =============================================================================
SELECT 
    n.nspname as schema_name,
    c.relname as table_name,
    c.relkind as object_type, -- 'r' = table, 'v' = view, 'i' = index, etc.
    obj_description(c.oid) as table_comment
FROM pg_class c
LEFT JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname IN ('public', 'user')
    AND c.relkind IN ('r', 'v') -- tables and views
    AND obj_description(c.oid) IS NOT NULL
ORDER BY n.nspname, c.relname;

-- 10. GET ENUM TYPES
-- =============================================================================
SELECT 
    n.nspname as schema_name,
    t.typname as enum_name,
    array_agg(e.enumlabel ORDER BY e.enumsortorder) as enum_values
FROM pg_type t
JOIN pg_enum e ON t.oid = e.enumtypid
JOIN pg_namespace n ON n.oid = t.typnamespace
WHERE n.nspname IN ('public', 'user')
GROUP BY n.nspname, t.typname
ORDER BY n.nspname, t.typname;

-- 11. GET TABLE SIZES AND ROW COUNTS
-- =============================================================================
SELECT 
    schemaname,
    relname as table_name,
    n_tup_ins as inserts,
    n_tup_upd as updates,
    n_tup_del as deletes,
    n_live_tup as live_rows,
    n_dead_tup as dead_rows,
    last_vacuum,
    last_autovacuum,
    last_analyze,
    last_autoanalyze
FROM pg_stat_user_tables 
WHERE schemaname IN ('public', 'user')
ORDER BY schemaname, relname;

-- 12. GET SEQUENCES
-- =============================================================================
SELECT 
    sequence_schema,
    sequence_name,
    data_type,
    numeric_precision,
    numeric_scale,
    start_value,
    minimum_value,
    maximum_value,
    increment,
    cycle_option
FROM information_schema.sequences 
WHERE sequence_schema IN ('public', 'user')
ORDER BY sequence_schema, sequence_name;
