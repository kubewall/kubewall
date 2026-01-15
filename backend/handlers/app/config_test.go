package app

import (
	"strings"
	"testing"

	"github.com/kubewall/kubewall/backend/config"
	"github.com/stretchr/testify/assert"
)

func TestValidateConfigName(t *testing.T) {
	tests := []struct {
		name      string
		input     string
		shouldErr bool
		reason    string
	}{
		// Valid names
		{"valid: lowercase letters", "myconfig", false, ""},
		{"valid: with hyphens", "my-prod-cluster", false, ""},
		{"valid: with numbers", "dev-123", false, ""},
		{"valid: single char", "a", false, ""},
		{"valid: single digit", "1", false, ""},
		{"valid: start with number", "0-test", false, ""},
		{"valid: all numbers", "1234", false, ""},
		{"valid: double hyphen", "my--cluster", false, ""},
		{"valid: max length", strings.Repeat("a", 63), false, ""},

		// Invalid names - empty/whitespace
		{"invalid: empty", "", true, "empty string"},
		{"invalid: whitespace only", "   ", true, "whitespace only"},

		// Invalid names - reserved
		{"invalid: reserved incluster", config.InClusterKey, true, "reserved name"},
		{"invalid: reserved INCLUSTER", "INCLUSTER", true, "reserved name (case insensitive)"},
		{"invalid: reserved InCluster", "InCluster", true, "reserved name (mixed case)"},

		// Invalid names - case issues (uppercase converted to lowercase, then validated)
		{"valid: uppercase converted", "MyCluster", false, "converted to lowercase"},
		{"valid: all uppercase", "MYCLUSTER", false, "converted to lowercase"},

		// Invalid names - special characters
		{"invalid: underscore", "my_cluster", true, "underscore not allowed"},
		{"invalid: space", "my cluster", true, "space not allowed"},
		{"invalid: slash", "cluster/prod", true, "slash not allowed"},
		{"invalid: backslash", "cluster\\prod", true, "backslash not allowed"},
		{"invalid: at sign", "config@prod", true, "@ not allowed"},
		{"invalid: dot", "my.cluster", true, "dot not allowed"},
		{"invalid: colon", "my:cluster", true, "colon not allowed"},

		// Invalid names - hyphen position
		{"invalid: starts with hyphen", "-cluster", true, "hyphen at start"},
		{"invalid: ends with hyphen", "cluster-", true, "hyphen at end"},
		{"invalid: only hyphen", "-", true, "only hyphen"},

		// Invalid names - length
		{"invalid: too long", strings.Repeat("a", 64), true, "exceeds 63 chars"},
		{"invalid: way too long", strings.Repeat("a", 100), true, "way over limit"},

		// Invalid names - path traversal attempts
		{"invalid: path traversal", "../etc/passwd", true, "path separators"},
		{"invalid: absolute path", "/etc/passwd", true, "absolute path"},
		{"invalid: windows path", "C:\\Windows", true, "windows path"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := validateConfigName(tt.input)
			if tt.shouldErr {
				assert.Error(t, err, "Expected error for '%s' (%s), but validation passed", tt.input, tt.reason)
			} else {
				assert.NoError(t, err, "Expected '%s' to be valid, got error: %v", tt.input, err)
			}
		})
	}
}

func TestValidateConfigName_Normalization(t *testing.T) {
	tests := []struct {
		name  string
		input string
	}{
		{"uppercase", "MyCluster"},
		{"all caps", "MYCLUSTER"},
		{"mixed case", "myCluster"},
		{"random case", "MyCLUSTER"},
		{"with spaces", "  myconfig  "},
		{"uppercase with spaces", "  MyConfig  "},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := validateConfigName(tt.input)
			// After normalization (trim + lowercase), these should all be valid
			// unless they become the reserved cluster key after normalization
			if strings.ToLower(strings.TrimSpace(tt.input)) != config.InClusterKey {
				assert.NoError(t, err, "Expected normalized input '%s' to pass validation, got error: %v", tt.input, err)
			}
		})
	}
}

func TestValidateConfigName_EdgeCases(t *testing.T) {
	tests := []struct {
		name      string
		input     string
		shouldErr bool
	}{
		{"just whitespace around valid", "  abc  ", false},
		{"tabs around valid", "\tabc\t", false},
		{"newlines around valid", "\nabc\n", false},
		{"max valid length with trim", "  " + strings.Repeat("a", 63) + "  ", false},
		{"too long after trim", "  " + strings.Repeat("a", 64) + "  ", true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := validateConfigName(tt.input)
			if tt.shouldErr {
				assert.Error(t, err, "Expected error for '%s'", tt.input)
			} else {
				assert.NoError(t, err, "Expected '%s' to be valid, got error: %v", tt.input, err)
			}
		})
	}
}
