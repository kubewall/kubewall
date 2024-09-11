package apply

import (
	"fmt"
	"os/exec"
	"strings"
)

func checkKubectlCLIPresent() bool {
	_, err := exec.LookPath("kubectl")

	return err == nil
}

func applyYAML(kubeconfig, context string, yamlFile string) (string, error) {
	cmd := exec.Command("kubectl", "apply", "-f", "-", "--kubeconfig", kubeconfig, "--context", context, "--insecure-skip-tls-verify")
	cmd.Stdin = strings.NewReader(yamlFile)
	output, err := cmd.CombinedOutput()
	if err != nil {
		return "", fmt.Errorf("failed to apply YAML: %w\nOutput: %s", err, string(output))
	}

	return string(output), nil
}
