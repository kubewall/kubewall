package storage

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	_ "github.com/lib/pq"
	"k8s.io/client-go/tools/clientcmd/api"

	"github.com/Facets-cloud/kube-dash/internal/types"
)

// PostgresStorage implements DatabaseStorage interface for PostgreSQL
type PostgresStorage struct {
	db  *sql.DB
	url string
}

// NewPostgresStorage creates a new PostgreSQL storage instance
func NewPostgresStorage(url string) *PostgresStorage {
	return &PostgresStorage{
		url: url,
	}
}

// Initialize sets up the PostgreSQL database connection and creates necessary tables
func (p *PostgresStorage) Initialize() error {
	db, err := sql.Open("postgres", p.url)
	if err != nil {
		return fmt.Errorf("failed to open PostgreSQL database: %w", err)
	}

	p.db = db

	// Test the connection
	if err := p.db.Ping(); err != nil {
		return fmt.Errorf("failed to ping PostgreSQL database: %w", err)
	}

	// Create the kubeconfigs table
	createTableSQL := `
	CREATE TABLE IF NOT EXISTS kubeconfigs (
		id TEXT PRIMARY KEY,
		name TEXT NOT NULL,
		config_data JSONB NOT NULL,
		clusters JSONB NOT NULL,
		created_at TIMESTAMP WITH TIME ZONE NOT NULL,
		updated_at TIMESTAMP WITH TIME ZONE NOT NULL
	);
	`

	if _, err := p.db.Exec(createTableSQL); err != nil {
		return fmt.Errorf("failed to create kubeconfigs table: %w", err)
	}

	// Create indexes for better performance
	createIndexSQL := `
	CREATE INDEX IF NOT EXISTS idx_kubeconfigs_name ON kubeconfigs(name);
	CREATE INDEX IF NOT EXISTS idx_kubeconfigs_created_at ON kubeconfigs(created_at);
	CREATE INDEX IF NOT EXISTS idx_kubeconfigs_updated_at ON kubeconfigs(updated_at);
	`

	if _, err := p.db.Exec(createIndexSQL); err != nil {
		return fmt.Errorf("failed to create indexes: %w", err)
	}

	// Create traces table
	createTracesTableSQL := `
	CREATE TABLE IF NOT EXISTS traces (
		trace_id TEXT PRIMARY KEY,
		operation_name TEXT NOT NULL,
		start_time TIMESTAMP WITH TIME ZONE NOT NULL,
		duration BIGINT NOT NULL,
		status TEXT NOT NULL,
		services JSONB NOT NULL,
		span_count INTEGER NOT NULL,
		spans_json JSONB NOT NULL,
		tags_json JSONB NOT NULL,
		created_at TIMESTAMP WITH TIME ZONE NOT NULL
	);
	`

	if _, err := p.db.Exec(createTracesTableSQL); err != nil {
		return fmt.Errorf("failed to create traces table: %w", err)
	}

	// Create spans table
	createSpansTableSQL := `
	CREATE TABLE IF NOT EXISTS spans (
		span_id TEXT PRIMARY KEY,
		trace_id TEXT NOT NULL,
		parent_span_id TEXT,
		operation_name TEXT NOT NULL,
		service_name TEXT NOT NULL,
		start_time TIMESTAMP WITH TIME ZONE NOT NULL,
		duration BIGINT NOT NULL,
		status TEXT NOT NULL,
		tags_json JSONB NOT NULL,
		logs_json JSONB NOT NULL,
		FOREIGN KEY (trace_id) REFERENCES traces(trace_id) ON DELETE CASCADE
	);
	`

	if _, err := p.db.Exec(createSpansTableSQL); err != nil {
		return fmt.Errorf("failed to create spans table: %w", err)
	}

	// Create cache_entries table
	createCacheTableSQL := `
	CREATE TABLE IF NOT EXISTS cache_entries (
		cache_key TEXT PRIMARY KEY,
		data_json JSONB NOT NULL,
		expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
		created_at TIMESTAMP WITH TIME ZONE NOT NULL,
		updated_at TIMESTAMP WITH TIME ZONE NOT NULL
	);
	`

	if _, err := p.db.Exec(createCacheTableSQL); err != nil {
		return fmt.Errorf("failed to create cache_entries table: %w", err)
	}

	// Create performance indexes for traces and spans
	createTraceIndexesSQL := `
	CREATE INDEX IF NOT EXISTS idx_traces_start_time ON traces(start_time);
	CREATE INDEX IF NOT EXISTS idx_traces_status ON traces(status);
	CREATE INDEX IF NOT EXISTS idx_traces_operation_name ON traces(operation_name);
	CREATE INDEX IF NOT EXISTS idx_traces_duration ON traces(duration);
	CREATE INDEX IF NOT EXISTS idx_spans_trace_id ON spans(trace_id);
	CREATE INDEX IF NOT EXISTS idx_spans_service_name ON spans(service_name);
	CREATE INDEX IF NOT EXISTS idx_spans_start_time ON spans(start_time);
	CREATE INDEX IF NOT EXISTS idx_cache_expires_at ON cache_entries(expires_at);
	`

	if _, err := p.db.Exec(createTraceIndexesSQL); err != nil {
		return fmt.Errorf("failed to create trace indexes: %w", err)
	}

	// Create GIN indexes for JSONB columns for better performance
	createGinIndexesSQL := `
	CREATE INDEX IF NOT EXISTS idx_traces_services_gin ON traces USING GIN(services);
	CREATE INDEX IF NOT EXISTS idx_traces_tags_gin ON traces USING GIN(tags_json);
	CREATE INDEX IF NOT EXISTS idx_spans_tags_gin ON spans USING GIN(tags_json);
	CREATE INDEX IF NOT EXISTS idx_cache_data_gin ON cache_entries USING GIN(data_json);
	`

	if _, err := p.db.Exec(createGinIndexesSQL); err != nil {
		return fmt.Errorf("failed to create GIN indexes: %w", err)
	}

	return nil
}

