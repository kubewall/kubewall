package storage

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	_ "modernc.org/sqlite"
	"k8s.io/client-go/tools/clientcmd/api"
	"github.com/Facets-cloud/kube-dash/internal/types"
)

// SQLiteStorage implements DatabaseStorage interface for SQLite
type SQLiteStorage struct {
	db   *sql.DB
	path string
}

// NewSQLiteStorage creates a new SQLite storage instance
func NewSQLiteStorage(path string) *SQLiteStorage {
	return &SQLiteStorage{
		path: path,
	}
}

// Initialize sets up the SQLite database connection and creates necessary tables
func (s *SQLiteStorage) Initialize() error {
	db, err := sql.Open("sqlite", s.path)
	if err != nil {
		return fmt.Errorf("failed to open SQLite database: %w", err)
	}

	s.db = db

	// Create the kubeconfigs table
	createKubeConfigsSQL := `
	CREATE TABLE IF NOT EXISTS kubeconfigs (
		id TEXT PRIMARY KEY,
		name TEXT NOT NULL,
		config_data TEXT NOT NULL,
		clusters TEXT NOT NULL,
		created_at DATETIME NOT NULL,
		updated_at DATETIME NOT NULL
	);
	`

	if _, err := s.db.Exec(createKubeConfigsSQL); err != nil {
		return fmt.Errorf("failed to create kubeconfigs table: %w", err)
	}

	// Create the traces table
	createTracesSQL := `
	CREATE TABLE IF NOT EXISTS traces (
		trace_id TEXT PRIMARY KEY,
		operation_name TEXT NOT NULL,
		start_time DATETIME NOT NULL,
		duration INTEGER NOT NULL,
		status TEXT NOT NULL,
		services TEXT NOT NULL,
		span_count INTEGER NOT NULL,
		spans_json TEXT NOT NULL,
		tags_json TEXT NOT NULL,
		created_at DATETIME NOT NULL
	);
	`

	if _, err := s.db.Exec(createTracesSQL); err != nil {
		return fmt.Errorf("failed to create traces table: %w", err)
	}

	// Create the spans table
	createSpansSQL := `
	CREATE TABLE IF NOT EXISTS spans (
		span_id TEXT PRIMARY KEY,
		trace_id TEXT NOT NULL,
		parent_span_id TEXT,
		operation_name TEXT NOT NULL,
		service_name TEXT NOT NULL,
		start_time DATETIME NOT NULL,
		duration INTEGER NOT NULL,
		status TEXT NOT NULL,
		tags_json TEXT NOT NULL,
		logs_json TEXT NOT NULL,
		FOREIGN KEY (trace_id) REFERENCES traces(trace_id) ON DELETE CASCADE
	);
	`

	if _, err := s.db.Exec(createSpansSQL); err != nil {
		return fmt.Errorf("failed to create spans table: %w", err)
	}

	// Create the cache_entries table
	createCacheSQL := `
	CREATE TABLE IF NOT EXISTS cache_entries (
		cache_key TEXT PRIMARY KEY,
		data_json TEXT NOT NULL,
		expires_at DATETIME NOT NULL,
		created_at DATETIME NOT NULL,
		updated_at DATETIME NOT NULL
	);
	`

	if _, err := s.db.Exec(createCacheSQL); err != nil {
		return fmt.Errorf("failed to create cache_entries table: %w", err)
	}

	// Create indexes for better performance
	createIndexesSQL := `
	CREATE INDEX IF NOT EXISTS idx_traces_start_time ON traces(start_time);
	CREATE INDEX IF NOT EXISTS idx_traces_status ON traces(status);
	CREATE INDEX IF NOT EXISTS idx_traces_operation_name ON traces(operation_name);
	CREATE INDEX IF NOT EXISTS idx_spans_trace_id ON spans(trace_id);
	CREATE INDEX IF NOT EXISTS idx_spans_service_name ON spans(service_name);
	CREATE INDEX IF NOT EXISTS idx_spans_start_time ON spans(start_time);
	CREATE INDEX IF NOT EXISTS idx_cache_expires_at ON cache_entries(expires_at);
	`

	if _, err := s.db.Exec(createIndexesSQL); err != nil {
		return fmt.Errorf("failed to create indexes: %w", err)
	}

	return nil
}

// StoreTrace stores a trace in the SQLite database
func (s *SQLiteStorage) StoreTrace(trace *types.Trace) error {
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
	traceQuery := `INSERT OR REPLACE INTO traces (trace_id, operation_name, start_time, duration, status, services, span_count, spans_json, tags_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
	_, err = s.db.Exec(traceQuery, trace.TraceID, trace.OperationName, trace.StartTime, trace.Duration.Nanoseconds(), trace.Status, string(servicesJSON), trace.SpanCount, string(spansJSON), string(tagsJSON), time.Now())
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

		spanQuery := `INSERT OR REPLACE INTO spans (span_id, trace_id, parent_span_id, operation_name, service_name, start_time, duration, status, tags_json, logs_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
		_, err = s.db.Exec(spanQuery, span.SpanID, span.TraceID, span.ParentSpanID, span.OperationName, span.ServiceName, span.StartTime, span.Duration.Nanoseconds(), span.Status, string(spanTagsJSON), string(spanLogsJSON))
		if err != nil {
			return fmt.Errorf("failed to insert span: %w", err)
		}
	}

	return nil
}

