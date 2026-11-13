REVOKE CREATE ON SCHEMA public FROM PUBLIC;
CREATE TABLE tenants (
 id uuid PRIMARY KEY, slug text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9-]{2,60}$'), name text NOT NULL,
 mode text NOT NULL CHECK (mode IN ('single-business','saas')), created_at timestamptz NOT NULL DEFAULT now()
);
CREATE FUNCTION resolve_tenant(requested_slug text) RETURNS uuid LANGUAGE sql SECURITY DEFINER SET search_path = public, pg_temp AS $$ SELECT id FROM public.tenants WHERE slug = requested_slug $$;
REVOKE ALL ON FUNCTION resolve_tenant(text) FROM PUBLIC;
CREATE TABLE factories (
 tenant_id uuid NOT NULL REFERENCES tenants(id), id uuid NOT NULL, name text NOT NULL,
 PRIMARY KEY (tenant_id,id), UNIQUE (tenant_id,name)
);
CREATE TABLE memberships (
 tenant_id uuid NOT NULL REFERENCES tenants(id), id uuid NOT NULL, email text NOT NULL, display_name text NOT NULL,
 password_hash text NOT NULL, active boolean NOT NULL DEFAULT true, main_admin boolean NOT NULL DEFAULT false,
 PRIMARY KEY (tenant_id,id), UNIQUE(tenant_id,email), CHECK(email = lower(email))
);
CREATE TABLE role_assignments (
 tenant_id uuid NOT NULL, membership_id uuid NOT NULL, factory_id uuid NOT NULL,
 department text NOT NULL CHECK(department IN ('Merchandising','Planning','Commercial','Store','Cutting','Sewing','Packing','Quality')),
 role text NOT NULL CHECK(role IN ('staff','head')),
 PRIMARY KEY(tenant_id,membership_id,factory_id,department),
 FOREIGN KEY(tenant_id,membership_id) REFERENCES memberships(tenant_id,id),
 FOREIGN KEY(tenant_id,factory_id) REFERENCES factories(tenant_id,id)
);
CREATE TABLE sessions (
 tenant_id uuid NOT NULL, id uuid NOT NULL, membership_id uuid NOT NULL, token_hash text NOT NULL UNIQUE,
 expires_at timestamptz NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(tenant_id,id), FOREIGN KEY(tenant_id,membership_id) REFERENCES memberships(tenant_id,id)
);
CREATE INDEX sessions_expiry ON sessions(expires_at);
CREATE TABLE factory_notes (
 tenant_id uuid NOT NULL, id uuid NOT NULL, factory_id uuid NOT NULL, actor_id uuid NOT NULL,
 department text NOT NULL CHECK(department IN ('Merchandising','Planning','Commercial','Store','Cutting','Sewing','Packing','Quality')),
 body text NOT NULL CHECK(length(body) BETWEEN 1 AND 1000), created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(tenant_id,id), FOREIGN KEY(tenant_id,factory_id) REFERENCES factories(tenant_id,id),
 FOREIGN KEY(tenant_id,actor_id) REFERENCES memberships(tenant_id,id)
);
CREATE INDEX factory_notes_queue ON factory_notes(tenant_id,factory_id,department,created_at DESC);
CREATE TABLE audit_events (
 tenant_id uuid NOT NULL, id uuid NOT NULL, actor_id uuid NOT NULL, action text NOT NULL,
 target_id uuid, created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(tenant_id,id),
 FOREIGN KEY(tenant_id,actor_id) REFERENCES memberships(tenant_id,id)
);
CREATE INDEX audit_events_recent ON audit_events(tenant_id,created_at DESC);
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['factories','memberships','role_assignments','sessions','factory_notes','audit_events'] LOOP
 EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',t);
 EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY',t);
 EXECUTE format($policy$CREATE POLICY tenant_boundary ON %I USING (tenant_id = nullif(current_setting('app.tenant_id',true),'')::uuid) WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id',true),'')::uuid)$policy$,t);
 END LOOP;
END $$;