// StoreTrace stores a trace in the PostgreSQL database
func (p *PostgresStorage) StoreTrace(trace *types.Trace) error {
	spansJSON, err := json.Marshal(trace.Spans)
	if err != nil {
		return fmt.Errorf("failed to marshal spans: %w", err)
	}

	tagsJSON, err := json.Marshal(trace.Tags)
	if err != nil {
		return fmt.Errorf("failed to marshal tags: %w", err)
	}

	servicesJSON, err := json.Marshal(trace.Services)
	if err != nil {
		return fmt.Errorf("failed to marshal services: %w", err)
	}

	// Store trace
	traceQuery := `INSERT INTO traces (trace_id, operation_name, start_time, duration, status, services, span_count, spans_json, tags_json, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) ON CONFLICT (trace_id) DO UPDATE SET operation_name = $2, start_time = $3, duration = $4, status = $5, services = $6, span_count = $7, spans_json = $8, tags_json = $9`
	_, err = p.db.Exec(traceQuery, trace.TraceID, trace.OperationName, trace.StartTime, trace.Duration.Nanoseconds(), trace.Status, string(servicesJSON), trace.SpanCount, string(spansJSON), string(tagsJSON), time.Now())
	if err != nil {
		return fmt.Errorf("failed to insert trace: %w", err)
	}

	// Store individual spans
	for _, span := range trace.Spans {
		spanTagsJSON, err := json.Marshal(span.Tags)
		if err != nil {
			return fmt.Errorf("failed to marshal span tags: %w", err)
		}

		spanLogsJSON, err := json.Marshal(span.Logs)
		if err != nil {
			return fmt.Errorf("failed to marshal span logs: %w", err)
		}

		spanQuery := `INSERT INTO spans (span_id, trace_id, parent_span_id, operation_name, service_name, start_time, duration, status, tags_json, logs_json) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) ON CONFLICT (span_id) DO UPDATE SET trace_id = $2, parent_span_id = $3, operation_name = $4, service_name = $5, start_time = $6, duration = $7, status = $8, tags_json = $9, logs_json = $10`
		_, err = p.db.Exec(spanQuery, span.SpanID, span.TraceID, span.ParentSpanID, span.OperationName, span.ServiceName, span.StartTime, span.Duration.Nanoseconds(), span.Status, string(spanTagsJSON), string(spanLogsJSON))
		if err != nil {
			return fmt.Errorf("failed to insert span: %w", err)
		}
	}

	return nil
}

