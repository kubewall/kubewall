package tools

import (
	"bytes"
	"text/template"
)

func parseTemplate(tmpl string, data map[string]string) string {
	t := template.Must(template.New("description").Parse(tmpl))

	var buf bytes.Buffer
	err := t.Execute(&buf, data)
	if err != nil {
		panic(err)
	}

	output := buf.String()

	return output
}
