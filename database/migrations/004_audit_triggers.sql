-- ProofVault Comprehensive Audit Triggers Migration
-- Migration: 004 - Comprehensive Audit Triggers
-- Created: 2025-01-25
-- Description: Complete audit trail system with automated triggers for all data changes

-- ============================================================================
-- ENHANCED AUDIT LOG STRUCTURE
-- ============================================================================

-- Add more detailed audit tracking fields
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS session_id VARCHAR(255);
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS application_name VARCHAR(100);
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS transaction_id BIGINT;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS before_after_size INTEGER;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS change_magnitude VARCHAR(20); -- 'minor', 'moderate', 'major', 'critical'
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS compliance_flags JSONB DEFAULT '{}';

-- Add indexes for audit performance
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_session ON audit_logs(session_id) WHERE session_id IS NOT NULL;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_transaction ON audit_logs(transaction_id) WHERE transaction_id IS NOT NULL;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_magnitude ON audit_logs(change_magnitude, occurred_at);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_compliance ON audit_logs USING gin(compliance_flags);

-- ============================================================================
-- AUDIT CONFIGURATION TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS audit_configuration (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    table_name VARCHAR(100) NOT NULL UNIQUE,
    audit_insert BOOLEAN DEFAULT true,
    audit_update BOOLEAN DEFAULT true,
    audit_delete BOOLEAN DEFAULT true,
    sensitive_columns JSONB DEFAULT '[]',
    excluded_columns JSONB DEFAULT '[]',
    retention_days INTEGER DEFAULT 2555, -- ~7 years
    compliance_level VARCHAR(20) DEFAULT 'standard', -- 'minimal', 'standard', 'strict'
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default audit configurations
INSERT INTO audit_configuration (table_name, audit_insert, audit_update, audit_delete, sensitive_columns, compliance_level) VALUES
('evidence_records', true, true, false, '["submitter_signature", "api_key_hash"]', 'strict'),
('blockchain_transactions', true, true, false, '["raw_transaction"]', 'standard'),
('verification_attempts', true, false, false, '["requester_ip"]', 'standard'),
('users', true, true, true, '["api_key_hash", "email"]', 'strict'),
('blockchain_batches', true, true, false, '[]', 'standard'),
('consensus_state', false, true, false, '[]', 'minimal'),
('network_metrics', false, false, false, '[]', 'minimal'),
('system_config', true, true, true, '[]', 'strict')
ON CONFLICT (table_name) DO NOTHING;

-- ============================================================================
-- ENHANCED AUDIT TRIGGER FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION generic_audit_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    audit_config RECORD;
    old_values JSONB := NULL;
    new_values JSONB := NULL;
    changed_columns TEXT[] := ARRAY[]::TEXT[];
    sensitive_data_changed BOOLEAN := false;
    change_magnitude VARCHAR(20) := 'minor';
    compliance_flags JSONB := '{}';
    session_info RECORD;
    column_name TEXT;
    old_val TEXT;
    new_val TEXT;
BEGIN
    -- Get audit configuration for this table
    SELECT * INTO audit_config 
    FROM audit_configuration 
    WHERE table_name = TG_TABLE_NAME AND is_active = true;
    
    -- If no config found or not active, skip auditing
    IF NOT FOUND THEN
        RETURN COALESCE(NEW, OLD);
    END IF;
    
    -- Check if we should audit this operation
    IF (TG_OP = 'INSERT' AND NOT audit_config.audit_insert) OR
       (TG_OP = 'UPDATE' AND NOT audit_config.audit_update) OR
       (TG_OP = 'DELETE' AND NOT audit_config.audit_delete) THEN
        RETURN COALESCE(NEW, OLD);
    END IF;
    
    -- Get session information
    SELECT 
        current_setting('application_name', true) as app_name,
        current_setting('proofvault.session_id', true) as session_id,
        txid_current() as transaction_id
    INTO session_info;
    
    -- Process the audit based on operation type
    IF TG_OP = 'DELETE' THEN
        old_values := to_jsonb(OLD);
        
        -- Remove excluded columns
        IF audit_config.excluded_columns IS NOT NULL THEN
            FOR column_name IN SELECT jsonb_array_elements_text(audit_config.excluded_columns)
            LOOP
                old_values := old_values - column_name;
            END LOOP;
        END IF;
        
        change_magnitude := 'critical';
        compliance_flags := jsonb_build_object('data_deletion', true);
        
    ELSIF TG_OP = 'INSERT' THEN
        new_values := to_jsonb(NEW);
        
        -- Remove excluded columns
        IF audit_config.excluded_columns IS NOT NULL THEN
            FOR column_name IN SELECT jsonb_array_elements_text(audit_config.excluded_columns)
            LOOP
                new_values := new_values - column_name;
            END LOOP;
        END IF;
        
        change_magnitude := 'moderate';
        compliance_flags := jsonb_build_object('data_creation', true);
        
    ELSIF TG_OP = 'UPDATE' THEN
        old_values := to_jsonb(OLD);
        new_values := to_jsonb(NEW);
        
        -- Find changed columns
        FOR column_name IN SELECT key FROM jsonb_each(new_values)
        LOOP
            old_val := old_values ->> column_name;
            new_val := new_values ->> column_name;
            
            IF old_val IS DISTINCT FROM new_val THEN
                changed_columns := array_append(changed_columns, column_name);
                
                -- Check if sensitive data changed
                IF audit_config.sensitive_columns IS NOT NULL AND 
                   column_name = ANY(SELECT jsonb_array_elements_text(audit_config.sensitive_columns)) THEN
                    sensitive_data_changed := true;
                END IF;
            END IF;
        END LOOP;
        
        -- Remove excluded columns
        IF audit_config.excluded_columns IS NOT NULL THEN
            FOR column_name IN SELECT jsonb_array_elements_text(audit_config.excluded_columns)
            LOOP
                old_values := old_values - column_name;
                new_values := new_values - column_name;
            END LOOP;
        END IF;
        
        -- Determine change magnitude
        IF array_length(changed_columns, 1) = 0 THEN
            RETURN NEW; -- No actual changes
        ELSIF sensitive_data_changed THEN
            change_magnitude := 'critical';
        ELSIF array_length(changed_columns, 1) > 5 THEN
            change_magnitude := 'major';
        ELSIF array_length(changed_columns, 1) > 2 THEN
            change_magnitude := 'moderate';
        ELSE
            change_magnitude := 'minor';
        END IF;
        
        compliance_flags := jsonb_build_object(
            'sensitive_data_changed', sensitive_data_changed,
            'changed_columns_count', array_length(changed_columns, 1),
            'changed_columns', changed_columns
        );
    END IF;
    
    -- Special compliance flags based on table and data
    IF TG_TABLE_NAME = 'evidence_records' THEN
        IF TG_OP = 'UPDATE' AND 'status' = ANY(changed_columns) THEN
            compliance_flags := compliance_flags || jsonb_build_object('status_change', true);
        END IF;
        IF TG_OP = 'UPDATE' AND 'hash' = ANY(changed_columns) THEN
            compliance_flags := compliance_flags || jsonb_build_object('critical_hash_change', true);
            change_magnitude := 'critical';
        END IF;
    ELSIF TG_TABLE_NAME = 'users' THEN
        IF TG_OP = 'UPDATE' AND ('api_key_hash' = ANY(changed_columns) OR 'is_active' = ANY(changed_columns)) THEN
            compliance_flags := compliance_flags || jsonb_build_object('security_change', true);
            change_magnitude := 'critical';
        END IF;
    ELSIF TG_TABLE_NAME = 'system_config' THEN
        compliance_flags := compliance_flags || jsonb_build_object('system_configuration_change', true);
        change_magnitude := 'major';
    END IF;
    
    -- Insert audit record
    INSERT INTO audit_logs (
        action,
        resource_type,
        resource_id,
        actor_type,
        actor_id,
        actor_address,
        source_ip,
        user_agent,
        old_values,
        new_values,
        context_data,
        session_id,
        application_name,
        transaction_id,
        change_magnitude,
        compliance_flags,
        execution_time_ms,
        occurred_at
    ) VALUES (
        LOWER(TG_OP) || '_' || TG_TABLE_NAME,
        TG_TABLE_NAME,
        COALESCE(NEW.id, OLD.id),
        'trigger',
        NULL,
        current_setting('proofvault.actor_address', true),
        current_setting('proofvault.source_ip', true)::inet,
        current_setting('proofvault.user_agent', true),
        old_values,
        new_values,
        jsonb_build_object(
            'trigger_name', TG_NAME,
            'table_name', TG_TABLE_NAME,
            'operation', TG_OP,
            'when', TG_WHEN,
            'level', TG_LEVEL,
            'changed_columns', changed_columns,
            'compliance_level', audit_config.compliance_level
        ),
        session_info.session_id,
        session_info.app_name,
        session_info.transaction_id,
        change_magnitude,
        compliance_flags,
        CASE 
            WHEN current_setting('proofvault.start_time', true) IS NOT NULL 
            THEN extract(epoch from (clock_timestamp() - current_setting('proofvault.start_time', true)::timestamptz)) * 1000
            ELSE NULL
        END,
        NOW()
    );
    
    RETURN COALESCE(NEW, OLD);
END;
$$;

-- ============================================================================
-- CREATE AUDIT TRIGGERS FOR ALL TABLES
-- ============================================================================

-- Evidence Records Audit
DROP TRIGGER IF EXISTS evidence_audit_trigger ON evidence_records;
CREATE TRIGGER evidence_audit_trigger
    AFTER INSERT OR UPDATE OR DELETE ON evidence_records
    FOR EACH ROW EXECUTE FUNCTION generic_audit_trigger();

-- Blockchain Transactions Audit
DROP TRIGGER IF EXISTS blockchain_transactions_audit_trigger ON blockchain_transactions;
CREATE TRIGGER blockchain_transactions_audit_trigger
    AFTER INSERT OR UPDATE OR DELETE ON blockchain_transactions
    FOR EACH ROW EXECUTE FUNCTION generic_audit_trigger();

-- Verification Attempts Audit
DROP TRIGGER IF EXISTS verification_attempts_audit_trigger ON verification_attempts;
CREATE TRIGGER verification_attempts_audit_trigger
    AFTER INSERT OR UPDATE OR DELETE ON verification_attempts
    FOR EACH ROW EXECUTE FUNCTION generic_audit_trigger();

-- Users Audit
DROP TRIGGER IF EXISTS users_audit_trigger ON users;
CREATE TRIGGER users_audit_trigger
    AFTER INSERT OR UPDATE OR DELETE ON users
    FOR EACH ROW EXECUTE FUNCTION generic_audit_trigger();

-- Blockchain Batches Audit
DROP TRIGGER IF EXISTS blockchain_batches_audit_trigger ON blockchain_batches;
CREATE TRIGGER blockchain_batches_audit_trigger
    AFTER INSERT OR UPDATE OR DELETE ON blockchain_batches
    FOR EACH ROW EXECUTE FUNCTION generic_audit_trigger();

-- System Config Audit
DROP TRIGGER IF EXISTS system_config_audit_trigger ON system_config;
CREATE TRIGGER system_config_audit_trigger
    AFTER INSERT OR UPDATE OR DELETE ON system_config
    FOR EACH ROW EXECUTE FUNCTION generic_audit_trigger();

-- Consensus State Audit (updates only)
DROP TRIGGER IF EXISTS consensus_state_audit_trigger ON consensus_state;
CREATE TRIGGER consensus_state_audit_trigger
    AFTER UPDATE ON consensus_state
    FOR EACH ROW EXECUTE FUNCTION generic_audit_trigger();

-- ============================================================================
-- AUDIT UTILITY FUNCTIONS
-- ============================================================================

-- Function to set audit context
CREATE OR REPLACE FUNCTION set_audit_context(
    p_actor_address VARCHAR(255) DEFAULT NULL,
    p_source_ip INET DEFAULT NULL,
    p_user_agent TEXT DEFAULT NULL,
    p_session_id VARCHAR(255) DEFAULT NULL,
    p_start_time TIMESTAMPTZ DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
    IF p_actor_address IS NOT NULL THEN
        PERFORM set_config('proofvault.actor_address', p_actor_address, false);
    END IF;
    
    IF p_source_ip IS NOT NULL THEN
        PERFORM set_config('proofvault.source_ip', p_source_ip::text, false);
    END IF;
    
    IF p_user_agent IS NOT NULL THEN
        PERFORM set_config('proofvault.user_agent', p_user_agent, false);
    END IF;
    
    IF p_session_id IS NOT NULL THEN
        PERFORM set_config('proofvault.session_id', p_session_id, false);
    END IF;
    
    IF p_start_time IS NOT NULL THEN
        PERFORM set_config('proofvault.start_time', p_start_time::text, false);
    END IF;
END;
$$;

-- Function to clear audit context
CREATE OR REPLACE FUNCTION clear_audit_context()
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
    PERFORM set_config('proofvault.actor_address', '', false);
    PERFORM set_config('proofvault.source_ip', '', false);
    PERFORM set_config('proofvault.user_agent', '', false);
    PERFORM set_config('proofvault.session_id', '', false);
    PERFORM set_config('proofvault.start_time', '', false);
END;
$$;

-- Function to get audit summary for a resource
CREATE OR REPLACE FUNCTION get_audit_summary(
    p_resource_type VARCHAR(50),
    p_resource_id UUID,
    p_days_back INTEGER DEFAULT 30
)
RETURNS TABLE (
    total_changes BIGINT,
    insert_count BIGINT,
    update_count BIGINT,
    delete_count BIGINT,
    critical_changes BIGINT,
    major_changes BIGINT,
    last_change TIMESTAMPTZ,
    unique_actors BIGINT
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*) as total_changes,
        COUNT(*) FILTER (WHERE action LIKE 'insert_%') as insert_count,
        COUNT(*) FILTER (WHERE action LIKE 'update_%') as update_count,
        COUNT(*) FILTER (WHERE action LIKE 'delete_%') as delete_count,
        COUNT(*) FILTER (WHERE change_magnitude = 'critical') as critical_changes,
        COUNT(*) FILTER (WHERE change_magnitude = 'major') as major_changes,
        MAX(occurred_at) as last_change,
        COUNT(DISTINCT actor_address) as unique_actors
    FROM audit_logs
    WHERE resource_type = p_resource_type
      AND resource_id = p_resource_id
      AND occurred_at > NOW() - (p_days_back || ' days')::interval;
END;
$$;

-- Function to archive old audit logs
CREATE OR REPLACE FUNCTION archive_audit_logs(
    p_archive_days_old INTEGER DEFAULT 2555 -- ~7 years
)
RETURNS TABLE (
    archived_count BIGINT,
    earliest_archived TIMESTAMPTZ,
    latest_archived TIMESTAMPTZ
)
LANGUAGE plpgsql
AS $$
DECLARE
    cutoff_date TIMESTAMPTZ;
    result_count BIGINT;
    earliest_date TIMESTAMPTZ;
    latest_date TIMESTAMPTZ;
BEGIN
    cutoff_date := NOW() - (p_archive_days_old || ' days')::interval;
    
    -- Get stats before deletion
    SELECT 
        COUNT(*),
        MIN(occurred_at),
        MAX(occurred_at)
    INTO result_count, earliest_date, latest_date
    FROM audit_logs 
    WHERE occurred_at < cutoff_date;
    
    -- Create archive table if it doesn't exist
    CREATE TABLE IF NOT EXISTS audit_logs_archive (
        LIKE audit_logs INCLUDING ALL
    );
    
    -- Move old records to archive
    WITH moved_rows AS (
        DELETE FROM audit_logs 
        WHERE occurred_at < cutoff_date
        RETURNING *
    )
    INSERT INTO audit_logs_archive 
    SELECT * FROM moved_rows;
    
    RETURN QUERY SELECT result_count, earliest_date, latest_date;
END;
$$;

-- ============================================================================
-- AUDIT REPORTING VIEWS
-- ============================================================================

-- View for recent critical changes
CREATE OR REPLACE VIEW audit_critical_changes AS
SELECT 
    al.occurred_at,
    al.action,
    al.resource_type,
    al.resource_id,
    al.actor_address,
    al.change_magnitude,
    al.compliance_flags,
    al.context_data,
    CASE 
        WHEN al.resource_type = 'evidence_record' THEN er.hash
        WHEN al.resource_type = 'users' THEN u.address
        ELSE al.resource_id::text
    END as resource_identifier
FROM audit_logs al
LEFT JOIN evidence_records er ON al.resource_type = 'evidence_record' AND al.resource_id = er.id
LEFT JOIN users u ON al.resource_type = 'users' AND al.resource_id = u.id
WHERE al.change_magnitude IN ('critical', 'major')
  AND al.occurred_at > NOW() - INTERVAL '30 days'
ORDER BY al.occurred_at DESC;

-- View for compliance monitoring
CREATE OR REPLACE VIEW audit_compliance_monitor AS
SELECT 
    resource_type,
    DATE_TRUNC('day', occurred_at) as audit_date,
    COUNT(*) as total_changes,
    COUNT(*) FILTER (WHERE compliance_flags ? 'sensitive_data_changed') as sensitive_changes,
    COUNT(*) FILTER (WHERE compliance_flags ? 'security_change') as security_changes,
    COUNT(*) FILTER (WHERE compliance_flags ? 'data_deletion') as deletion_events,
    COUNT(*) FILTER (WHERE change_magnitude = 'critical') as critical_events,
    COUNT(DISTINCT actor_address) as unique_actors
FROM audit_logs
WHERE occurred_at > NOW() - INTERVAL '90 days'
GROUP BY resource_type, DATE_TRUNC('day', occurred_at)
ORDER BY audit_date DESC, resource_type;

-- View for user activity summary
CREATE OR REPLACE VIEW audit_user_activity AS
SELECT 
    actor_address,
    COUNT(*) as total_actions,
    COUNT(DISTINCT resource_type) as tables_affected,
    COUNT(DISTINCT DATE_TRUNC('day', occurred_at)) as active_days,
    MIN(occurred_at) as first_activity,
    MAX(occurred_at) as last_activity,
    COUNT(*) FILTER (WHERE change_magnitude = 'critical') as critical_actions,
    array_agg(DISTINCT action ORDER BY action) as action_types
FROM audit_logs
WHERE actor_address IS NOT NULL
  AND occurred_at > NOW() - INTERVAL '30 days'
GROUP BY actor_address
ORDER BY total_actions DESC;

-- ============================================================================
-- AUDIT MAINTENANCE JOBS
-- ============================================================================

-- Function to refresh audit statistics
CREATE OR REPLACE FUNCTION refresh_audit_statistics()
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
    -- Update table statistics
    ANALYZE audit_logs;
    ANALYZE audit_configuration;
    
    -- Log the refresh
    INSERT INTO audit_logs (
        action, resource_type, actor_type, 
        context_data, occurred_at
    ) VALUES (
        'audit_statistics_refresh', 'system', 'system',
        jsonb_build_object('operation', 'refresh_audit_statistics'),
        NOW()
    );
END;
$$;

-- ============================================================================
-- COMMENTS AND DOCUMENTATION
-- ============================================================================

COMMENT ON TABLE audit_configuration IS 'Configuration for audit triggers per table';
COMMENT ON FUNCTION generic_audit_trigger() IS 'Generic audit trigger function with configurable behavior';
COMMENT ON FUNCTION set_audit_context(VARCHAR, INET, TEXT, VARCHAR, TIMESTAMPTZ) IS 'Sets session variables for audit context';
COMMENT ON FUNCTION get_audit_summary(VARCHAR, UUID, INTEGER) IS 'Returns audit summary for a specific resource';
COMMENT ON FUNCTION archive_audit_logs(INTEGER) IS 'Archives old audit logs to separate table';
COMMENT ON VIEW audit_critical_changes IS 'Recent critical and major changes across all audited tables';
COMMENT ON VIEW audit_compliance_monitor IS 'Daily compliance metrics for audit monitoring';
COMMENT ON VIEW audit_user_activity IS 'User activity summary for security monitoring';

-- Update system configuration
INSERT INTO system_config (key, value, description, is_public) VALUES 
('audit_retention_days', '2555', 'Days to retain audit logs before archiving', false),
('audit_archive_enabled', 'true', 'Enable automatic audit log archiving', false),
('audit_compliance_alerts', 'true', 'Enable compliance alerts for critical changes', false)
ON CONFLICT (key) DO UPDATE SET
    value = EXCLUDED.value,
    description = EXCLUDED.description,
    updated_at = NOW();