// GetTrace retrieves a trace by ID from PostgreSQL
func (p *PostgresStorage) GetTrace(traceID string) (*types.Trace, error) {
	query := `SELECT trace_id, operation_name, start_time, duration, status, services, span_count, spans_json, tags_json FROM traces WHERE trace_id = $1`
	row := p.db.QueryRow(query, traceID)

	var trace types.Trace
	var durationNs int64
	var servicesJSON, spansJSON, tagsJSON string

	if err := row.Scan(&trace.TraceID, &trace.OperationName, &trace.StartTime, &durationNs, &trace.Status, &servicesJSON, &trace.SpanCount, &spansJSON, &tagsJSON); err != nil {
		if err == sql.ErrNoRows {
			return nil, fmt.Errorf("trace not found: %s", traceID)
		}
		return nil, fmt.Errorf("failed to query trace: %w", err)
	}

	trace.Duration = time.Duration(durationNs)

	if err := json.Unmarshal([]byte(servicesJSON), &trace.Services); err != nil {
		return nil, fmt.Errorf("failed to unmarshal services: %w", err)
	}

	if err := json.Unmarshal([]byte(spansJSON), &trace.Spans); err != nil {
		return nil, fmt.Errorf("failed to unmarshal spans: %w", err)
	}

	if err := json.Unmarshal([]byte(tagsJSON), &trace.Tags); err != nil {
		return nil, fmt.Errorf("failed to unmarshal tags: %w", err)
	}

	return &trace, nil
}

// QueryTraces retrieves traces based on filters from PostgreSQL
func (p *PostgresStorage) QueryTraces(filter types.TraceFilter) ([]*types.Trace, int, error) {
	// Build WHERE clause
	var conditions []string
	var args []interface{}
	argIndex := 1

	if filter.Service != "" {
		conditions = append(conditions, fmt.Sprintf("services ? $%d", argIndex))
		args = append(args, filter.Service)
		argIndex++
	}

	if filter.Operation != "" {
		conditions = append(conditions, fmt.Sprintf("operation_name ILIKE $%d", argIndex))
		args = append(args, "%"+filter.Operation+"%")
		argIndex++
	}

	if filter.Status != "" {
		conditions = append(conditions, fmt.Sprintf("status = $%d", argIndex))
		args = append(args, filter.Status)
		argIndex++
	}

	if filter.StartTime != nil {
		conditions = append(conditions, fmt.Sprintf("start_time >= $%d", argIndex))
		args = append(args, *filter.StartTime)
		argIndex++
	}

	if filter.EndTime != nil {
		conditions = append(conditions, fmt.Sprintf("start_time <= $%d", argIndex))
		args = append(args, *filter.EndTime)
		argIndex++
	}

	if filter.MinDuration != nil {
		conditions = append(conditions, fmt.Sprintf("duration >= $%d", argIndex))
		args = append(args, filter.MinDuration.Nanoseconds())
		argIndex++
	}

	if filter.MaxDuration != nil {
		conditions = append(conditions, fmt.Sprintf("duration <= $%d", argIndex))
		args = append(args, filter.MaxDuration.Nanoseconds())
		argIndex++
	}

	whereClause := ""
	if len(conditions) > 0 {
		whereClause = "WHERE " + strings.Join(conditions, " AND ")
	}

	// Count total results
	countQuery := fmt.Sprintf("SELECT COUNT(*) FROM traces %s", whereClause)
	var total int
	if err := p.db.QueryRow(countQuery, args...).Scan(&total); err != nil {
		return nil, 0, fmt.Errorf("failed to count traces: %w", err)
	}

	// Query with pagination
	query := fmt.Sprintf("SELECT trace_id, operation_name, start_time, duration, status, services, span_count, spans_json, tags_json FROM traces %s ORDER BY start_time DESC LIMIT $%d OFFSET $%d", whereClause, argIndex, argIndex+1)
	args = append(args, filter.Limit, filter.Offset)

	rows, err := p.db.Query(query, args...)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to query traces: %w", err)
	}
	defer rows.Close()

	var traces []*types.Trace
	for rows.Next() {
		var trace types.Trace
		var durationNs int64
		var servicesJSON, spansJSON, tagsJSON string

		if err := rows.Scan(&trace.TraceID, &trace.OperationName, &trace.StartTime, &durationNs, &trace.Status, &servicesJSON, &trace.SpanCount, &spansJSON, &tagsJSON); err != nil {
			return nil, 0, fmt.Errorf("failed to scan trace row: %w", err)
		}

		trace.Duration = time.Duration(durationNs)

		if err := json.Unmarshal([]byte(servicesJSON), &trace.Services); err != nil {
			return nil, 0, fmt.Errorf("failed to unmarshal services: %w", err)
		}

		if err := json.Unmarshal([]byte(spansJSON), &trace.Spans); err != nil {
			return nil, 0, fmt.Errorf("failed to unmarshal spans: %w", err)
		}

		if err := json.Unmarshal([]byte(tagsJSON), &trace.Tags); err != nil {
			return nil, 0, fmt.Errorf("failed to unmarshal tags: %w", err)
		}

		traces = append(traces, &trace)
	}

	if err := rows.Err(); err != nil {
		return nil, 0, fmt.Errorf("error iterating trace rows: %w", err)
	}

	return traces, total, nil
}

