package pods

import (
	"fmt"
	"os"
	"strings"
)

// ExecLogLevel represents the logging level for exec operations
type ExecLogLevel int

const (
	LevelError ExecLogLevel = iota
	LevelWarn
	LevelInfo
	LevelDebug
)

// String returns the string representation of the log level
func (l ExecLogLevel) String() string {
	switch l {
	case LevelError:
		return "ERROR"
	case LevelWarn:
		return "WARN"
	case LevelInfo:
		return "INFO"
	case LevelDebug:
		return "DEBUG"
	default:
		return "UNKNOWN"
	}
}

var (
	currentExecLevel  ExecLogLevel = LevelError // Default to error only
	execLevelToString = map[string]ExecLogLevel{
		"error": LevelError,
		"warn":  LevelWarn,
		"info":  LevelInfo,
		"debug": LevelDebug,
	}
)

func init() {
	// Read EXEC_LOG_LEVEL from environment, default to "error"
	levelStr := strings.ToLower(os.Getenv("EXEC_LOG_LEVEL"))
	if level, ok := execLevelToString[levelStr]; ok {
		currentExecLevel = level
	}
}

// SetExecLogLevel sets the exec log level programmatically
func SetExecLogLevel(level ExecLogLevel) {
	currentExecLevel = level
}

// GetExecLogLevel returns the current log level as a string
func GetExecLogLevel() string {
	return currentExecLevel.String()
}

// shouldLogExec returns true if the given level should be logged
func shouldLogExec(level ExecLogLevel) bool {
	return level <= currentExecLevel
}

// logExec logs a message at the given level if it meets the threshold
func logExec(level ExecLogLevel, format string, args ...interface{}) {
	if shouldLogExec(level) {
		prefix := fmt.Sprintf("[Exec][%s] ", level.String())
		fmt.Fprintf(os.Stderr, prefix+format+"\n", args...)
	}
}

// ExecError logs an error message (always logged by default)
func ExecError(format string, args ...interface{}) {
	logExec(LevelError, format, args...)
}

// ExecWarn logs a warning message
func ExecWarn(format string, args ...interface{}) {
	logExec(LevelWarn, format, args...)
}

// ExecInfo logs an info message
func ExecInfo(format string, args ...interface{}) {
	logExec(LevelInfo, format, args...)
}

// ExecDebug logs a debug message
func ExecDebug(format string, args ...interface{}) {
	logExec(LevelDebug, format, args...)
}

// ParseExecLogLevel parses a log level from string
func ParseExecLogLevel(s string) (ExecLogLevel, error) {
	level, ok := execLevelToString[strings.ToLower(s)]
	if !ok {
		return LevelError, fmt.Errorf("invalid exec log level: %s (valid: error, warn, info, debug)", s)
	}
	return level, nil
}

// PrintExecLogLevelHelp prints usage information for exec log levels
func PrintExecLogLevelHelp() {
	fmt.Fprintln(os.Stderr, "EXEC_LOG_LEVEL: Set exec logging verbosity (error, warn, info, debug)")
	fmt.Fprintln(os.Stderr, "  export EXEC_LOG_LEVEL=error  # Only errors (default)")
	fmt.Fprintln(os.Stderr, "  export EXEC_LOG_LEVEL=warn   # Warnings and errors")
	fmt.Fprintln(os.Stderr, "  export EXEC_LOG_LEVEL=info   # Info, warnings, and errors")
	fmt.Fprintln(os.Stderr, "  export EXEC_LOG_LEVEL=debug  # All messages including debug")
}
