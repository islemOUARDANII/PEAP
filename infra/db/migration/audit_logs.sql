CREATE SCHEMA IF NOT EXISTS audit;

CREATE TABLE IF NOT EXISTS audit.audit_event (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    event_time TIMESTAMPTZ NOT NULL DEFAULT now(),

    event_category TEXT NOT NULL,
    event_type TEXT NOT NULL,
    severity TEXT NOT NULL DEFAULT 'INFO',

    actor_user_id UUID NULL REFERENCES iam.auth_user(id) ON DELETE SET NULL,
    actor_email TEXT NULL,
    actor_roles TEXT[] NULL,

    entity_type TEXT NULL,
    entity_id TEXT NULL,

    action TEXT NULL,
    status TEXT NULL,

    request_id TEXT NULL,
    trace_id TEXT NULL,
    correlation_id TEXT NULL,

    ip_address TEXT NULL,
    user_agent TEXT NULL,
    request_method TEXT NULL,
    request_path TEXT NULL,

    message TEXT NULL,
    error_code TEXT NULL,
    error_message TEXT NULL,

    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

    CONSTRAINT ck_audit_event_category CHECK (
        event_category IN (
            'AUTH',
            'SECURITY',
            'USER_ACTIVITY',
            'BUSINESS',
            'PIPELINE'
        )
    ),

    CONSTRAINT ck_audit_event_severity CHECK (
        severity IN (
            'INFO',
            'WARNING',
            'ERROR',
            'CRITICAL'
        )
    )
);

COMMENT ON TABLE audit.audit_event IS
'Structured audit, security, business, and pipeline events. Not intended for raw technical debug logs.';

CREATE INDEX IF NOT EXISTS idx_audit_event_time
ON audit.audit_event(event_time DESC);

CREATE INDEX IF NOT EXISTS idx_audit_event_category_type
ON audit.audit_event(event_category, event_type);

CREATE INDEX IF NOT EXISTS idx_audit_event_actor
ON audit.audit_event(actor_user_id);

CREATE INDEX IF NOT EXISTS idx_audit_event_actor_email
ON audit.audit_event(lower(actor_email));

CREATE INDEX IF NOT EXISTS idx_audit_event_entity
ON audit.audit_event(entity_type, entity_id);

CREATE INDEX IF NOT EXISTS idx_audit_event_trace
ON audit.audit_event(trace_id);

CREATE INDEX IF NOT EXISTS idx_audit_event_status
ON audit.audit_event(status);

CREATE INDEX IF NOT EXISTS idx_audit_event_severity
ON audit.audit_event(severity);

CREATE INDEX IF NOT EXISTS idx_audit_event_metadata_gin
ON audit.audit_event USING GIN (metadata);
