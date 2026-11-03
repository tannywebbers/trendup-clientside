-- ====================================================
-- Supabase/PostgreSQL Full Reset Script
-- WARNING: This will delete ALL your data, tables,
-- triggers, functions, views, and RLS policies in the public schema.
-- ====================================================

-- 1. Drop all triggers
DO
$$
DECLARE
    trig RECORD;
BEGIN
    FOR trig IN
        SELECT event_object_table AS table_name, trigger_name
        FROM information_schema.triggers
        WHERE trigger_schema = 'public'
    LOOP
        EXECUTE format('DROP TRIGGER IF EXISTS %I ON %I CASCADE;', trig.trigger_name, trig.table_name);
    END LOOP;
END
$$;

-- 2. Drop all functions in public schema
DO
$$
DECLARE
    func RECORD;
BEGIN
    FOR func IN
        SELECT routine_name
        FROM information_schema.routines
        WHERE routine_schema = 'public'
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS %I CASCADE;', func.routine_name);
    END LOOP;
END
$$;

-- 3. Drop all tables in public schema
DO
$$
DECLARE
    tbl RECORD;
BEGIN
    FOR tbl IN
        SELECT tablename
        FROM pg_tables
        WHERE schemaname = 'public'
    LOOP
        EXECUTE format('DROP TABLE IF EXISTS %I CASCADE;', tbl.tablename);
    END LOOP;
END
$$;

-- 4. Drop all views in public schema
DO
$$
DECLARE
    vw RECORD;
BEGIN
    FOR vw IN
        SELECT table_name
        FROM information_schema.views
        WHERE table_schema = 'public'
    LOOP
        EXECUTE format('DROP VIEW IF EXISTS %I CASCADE;', vw.table_name);
    END LOOP;
END
$$;

-- 5. Drop all RLS policies and disable RLS
DO
$$
DECLARE
    tbl RECORD;
BEGIN
    FOR tbl IN
        SELECT tablename
        FROM pg_tables
        WHERE schemaname = 'public'
    LOOP
        BEGIN
            EXECUTE format('ALTER TABLE %I DISABLE ROW LEVEL SECURITY;', tbl.tablename);
        EXCEPTION WHEN OTHERS THEN
            -- ignore errors if table cannot disable RLS
            NULL;
        END;
        BEGIN
            EXECUTE format('DROP POLICY IF EXISTS ALL ON %I;', tbl.tablename);
        EXCEPTION WHEN OTHERS THEN
            NULL;
        END;
    END LOOP;
END
$$;

-- 6. Reset sequences to start from 1
DO
$$
DECLARE
    seq RECORD;
BEGIN
    FOR seq IN
        SELECT sequence_name
        FROM information_schema.sequences
        WHERE sequence_schema = 'public'
    LOOP
        EXECUTE format('ALTER SEQUENCE %I RESTART WITH 1;', seq.sequence_name);
    END LOOP;
END
$$;

-- 7. Optional notice
DO
$$
BEGIN
    RAISE NOTICE 'All tables, triggers, functions, views, and RLS policies in public schema have been cleared.';
END
$$;
