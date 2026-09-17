-- Run manually with a migration owner. No migration was applied during delivery.
BEGIN;
CREATE TABLE tenants (id text PRIMARY KEY, name text NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE memberships (tenant_id text NOT NULL REFERENCES tenants(id), user_id text NOT NULL, role text NOT NULL CHECK(role IN ('viewer','reviewer','approver','admin')), active boolean NOT NULL DEFAULT true, PRIMARY KEY(tenant_id,user_id));
CREATE TABLE sessions (token_hash text PRIMARY KEY, tenant_id text NOT NULL, user_id text NOT NULL, expires_at timestamptz NOT NULL, revoked_at timestamptz, FOREIGN KEY(tenant_id,user_id) REFERENCES memberships(tenant_id,user_id));
CREATE TABLE sources (tenant_id text NOT NULL REFERENCES tenants(id), id text NOT NULL, kind text NOT NULL CHECK(kind IN ('fixture','borrower_observation','public_aggregate','public_microdata')), publisher text NOT NULL, reference_period text NOT NULL, geography text NOT NULL, units text NOT NULL, access_terms text NOT NULL, public_url text, private_object_key text, checksum text NOT NULL, retrieved_at timestamptz NOT NULL, PRIMARY KEY(tenant_id,id));
CREATE TABLE borrowers (tenant_id text NOT NULL REFERENCES tenants(id), id text NOT NULL, display_name text NOT NULL, occupation text NOT NULL, currency text NOT NULL DEFAULT 'INR' CHECK(currency='INR'), consent_reference text NOT NULL, source_kind text NOT NULL CHECK(source_kind IN ('fixture','borrower_observation')), loan_version integer NOT NULL DEFAULT 1 CHECK(loan_version>0), updated_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(tenant_id,id));
CREATE INDEX borrower_list_idx ON borrowers(tenant_id,updated_at DESC,id DESC);
CREATE TABLE loan_snapshots (tenant_id text NOT NULL, borrower_id text NOT NULL, version integer NOT NULL, principal_paise bigint NOT NULL CHECK(principal_paise>=0), snapshot jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(tenant_id,borrower_id,version), FOREIGN KEY(tenant_id,borrower_id) REFERENCES borrowers(tenant_id,id));
CREATE TABLE policies (tenant_id text NOT NULL REFERENCES tenants(id), id text NOT NULL, policy jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(tenant_id,id));
CREATE TABLE snapshots (tenant_id text NOT NULL, id text NOT NULL, borrower_id text NOT NULL, loan_version integer NOT NULL, content_hash text NOT NULL, body jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(tenant_id,id), FOREIGN KEY(tenant_id,borrower_id,loan_version) REFERENCES loan_snapshots(tenant_id,borrower_id,version));
CREATE TABLE evaluations (tenant_id text NOT NULL, id text NOT NULL, borrower_id text NOT NULL, snapshot_id text NOT NULL, policy_id text NOT NULL, loan_version integer NOT NULL, request jsonb NOT NULL, engine_version text NOT NULL, scenario_hash text NOT NULL, seed integer NOT NULL DEFAULT 0, status text NOT NULL DEFAULT 'queued' CHECK(status IN ('queued','running','complete','failed')), stage text NOT NULL DEFAULT 'queued', error_code text, result_hash text, lease_until timestamptz, attempt_token text, created_at timestamptz NOT NULL DEFAULT now(), completed_at timestamptz, PRIMARY KEY(tenant_id,id), FOREIGN KEY(tenant_id,borrower_id) REFERENCES borrowers(tenant_id,id), FOREIGN KEY(tenant_id,snapshot_id) REFERENCES snapshots(tenant_id,id), FOREIGN KEY(tenant_id,policy_id) REFERENCES policies(tenant_id,id));
CREATE INDEX evaluation_history_idx ON evaluations(tenant_id,borrower_id,created_at DESC);
CREATE INDEX evaluation_queue_idx ON evaluations(tenant_id,status,created_at);
CREATE TABLE evaluation_results (tenant_id text NOT NULL, evaluation_id text NOT NULL, body jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(tenant_id,evaluation_id), FOREIGN KEY(tenant_id,evaluation_id) REFERENCES evaluations(tenant_id,id));
CREATE TABLE candidate_plans (tenant_id text NOT NULL, evaluation_id text NOT NULL, plan_id text NOT NULL, feasible boolean NOT NULL, schedule jsonb NOT NULL, summary jsonb NOT NULL, PRIMARY KEY(tenant_id,evaluation_id,plan_id), FOREIGN KEY(tenant_id,evaluation_id) REFERENCES evaluations(tenant_id,id));
CREATE TABLE plan_ledgers (tenant_id text NOT NULL, evaluation_id text NOT NULL, plan_id text NOT NULL, scenario_id text NOT NULL, rows jsonb NOT NULL, PRIMARY KEY(tenant_id,evaluation_id,plan_id,scenario_id), FOREIGN KEY(tenant_id,evaluation_id,plan_id) REFERENCES candidate_plans(tenant_id,evaluation_id,plan_id));
CREATE TABLE idempotency_keys (tenant_id text NOT NULL REFERENCES tenants(id), route text NOT NULL, key text NOT NULL, request_hash text NOT NULL, response jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(tenant_id,route,key));
CREATE TABLE outbox (tenant_id text NOT NULL REFERENCES tenants(id), id text NOT NULL, aggregate_id text NOT NULL, kind text NOT NULL CHECK(kind IN ('evaluation','import')), payload_version integer NOT NULL DEFAULT 1, delivered_at timestamptz, attempts integer NOT NULL DEFAULT 0, available_at timestamptz NOT NULL DEFAULT now(), created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(tenant_id,id), UNIQUE(tenant_id,kind,aggregate_id));
CREATE INDEX outbox_pending_idx ON outbox(tenant_id,available_at) WHERE delivered_at IS NULL;
CREATE TABLE imports (tenant_id text NOT NULL, id text NOT NULL, borrower_id text NOT NULL, source_id text NOT NULL, consent_reference text NOT NULL, request_hash text NOT NULL, records jsonb NOT NULL, status text NOT NULL DEFAULT 'queued' CHECK(status IN ('queued','complete','failed')), report jsonb, created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(tenant_id,id), FOREIGN KEY(tenant_id,borrower_id) REFERENCES borrowers(tenant_id,id), FOREIGN KEY(tenant_id,source_id) REFERENCES sources(tenant_id,id));
CREATE TABLE transactions (tenant_id text NOT NULL, borrower_id text NOT NULL, source_id text NOT NULL, source_key text NOT NULL, occurred_on date NOT NULL, amount_paise bigint NOT NULL CHECK(amount_paise>=0), kind text NOT NULL, record jsonb NOT NULL, import_id text NOT NULL, PRIMARY KEY(tenant_id,borrower_id,source_id,source_key), FOREIGN KEY(tenant_id,borrower_id) REFERENCES borrowers(tenant_id,id), FOREIGN KEY(tenant_id,source_id) REFERENCES sources(tenant_id,id), FOREIGN KEY(tenant_id,import_id) REFERENCES imports(tenant_id,id));
CREATE TABLE selections (tenant_id text NOT NULL, id text NOT NULL, evaluation_id text NOT NULL, plan_id text NOT NULL, borrower_id text NOT NULL, expected_loan_version integer NOT NULL, reviewer_id text NOT NULL, reason text NOT NULL, state text NOT NULL DEFAULT 'reviewed' CHECK(state IN ('draft','reviewed','approved','activated','rejected','superseded')), consent_reference text, approved_by text, created_at timestamptz NOT NULL DEFAULT now(), approved_at timestamptz, PRIMARY KEY(tenant_id,id), FOREIGN KEY(tenant_id,evaluation_id,plan_id) REFERENCES candidate_plans(tenant_id,evaluation_id,plan_id), FOREIGN KEY(tenant_id,borrower_id) REFERENCES borrowers(tenant_id,id));
-- Written only by a trusted daily-event verification integration, never by an HTTP caller.
CREATE TABLE daily_replay_checks (tenant_id text NOT NULL, id text NOT NULL, evaluation_id text NOT NULL, plan_id text NOT NULL, snapshot_hash text NOT NULL, passed boolean NOT NULL, evidence_hash text NOT NULL, verifier_version text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(tenant_id,id), FOREIGN KEY(tenant_id,evaluation_id,plan_id) REFERENCES candidate_plans(tenant_id,evaluation_id,plan_id));
CREATE TABLE schedule_versions (tenant_id text NOT NULL, borrower_id text NOT NULL, version integer NOT NULL, selection_id text NOT NULL, schedule jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(tenant_id,borrower_id,version), UNIQUE(tenant_id,selection_id), FOREIGN KEY(tenant_id,borrower_id) REFERENCES borrowers(tenant_id,id), FOREIGN KEY(tenant_id,selection_id) REFERENCES selections(tenant_id,id));
CREATE TABLE audit_events (tenant_id text NOT NULL REFERENCES tenants(id), id text NOT NULL, actor_id text NOT NULL, action text NOT NULL, record_id text NOT NULL, request_id text NOT NULL, summary jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(tenant_id,id));
CREATE FUNCTION forbid_mutation() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Immutable record'; END $$;
CREATE TRIGGER snapshots_immutable BEFORE UPDATE OR DELETE ON snapshots FOR EACH ROW EXECUTE FUNCTION forbid_mutation();
CREATE TRIGGER policies_immutable BEFORE UPDATE OR DELETE ON policies FOR EACH ROW EXECUTE FUNCTION forbid_mutation();
CREATE TRIGGER results_immutable BEFORE UPDATE OR DELETE ON evaluation_results FOR EACH ROW EXECUTE FUNCTION forbid_mutation();
CREATE TRIGGER audit_immutable BEFORE UPDATE OR DELETE ON audit_events FOR EACH ROW EXECUTE FUNCTION forbid_mutation();
CREATE TRIGGER loans_immutable BEFORE UPDATE OR DELETE ON loan_snapshots FOR EACH ROW EXECUTE FUNCTION forbid_mutation();
CREATE TRIGGER schedules_immutable BEFORE UPDATE OR DELETE ON schedule_versions FOR EACH ROW EXECUTE FUNCTION forbid_mutation();
DO $$ DECLARE tab text; BEGIN
  FOREACH tab IN ARRAY ARRAY['memberships','sources','borrowers','loan_snapshots','policies','snapshots','evaluations','evaluation_results','candidate_plans','plan_ledgers','idempotency_keys','outbox','imports','transactions','selections','daily_replay_checks','schedule_versions','audit_events'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',tab);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY',tab);
    EXECUTE format('CREATE POLICY tenant_scope ON %I USING (tenant_id = current_setting(''app.tenant_id'', true)) WITH CHECK (tenant_id = current_setting(''app.tenant_id'', true))',tab);
  END LOOP;
END $$;
-- A fixed-search-path function accepts only a high entropy session-token hash.
-- The migration owner must be a separate trusted administrator (typically postgres).
CREATE FUNCTION resolve_session(hash text) RETURNS TABLE(tenant_id text,user_id text,role text) LANGUAGE sql SECURITY DEFINER SET search_path = pg_catalog,public AS $$
  SELECT s.tenant_id,s.user_id,m.role FROM public.sessions s JOIN public.memberships m ON m.tenant_id=s.tenant_id AND m.user_id=s.user_id WHERE s.token_hash=hash AND s.expires_at>now() AND s.revoked_at IS NULL AND m.active=true LIMIT 1
$$;
REVOKE ALL ON FUNCTION resolve_session(text) FROM PUBLIC;
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM PUBLIC;
-- Provision login credentials separately. The application must never use the migration owner.
DO $$ BEGIN IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='domino_runtime') THEN CREATE ROLE domino_runtime NOLOGIN NOSUPERUSER NOBYPASSRLS; END IF; END $$;
GRANT USAGE ON SCHEMA public TO domino_runtime;
GRANT SELECT,INSERT ON borrowers,loan_snapshots,sources,policies,snapshots,evaluations,evaluation_results,candidate_plans,plan_ledgers,idempotency_keys,outbox,imports,transactions,selections,schedule_versions,audit_events TO domino_runtime;
GRANT UPDATE ON borrowers,evaluations,outbox,imports,selections TO domino_runtime;
GRANT SELECT ON daily_replay_checks TO domino_runtime;
GRANT EXECUTE ON FUNCTION resolve_session(text) TO domino_runtime;
COMMIT;
