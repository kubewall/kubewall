package tools

import (
	"bytes"
	"fmt"
	"text/template"
)

func parseTemplate(tmpl string, data map[string]string) (string, error) {
	t, err := template.New("description").Parse(tmpl)
	if err != nil {
		return "", fmt.Errorf("failed to parse template: %w", err)
	}

	var buf bytes.Buffer
	if err := t.Execute(&buf, data); err != nil {
		return "", fmt.Errorf("failed to execute template: %w", err)
	}

	return buf.String(), nil
}
