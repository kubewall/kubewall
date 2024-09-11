package helpers

import (
	"fmt"
	"k8s.io/apimachinery/pkg/api/meta"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/client-go/kubernetes/scheme"
	"k8s.io/client-go/tools/cache"
)

func AddTypeInformationToObject(obj runtime.Object) error {
	gvks, _, err := scheme.Scheme.ObjectKinds(obj)
	if err != nil {
		return fmt.Errorf("missing apiVersion or kind and cannot assign it; %w", err)
	}

	for _, gvk := range gvks {
		if len(gvk.Kind) == 0 {
			continue
		}
		if len(gvk.Version) == 0 || gvk.Version == runtime.APIVersionInternal {
			continue
		}
		obj.GetObjectKind().SetGroupVersionKind(gvk)
		break
	}

	return nil
}

func StripUnusedFields(obj interface{}) (interface{}, error) {
	if tombstone, ok := obj.(cache.DeletedFinalStateUnknown); ok {
		obj = tombstone.Obj
	}

	accessor, err := meta.Accessor(obj)
	if err != nil {
		// shouldn't happen
		return obj, nil
	}
	// ManagedFields is large and we never use it
	accessor.SetManagedFields(nil)
	AddTypeInformationToObject(accessor.(runtime.Object))

	return obj, nil
}
