-- Two tables the web reads that came after 0009's list and were never granted to it: a repository's
-- providers (every repository page) and the surface diffs behind /api/app/reach. An instance whose
-- role had no default privileges answered "permission denied" and every repository page failed.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'teire_web') THEN
    GRANT SELECT ON TABLE repo_providers, surface_diffs TO teire_web;
  END IF;
END
$$;