// DeleteExpiredTraces removes traces older than the cutoff time
func (p *PostgresStorage) DeleteExpiredTraces(cutoff time.Time) error {
	query := `DELETE FROM traces WHERE start_time < $1`
	result, err := p.db.Exec(query, cutoff)
	if err != nil {
		return fmt.Errorf("failed to delete expired traces: %w", err)
	}

	rowsAffected, _ := result.RowsAffected()
	if rowsAffected > 0 {
		// Spans should be automatically deleted by CASCADE, but let's verify
		_, _ = p.db.Exec(`DELETE FROM spans WHERE trace_id NOT IN (SELECT trace_id FROM traces)`)
	}

	return nil
}

// SetCache stores a cache entry in PostgreSQL
func (p *PostgresStorage) SetCache(key string, data []byte, expiresAt time.Time) error {
	now := time.Now()
	query := `INSERT INTO cache_entries (cache_key, data_json, expires_at, created_at, updated_at) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (cache_key) DO UPDATE SET data_json = $2, expires_at = $3, updated_at = $5`
	_, err := p.db.Exec(query, key, string(data), expiresAt, now, now)
	if err != nil {
		return fmt.Errorf("failed to set cache entry: %w", err)
	}
	return nil
}

// GetCache retrieves a cache entry from PostgreSQL
func (p *PostgresStorage) GetCache(key string) ([]byte, time.Time, error) {
	query := `SELECT data_json, expires_at FROM cache_entries WHERE cache_key = $1 AND expires_at > $2`
	row := p.db.QueryRow(query, key, time.Now())

	var dataJSON string
	var expiresAt time.Time
	if err := row.Scan(&dataJSON, &expiresAt); err != nil {
		if err == sql.ErrNoRows {
			return nil, time.Time{}, fmt.Errorf("cache entry not found or expired: %s", key)
		}
		return nil, time.Time{}, fmt.Errorf("failed to query cache entry: %w", err)
	}

	return []byte(dataJSON), expiresAt, nil
}

// DeleteExpiredCache removes expired cache entries
func (p *PostgresStorage) DeleteExpiredCache(cutoff time.Time) error {
	query := `DELETE FROM cache_entries WHERE expires_at < $1`
	_, err := p.db.Exec(query, cutoff)
	if err != nil {
		return fmt.Errorf("failed to delete expired cache entries: %w", err)
	}
	return nil
}

// ClearCache removes all cache entries
func (p *PostgresStorage) ClearCache() error {
	query := `DELETE FROM cache_entries`
	_, err := p.db.Exec(query)
	if err != nil {
		return fmt.Errorf("failed to clear cache: %w", err)
	}
	return nil
}

// Close closes the PostgreSQL database connection
func (p *PostgresStorage) Close() error {
	if p.db != nil {
		return p.db.Close()
	}
	return nil
}

// AddKubeConfig stores a kubeconfig in the PostgreSQL database
func (p *PostgresStorage) AddKubeConfig(id, name string, config *api.Config, clusters map[string]string, created, updated time.Time) error {
	configData, err := json.Marshal(config)
	if err != nil {
		return fmt.Errorf("failed to marshal config: %w", err)
	}

	clustersData, err := json.Marshal(clusters)
	if err != nil {
		return fmt.Errorf("failed to marshal clusters: %w", err)
	}

	query := `INSERT INTO kubeconfigs (id, name, config_data, clusters, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6)`
	_, err = p.db.Exec(query, id, name, configData, clustersData, created, updated)
	if err != nil {
		return fmt.Errorf("failed to insert kubeconfig: %w", err)
	}

	return nil
}

// GetKubeConfig retrieves a kubeconfig by ID from PostgreSQL
func (p *PostgresStorage) GetKubeConfig(id string) (*api.Config, error) {
	query := `SELECT config_data FROM kubeconfigs WHERE id = $1`
	row := p.db.QueryRow(query, id)

	var configData []byte
	if err := row.Scan(&configData); err != nil {
		if err == sql.ErrNoRows {
			return nil, fmt.Errorf("kubeconfig not found: %s", id)
		}
		return nil, fmt.Errorf("failed to query kubeconfig: %w", err)
	}

	var config api.Config
	if err := json.Unmarshal(configData, &config); err != nil {
		return nil, fmt.Errorf("failed to unmarshal config: %w", err)
	}

	return &config, nil
}

