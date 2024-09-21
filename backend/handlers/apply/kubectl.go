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

func applyYAML(kubeConfig, context, yamlFile string) (string, error) {
	var cmd *exec.Cmd
	if context == "incluster" {
		cmd = exec.Command("kubectl", "apply", "-f", "-", "--kubeconfig", kubeConfig, "--insecure-skip-tls-verify")
	} else {
		cmd = exec.Command("kubectl", "apply", "-f", "-", "--kubeconfig", kubeConfig, "--context", context, "--insecure-skip-tls-verify")
	}
	cmd.Stdin = strings.NewReader(yamlFile)
	output, err := cmd.CombinedOutput()
	if err != nil {
		return "", fmt.Errorf("failed to apply YAML: %w\nOutput: %s", err, string(output))
	}

	return string(output), nil
}
