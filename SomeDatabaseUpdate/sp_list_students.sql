-- ============================================================
--  Stored function: fn_list_students
--  Returns paginated student list + total count in ONE call.
--  Replaces the two-query (count + select) pattern with a single
--  round-trip, using a window function for the count.
--
--  Run: psql -U postgres -d sms_db -f sp_list_students.sql
-- ============================================================

CREATE OR REPLACE FUNCTION fn_list_students(
    p_tenant_id        UUID,
    p_search            TEXT      DEFAULT NULL,
    p_gender            VARCHAR   DEFAULT NULL,
    p_is_active         BOOLEAN   DEFAULT TRUE,
    p_grade_id          UUID      DEFAULT NULL,
    p_section_id        UUID      DEFAULT NULL,
    p_academic_year_id  UUID      DEFAULT NULL,
    p_skip              INT       DEFAULT 0,
    p_limit             INT       DEFAULT 50
)
RETURNS TABLE (
    id              UUID,
    first_name      VARCHAR,
    last_name       VARCHAR,
    admission_no    VARCHAR,
    gender          VARCHAR,
    photo_url       TEXT,
    aadhar_no       VARCHAR,
    is_active       BOOLEAN,
    admitted_on     DATE,
    current_section TEXT,
    total_count     BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        s.id,
        s.first_name,
        s.last_name,
        s.admission_no,
        s.gender,
        s.photo_url,
        (s.custom_fields->>'aadhar_no')::VARCHAR AS aadhar_no,
        s.is_active,
        s.admitted_on,
        (g.name || ' - ' || sec.name) AS current_section,
        COUNT(*) OVER() AS total_count   -- window function: total rows BEFORE limit/offset
    FROM students s
    LEFT JOIN student_enrollments se
        ON se.student_id = s.id
       AND se.status = 'active'
       AND (p_academic_year_id IS NULL OR se.academic_year_id = p_academic_year_id)
    LEFT JOIN sections sec ON sec.id = se.section_id
    LEFT JOIN grades   g   ON g.id   = sec.grade_id
    WHERE s.tenant_id = p_tenant_id
      AND (p_is_active IS NULL OR s.is_active = p_is_active)
      AND (p_gender IS NULL OR s.gender = p_gender)
      AND (p_search IS NULL OR (
            s.first_name   ILIKE '%' || p_search || '%' OR
            s.last_name    ILIKE '%' || p_search || '%' OR
            s.admission_no ILIKE '%' || p_search || '%'
          ))
      AND (p_section_id IS NULL OR se.section_id = p_section_id)
      AND (p_grade_id   IS NULL OR sec.grade_id  = p_grade_id)
    ORDER BY s.first_name
    OFFSET p_skip
    LIMIT  p_limit;
END;
$$ LANGUAGE plpgsql STABLE;

-- Quick test (replace with a real tenant_id from your DB):
-- SELECT * FROM fn_list_students('aaaaaaaa-0000-0000-0000-000000000001'::uuid, NULL, NULL, TRUE, NULL, NULL, NULL, 0, 20);