// GetTrace retrieves a trace by ID from SQLite
func (s *SQLiteStorage) GetTrace(traceID string) (*types.Trace, error) {
	query := `SELECT trace_id, operation_name, start_time, duration, status, services, span_count, spans_json, tags_json FROM traces WHERE trace_id = ?`
	row := s.db.QueryRow(query, traceID)

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

// QueryTraces retrieves traces based on filters from SQLite
func (s *SQLiteStorage) QueryTraces(filter types.TraceFilter) ([]*types.Trace, int, error) {
	// Build WHERE clause
	var conditions []string
	var args []interface{}

	if filter.Service != "" {
		conditions = append(conditions, "services LIKE ?")
		args = append(args, "%"+filter.Service+"%")
	}

	if filter.Operation != "" {
		conditions = append(conditions, "operation_name LIKE ?")
		args = append(args, "%"+filter.Operation+"%")
	}

	if filter.Status != "" {
		conditions = append(conditions, "status = ?")
		args = append(args, filter.Status)
	}

	if filter.StartTime != nil {
		conditions = append(conditions, "start_time >= ?")
		args = append(args, *filter.StartTime)
	}

	if filter.EndTime != nil {
		conditions = append(conditions, "start_time <= ?")
		args = append(args, *filter.EndTime)
	}

	if filter.MinDuration != nil {
		conditions = append(conditions, "duration >= ?")
		args = append(args, filter.MinDuration.Nanoseconds())
	}

	if filter.MaxDuration != nil {
		conditions = append(conditions, "duration <= ?")
		args = append(args, filter.MaxDuration.Nanoseconds())
	}

	whereClause := ""
	if len(conditions) > 0 {
		whereClause = "WHERE " + strings.Join(conditions, " AND ")
	}

	// Count total results
	countQuery := fmt.Sprintf("SELECT COUNT(*) FROM traces %s", whereClause)
	var total int
	if err := s.db.QueryRow(countQuery, args...).Scan(&total); err != nil {
		return nil, 0, fmt.Errorf("failed to count traces: %w", err)
	}

	// Query with pagination
	query := fmt.Sprintf("SELECT trace_id, operation_name, start_time, duration, status, services, span_count, spans_json, tags_json FROM traces %s ORDER BY start_time DESC LIMIT ? OFFSET ?", whereClause)
	args = append(args, filter.Limit, filter.Offset)

	rows, err := s.db.Query(query, args...)
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
func (s *SQLiteStorage) DeleteExpiredTraces(cutoff time.Time) error {
	query := `DELETE FROM traces WHERE start_time < ?`
	result, err := s.db.Exec(query, cutoff)
	if err != nil {
		return fmt.Errorf("failed to delete expired traces: %w", err)
	}

	rowsAffected, _ := result.RowsAffected()
	if rowsAffected > 0 {
		// Also clean up orphaned spans (should be handled by CASCADE, but just in case)
		_, _ = s.db.Exec(`DELETE FROM spans WHERE trace_id NOT IN (SELECT trace_id FROM traces)`)
	}

	return nil
}

// SetCache stores a cache entry in SQLite
func (s *SQLiteStorage) SetCache(key string, data []byte, expiresAt time.Time) error {
	now := time.Now()
	query := `INSERT OR REPLACE INTO cache_entries (cache_key, data_json, expires_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`
	_, err := s.db.Exec(query, key, string(data), expiresAt, now, now)
	if err != nil {
		return fmt.Errorf("failed to set cache entry: %w", err)
	}
	return nil
}

// GetCache retrieves a cache entry from SQLite
func (s *SQLiteStorage) GetCache(key string) ([]byte, time.Time, error) {
	query := `SELECT data_json, expires_at FROM cache_entries WHERE cache_key = ? AND expires_at > ?`
	row := s.db.QueryRow(query, key, time.Now())

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
func (s *SQLiteStorage) DeleteExpiredCache(cutoff time.Time) error {
	query := `DELETE FROM cache_entries WHERE expires_at < ?`
	_, err := s.db.Exec(query, cutoff)
	if err != nil {
		return fmt.Errorf("failed to delete expired cache entries: %w", err)
	}
	return nil
}

// ClearCache removes all cache entries
func (s *SQLiteStorage) ClearCache() error {
	query := `DELETE FROM cache_entries`
	_, err := s.db.Exec(query)
	if err != nil {
		return fmt.Errorf("failed to clear cache: %w", err)
	}
	return nil
}

// Close closes the SQLite database connection
func (s *SQLiteStorage) Close() error {
	if s.db != nil {
		return s.db.Close()
	}
	return nil
}

// AddKubeConfig stores a kubeconfig in the SQLite database
func (s *SQLiteStorage) AddKubeConfig(id, name string, config *api.Config, clusters map[string]string, created, updated time.Time) error {
	configData, err := json.Marshal(config)
	if err != nil {
		return fmt.Errorf("failed to marshal config: %w", err)
	}

	clustersData, err := json.Marshal(clusters)
	if err != nil {
		return fmt.Errorf("failed to marshal clusters: %w", err)
	}

	query := `INSERT INTO kubeconfigs (id, name, config_data, clusters, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`
	_, err = s.db.Exec(query, id, name, string(configData), string(clustersData), created, updated)
	if err != nil {
		return fmt.Errorf("failed to insert kubeconfig: %w", err)
	}

	return nil
}

// GetKubeConfig retrieves a kubeconfig by ID from SQLite
func (s *SQLiteStorage) GetKubeConfig(id string) (*api.Config, error) {
	query := `SELECT config_data FROM kubeconfigs WHERE id = ?`
	row := s.db.QueryRow(query, id)

	var configData string
	if err := row.Scan(&configData); err != nil {
		if err == sql.ErrNoRows {
			return nil, fmt.Errorf("kubeconfig not found: %s", id)
		}
		return nil, fmt.Errorf("failed to query kubeconfig: %w", err)
	}

	var config api.Config
	if err := json.Unmarshal([]byte(configData), &config); err != nil {
		return nil, fmt.Errorf("failed to unmarshal config: %w", err)
	}

	return &config, nil
}

// GetKubeConfigMetadata retrieves kubeconfig metadata by ID from SQLite
func (s *SQLiteStorage) GetKubeConfigMetadata(id string) (*KubeConfig, error) {
	query := `SELECT id, name, clusters, created_at, updated_at FROM kubeconfigs WHERE id = ?`
	row := s.db.QueryRow(query, id)

	var name, clustersData string
	var created, updated time.Time
	if err := row.Scan(&id, &name, &clustersData, &created, &updated); err != nil {
		if err == sql.ErrNoRows {
			return nil, fmt.Errorf("kubeconfig not found: %s", id)
		}
		return nil, fmt.Errorf("failed to query kubeconfig metadata: %w", err)
	}

	var clusters map[string]string
	if err := json.Unmarshal([]byte(clustersData), &clusters); err != nil {
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

// ListKubeConfigs returns all kubeconfig metadata from SQLite
func (s *SQLiteStorage) ListKubeConfigs() (map[string]*KubeConfig, error) {
	query := `SELECT id, name, clusters, created_at, updated_at FROM kubeconfigs`
	rows, err := s.db.Query(query)
	if err != nil {
		return nil, fmt.Errorf("failed to query kubeconfigs: %w", err)
	}
	defer rows.Close()

	result := make(map[string]*KubeConfig)
	for rows.Next() {
		var id, name, clustersData string
		var created, updated time.Time
		if err := rows.Scan(&id, &name, &clustersData, &created, &updated); err != nil {
			return nil, fmt.Errorf("failed to scan kubeconfig row: %w", err)
		}

		var clusters map[string]string
		if err := json.Unmarshal([]byte(clustersData), &clusters); err != nil {
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

// UpdateKubeConfig updates an existing kubeconfig in SQLite
func (s *SQLiteStorage) UpdateKubeConfig(id, name string, config *api.Config, clusters map[string]string, updated time.Time) error {
	configData, err := json.Marshal(config)
	if err != nil {
		return fmt.Errorf("failed to marshal config: %w", err)
	}

	clustersData, err := json.Marshal(clusters)
	if err != nil {
		return fmt.Errorf("failed to marshal clusters: %w", err)
	}

	query := `UPDATE kubeconfigs SET name = ?, config_data = ?, clusters = ?, updated_at = ? WHERE id = ?`
	result, err := s.db.Exec(query, name, string(configData), string(clustersData), updated, id)
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

// DeleteKubeConfig removes a kubeconfig by ID from SQLite
func (s *SQLiteStorage) DeleteKubeConfig(id string) error {
	query := `DELETE FROM kubeconfigs WHERE id = ?`
	result, err := s.db.Exec(query, id)
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

// HealthCheck verifies the SQLite database connection is healthy
func (s *SQLiteStorage) HealthCheck() error {
	if s.db == nil {
		return fmt.Errorf("database connection is nil")
	}

	if err := s.db.Ping(); err != nil {
		return fmt.Errorf("database ping failed: %w", err)
	}

	return nil
}