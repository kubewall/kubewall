package apply

import (
	"context"
	"fmt"
	"github.com/kubewall/kubewall/backend/config"
	"os/exec"
	"strings"
)

func checkKubectlCLIPresent() bool {
	_, err := exec.LookPath("kubectl")

	return err == nil
}

func applyYAML(ctx context.Context, kubeConfig, contextName, yamlFile string) (string, error) {
	var cmd *exec.Cmd
	if contextName == config.InClusterKey || kubeConfig == "" {
		cmd = exec.CommandContext(ctx, "kubectl", "apply", "-f", "-", "--insecure-skip-tls-verify")
	} else {
		cmd = exec.CommandContext(ctx, "kubectl", "apply", "-f", "-", "--kubeconfig", kubeConfig, "--context", contextName, "--insecure-skip-tls-verify")
	}
	cmd.Stdin = strings.NewReader(yamlFile)
	output, err := cmd.CombinedOutput()
	if err != nil {
		return "", fmt.Errorf("failed to apply YAML: %w\nOutput: %s", err, string(output))
	}

	return string(output), nil
}