// GetKubeConfigMetadata retrieves kubeconfig metadata by ID from PostgreSQL
func (p *PostgresStorage) GetKubeConfigMetadata(id string) (*KubeConfig, error) {
	query := `SELECT id, name, clusters, created_at, updated_at FROM kubeconfigs WHERE id = $1`
	row := p.db.QueryRow(query, id)

	var name string
	var clustersData []byte
	var created, updated time.Time
	if err := row.Scan(&id, &name, &clustersData, &created, &updated); err != nil {
		if err == sql.ErrNoRows {
			return nil, fmt.Errorf("kubeconfig not found: %s", id)
		}
		return nil, fmt.Errorf("failed to query kubeconfig metadata: %w", err)
	}

	var clusters map[string]string
	if err := json.Unmarshal(clustersData, &clusters); err != nil {
		return nil, fmt.Errorf("failed to unmarshal clusters: %w", err)
	}

	return &KubeConfig{
		ID:       id,
		Name:     name,
		Clusters: clusters,
		Created:  created,
		Updated:  updated,
	}, nil
}

// ListKubeConfigs returns all kubeconfig metadata from PostgreSQL
func (p *PostgresStorage) ListKubeConfigs() (map[string]*KubeConfig, error) {
	query := `SELECT id, name, clusters, created_at, updated_at FROM kubeconfigs ORDER BY created_at DESC`
	rows, err := p.db.Query(query)
	if err != nil {
		return nil, fmt.Errorf("failed to query kubeconfigs: %w", err)
	}
	defer rows.Close()

	result := make(map[string]*KubeConfig)
	for rows.Next() {
		var id, name string
		var clustersData []byte
		var created, updated time.Time
		if err := rows.Scan(&id, &name, &clustersData, &created, &updated); err != nil {
			return nil, fmt.Errorf("failed to scan kubeconfig row: %w", err)
		}

		var clusters map[string]string
		if err := json.Unmarshal(clustersData, &clusters); err != nil {
			return nil, fmt.Errorf("failed to unmarshal clusters: %w", err)
		}

		result[id] = &KubeConfig{
			ID:       id,
			Name:     name,
			Clusters: clusters,
			Created:  created,
			Updated:  updated,
		}
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("error iterating kubeconfig rows: %w", err)
	}

	return result, nil
}

// UpdateKubeConfig updates an existing kubeconfig in PostgreSQL
func (p *PostgresStorage) UpdateKubeConfig(id, name string, config *api.Config, clusters map[string]string, updated time.Time) error {
	configData, err := json.Marshal(config)
	if err != nil {
		return fmt.Errorf("failed to marshal config: %w", err)
	}

	clustersData, err := json.Marshal(clusters)
	if err != nil {
		return fmt.Errorf("failed to marshal clusters: %w", err)
	}

	query := `UPDATE kubeconfigs SET name = $1, config_data = $2, clusters = $3, updated_at = $4 WHERE id = $5`
	result, err := p.db.Exec(query, name, configData, clustersData, updated, id)
	if err != nil {
		return fmt.Errorf("failed to update kubeconfig: %w", err)
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("failed to get rows affected: %w", err)
	}

	if rowsAffected == 0 {
		return fmt.Errorf("kubeconfig not found: %s", id)
	}

	return nil
}

// DeleteKubeConfig removes a kubeconfig by ID from PostgreSQL
func (p *PostgresStorage) DeleteKubeConfig(id string) error {
	query := `DELETE FROM kubeconfigs WHERE id = $1`
	result, err := p.db.Exec(query, id)
	if err != nil {
		return fmt.Errorf("failed to delete kubeconfig: %w", err)
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("failed to get rows affected: %w", err)
	}

	if rowsAffected == 0 {
		return fmt.Errorf("kubeconfig not found: %s", id)
	}

	return nil
}

// HealthCheck verifies the PostgreSQL database connection is healthy
func (p *PostgresStorage) HealthCheck() error {
	if p.db == nil {
		return fmt.Errorf("database connection is nil")
	}

	if err := p.db.Ping(); err != nil {
		return fmt.Errorf("database ping failed: %w", err)
	}

	return nil
}