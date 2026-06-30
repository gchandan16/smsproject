-- ============================================================
--  FIX: Speed up the student list page
--  Run: psql -U postgres -d sms_db -f fix_student_list_performance.sql
--
--  Adds a composite index covering the exact lookup pattern used
--  by the (now-fixed) student list query: filtering enrollments
--  by student_id AND status='active' together. Without this,
--  Postgres has to scan all enrollment rows for a student before
--  filtering by status in memory.
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_enrollments_student_status
    ON student_enrollments(student_id, status);

-- Also helps the grade/section filter path in list_students
CREATE INDEX IF NOT EXISTS idx_enrollments_section_status
    ON student_enrollments(section_id, status);

-- Speeds up the search filter (first_name/last_name/admission_no ILIKE)
-- Requires the pg_trgm extension for fast partial-text matching.
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS idx_students_search_trgm
    ON students USING gin (
        (first_name || ' ' || COALESCE(last_name, '') || ' ' || admission_no) gin_trgm_ops
    );

-- Verify the new indexes exist
SELECT indexname, tablename
FROM pg_indexes
WHERE tablename IN ('student_enrollments', 'students')
  AND indexname LIKE 'idx_%'
ORDER BY tablename, indexname;
