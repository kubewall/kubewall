package helpers

import (
	"fmt"
	"k8s.io/apimachinery/pkg/api/meta"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/watch"
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

// EmptyInformer returns an informer that is never started and so stays
// permanently empty. It stands in for a kind the cluster does not serve
// (see IsKindAvailable): the base handler still has a store to list from and
// serves an empty result, and deliberately registering it here rather than with
// the shared factory keeps factory.Start from launching a reflector that would
// only 404.
func EmptyInformer(obj runtime.Object) cache.SharedIndexInformer {
	return cache.NewSharedIndexInformer(
		&cache.ListWatch{
			ListFunc:  func(metav1.ListOptions) (runtime.Object, error) { return &metav1.List{}, nil },
			WatchFunc: func(metav1.ListOptions) (watch.Interface, error) { return watch.NewEmptyWatch(), nil },
		},
		obj,
		0,
		cache.Indexers{},
	)
}

func StripUnusedFields(obj any) (any, error) {
	if tombstone, ok := obj.(cache.DeletedFinalStateUnknown); ok {
		obj = tombstone.Obj
	}

	accessor, err := meta.Accessor(obj)
	if err != nil {
		return obj, err
	}
	// ManagedFields is large and we never use it
	accessor.SetManagedFields(nil)
	if runtimeObj, ok := obj.(runtime.Object); ok {
		_ = AddTypeInformationToObject(runtimeObj)
	}

	return obj, nil
}
