package nodes

import (
	coreV1 "k8s.io/api/core/v1"
	"strings"
	"time"
)

const NodeLabelPrefix = "node-role.kubernetes.io/"

type NodesList struct {
	Name            string    `json:"name"`
	ResourceVersion string    `json:"resourceVersion"`
	Roles           []string  `json:"roles"`
	Age             time.Time `json:"age"`
	Spec            Spec      `json:"spec"`
	Status          Status    `json:"status"`
}

type Spec struct {
	PodCIDR    string   `json:"podCIDR"`
	PodCIDRs   []string `json:"podCIDRs"`
	ProviderID string   `json:"providerID"`
}

type Status struct {
	ConditionStatus coreV1.ConditionStatus `json:"conditionStatus"`
	Addresses       Addresses              `json:"addresses"`
	NodeInfo        NodeInfo               `json:"nodeInfo"`
}

type Addresses struct {
	InternalIP string `json:"internalIP"`
}

type NodeInfo struct {
	MachineID               string `json:"machineID"`
	SystemUUID              string `json:"systemUUID"`
	BootID                  string `json:"bootID"`
	KernelVersion           string `json:"kernelVersion"`
	OsImage                 string `json:"osImage"`
	ContainerRuntimeVersion string `json:"containerRuntimeVersion"`
	KubeletVersion          string `json:"kubeletVersion"`
	KubeProxyVersion        string `json:"kubeProxyVersion"`
	OperatingSystem         string `json:"operatingSystem"`
	Architecture            string `json:"architecture"`
}

func TransformNodes(nodes []coreV1.Node) []NodesList {
	nodesList := []NodesList{}

	for _, v := range nodes {
		podCIDRs := make([]string, 0)
		if len(v.Spec.PodCIDRs) > 0 {
			podCIDRs = v.Spec.PodCIDRs
		}

		nodesList = append(nodesList, NodesList{
			Name:            v.GetName(),
			Age:             v.CreationTimestamp.Time,
			ResourceVersion: v.ResourceVersion,
			Roles:           getRoles(v.Labels),
			Spec: Spec{
				PodCIDR:    v.Spec.PodCIDR,
				PodCIDRs:   podCIDRs,
				ProviderID: v.Spec.ProviderID,
			},
			Status: Status{
				ConditionStatus: getNodeConditionStatus(v),
				Addresses: Addresses{
					InternalIP: getInternalIP(v.Status.Addresses),
				},
				NodeInfo: NodeInfo{
					MachineID:               v.Status.NodeInfo.MachineID,
					SystemUUID:              v.Status.NodeInfo.SystemUUID,
					BootID:                  v.Status.NodeInfo.BootID,
					KernelVersion:           v.Status.NodeInfo.KernelVersion,
					OsImage:                 v.Status.NodeInfo.OSImage,
					ContainerRuntimeVersion: v.Status.NodeInfo.ContainerRuntimeVersion,
					KubeletVersion:          v.Status.NodeInfo.KubeletVersion,
					KubeProxyVersion:        v.Status.NodeInfo.KubeProxyVersion,
					OperatingSystem:         v.Status.NodeInfo.OperatingSystem,
					Architecture:            v.Status.NodeInfo.Architecture,
				},
			},
		})
	}

	return nodesList
}

func getRoles(labels map[string]string) []string {
	roles := make([]string, 0)
	for k := range labels {
		if strings.Contains(k, NodeLabelPrefix) {
			roles = append(roles, strings.ReplaceAll(k, NodeLabelPrefix, ""))
		}
	}
	return roles
}

func getInternalIP(addresses []coreV1.NodeAddress) string {
	for _, v := range addresses {
		if v.Type == "InternalIP" {
			return v.Address
		}
	}
	return ""
}

func getNodeConditionStatus(node coreV1.Node) coreV1.ConditionStatus {
	for _, condition := range node.Status.Conditions {
		if condition.Type == coreV1.NodeReady {
			return condition.Status
		}
	}
	return coreV1.ConditionUnknown
}
