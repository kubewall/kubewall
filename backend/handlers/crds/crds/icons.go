package crds

import (
	"fmt"
	"strings"
)

var iconsList = map[string][]string{
	"aiven.io":               {"aiven.io"},
	"amazonaws.com":          {"amazonaws.com"},
	"ansible.com":            {"ansible.com"},
	"apache.org":             {"apache.org"},
	"argoproj.io":            {"argoproj.io"},
	"banzaicloud.com":        {"banzaicloud.com"},
	"bitnami.com":            {"bitnami.com"},
	"cert-manager.io":        {"cert-manager.io"},
	"cilium.io":              {"cilium.io"},
	"cloudflare-operator.io": {"cloudflare-operator.io"},
	"cloudflare.com":         {"cloudflare.com"},
	"cncf.io":                {"cncf.io"},
	"confluent.io":           {"confluent.io"},
	"coreos.com":             {"coreos.com"},
	"crossplane.io":          {"crossplane.io"},
	"dapr.io":                {"dapr.io"},
	"datadoghq.com":          {"datadoghq.com"},
	"doppler.com":            {"doppler.com"},
	"dragonflydb.io":         {"dragonflydb.io"},
	"dynatrace.com":          {"dynatrace.com"},
	"elastic.co":             {"elastic.co"},
	"emqx.io":                {"emqx.io"},
	"envoyproxy.io":          {"envoyproxy.io"},
	"external-secrets.io":    {"external-secrets.io"},
	"f5.com":                 {"f5.com"},
	"flagger.app":            {"flagger.app"},
	"fluent.io":              {"fluent.io"},
	"fluxcd.io":              {"fluxcd.io"},
	"getambassador.io":       {"getambassador.io"},
	"github.com":             {"github.com"},
	"github.io":              {"github.io"},
	"gitlab.com":             {"gitlab.com"},
	"gke.io":                 {"gke.io"},
	"google.com":             {"google.com"},
	"grafana.com":            {"grafana.com"},
	"hashicorp.com":          {"hashicorp.com"},
	"hivemq.com":             {"hivemq.com"},
	"istio.io":               {"istio.io"},
	"jaegertracing.io":       {"jaegertracing.io"},
	"jfrog.com":              {"jfrog.com"},
	"k0sproject.io":          {"k0sproject.io"},
	"k6.io":                  {"k6.io"},
	"k8s.aws":                {"k8s.aws"},
	"k8s.io":                 {"k8s.io"},
	"k8up.io":                {"k8up.io"},
	"karpenter.sh":           {"karpenter.sh"},
	"keda.sh":                {"keda.sh"},
	"keycloak.org":           {"keycloak.org"},
	"konghq.com":             {"konghq.com"},
	"kserve.io":              {"kserve.io"},
	"kubeflow.org":           {"kubeflow.org"},
	"kyverno.io":             {"kyverno.io"},
	"linkerd.io":             {"linkerd.io"},
	"longhorn.io":            {"longhorn.io"},
	"mariadb.com":            {"mariadb.com"},
	"metallb.io":             {"metallb.io"},
	"min.io":                 {"min.io"},
	"mongodb.com":            {"mongodb.com"},
	"nats.io":                {"nats.io"},
	"nginx.org":              {"nginx.org"},
	"onepassword.com":        {"onepassword.com"},
	"openshift.io":           {"openshift.io"},
	"openshift":              {"openshift"},
	"opentelemetry.io":       {"opentelemetry.io"},
	"oracle.com":             {"oracle.com"},
	"oraclecloud.com":        {"oraclecloud.com"},
	"pingcap.com":            {"pingcap.com"},
	"projectcontour.io":      {"projectcontour.io"},
	"rabbitmq.com":           {"rabbitmq.com"},
	"redislabs.com":          {"redislabs.com"},
	"rook.io":                {"rook.io"},
	"scylladb.com":           {"scylladb.com"},
	"solo.io":                {"solo.io"},
	"strimzi.io":             {"strimzi.io"},
	"teleport.dev":           {"teleport.dev"},
	"temporal.io":            {"temporal.io"},
	"tinkerbell.org":         {"tinkerbell.org"},
	"traefik.io":             {"traefik.io"},
	"velero.io":              {"velero.io"},
	"x-k8s.io":               {"x-k8s.io"},
	"zalan.do":               {"zalan.do"},
}

func resolveIcons(input string) string {
	for group, aliases := range iconsList {
		for _, alias := range aliases {
			if strings.Contains(input, alias) {
				return fmt.Sprintf("%s.svg", group)
			}
		}
	}
	return ""
}
