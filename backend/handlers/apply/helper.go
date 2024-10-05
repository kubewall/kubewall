package apply

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"k8s.io/client-go/restmapper"
	"net/http"
	"strings"

	"github.com/pytimer/k8sutil/util"

	"github.com/pkg/errors"
	corev1 "k8s.io/api/core/v1"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/api/meta"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/runtime/serializer/yaml"
	"k8s.io/apimachinery/pkg/types"
	"k8s.io/apimachinery/pkg/util/jsonmergepatch"
	"k8s.io/apimachinery/pkg/util/mergepatch"
	utilruntime "k8s.io/apimachinery/pkg/util/runtime"
	"k8s.io/apimachinery/pkg/util/strategicpatch"
	yamlutil "k8s.io/apimachinery/pkg/util/yaml"
	"k8s.io/client-go/discovery"
	"k8s.io/client-go/dynamic"
	"k8s.io/client-go/kubernetes/scheme"
	"k8s.io/klog/v2"
)

type ApplyOptions struct {
	dynamicClient   dynamic.Interface
	discoveryClient discovery.DiscoveryInterface
	serverSide      bool
}

func NewApplyOptions(dynamicClient dynamic.Interface, discoveryClient discovery.DiscoveryInterface) *ApplyOptions {
	return &ApplyOptions{
		dynamicClient:   dynamicClient,
		discoveryClient: discoveryClient,
	}
}

func (o *ApplyOptions) WithServerSide(serverSide bool) *ApplyOptions {
	o.serverSide = serverSide
	return o
}

func (o *ApplyOptions) ToRESTMapper() (meta.RESTMapper, error) {
	gr, err := restmapper.GetAPIGroupResources(o.discoveryClient)
	if err != nil {
		return nil, err
	}

	mapper := restmapper.NewDiscoveryRESTMapper(gr)
	return mapper, nil
}

func (o *ApplyOptions) Apply(ctx context.Context, data []byte) error {
	restmapper, err := o.ToRESTMapper()
	if err != nil {
		return err
	}

	unstructList, err := Decode(data)
	if err != nil {
		return err
	}

	for _, unstruct := range unstructList {

		if _, err := ApplyUnstructured(ctx, o.dynamicClient, restmapper, unstruct, o.serverSide); err != nil {
			return err
		}
		klog.V(2).Infof("%s/%s applyed", strings.ToLower(unstruct.GetKind()), unstruct.GetName())
	}
	return nil
}

func Decode(data []byte) ([]unstructured.Unstructured, error) {
	var lastErr error
	var unstructList []unstructured.Unstructured
	i := 1

	decoder := yamlutil.NewYAMLOrJSONDecoder(bytes.NewReader(data), len(data))
	for {
		var reqObj runtime.RawExtension
		if err := decoder.Decode(&reqObj); err != nil {
			lastErr = err
			break
		}

		if len(reqObj.Raw) == 0 {
			continue
		}

		obj, _, err := yaml.NewDecodingSerializer(unstructured.UnstructuredJSONScheme).Decode(reqObj.Raw, nil, nil)
		if err != nil {
			lastErr = errors.Wrapf(err, "serialize the section:[%d] content error", i)
			klog.Info(lastErr)
			break
		}

		unstruct, err := util.ConvertSingleObjectToUnstructured(obj)
		if err != nil {
			lastErr = errors.Wrapf(err, "serialize the section:[%d] content error", i)
			break
		}
		unstructList = append(unstructList, unstruct)
		i++
	}

	if lastErr != io.EOF {
		return unstructList, errors.Wrapf(lastErr, "parsing the section:[%d] content error", i)
	}

	return unstructList, nil
}

func ApplyUnstructured(ctx context.Context, dynamicClient dynamic.Interface, restMapper meta.RESTMapper, unstructuredObj unstructured.Unstructured, serverSide bool) (*unstructured.Unstructured, error) {

	if len(unstructuredObj.GetName()) == 0 {
		metadata, err := meta.Accessor(unstructuredObj)
		if err != nil {
			return nil, err
		}
		generateName := metadata.GetGenerateName()
		if len(generateName) > 0 {
			return nil, fmt.Errorf("from %s: cannot use generate name with apply", generateName)
		}
	}

	b, err := unstructuredObj.MarshalJSON()
	if err != nil {
		return nil, err
	}

	obj, gvk, err := yaml.NewDecodingSerializer(unstructured.UnstructuredJSONScheme).Decode(b, nil, nil)
	if err != nil {
		return nil, err
	}

	mapping, err := restMapper.RESTMapping(gvk.GroupKind(), gvk.Version)
	if err != nil {
		return nil, err
	}

	var dri dynamic.ResourceInterface
	if mapping.Scope.Name() == meta.RESTScopeNameNamespace {
		if unstructuredObj.GetNamespace() == "" {
			unstructuredObj.SetNamespace("default")
		}
		dri = dynamicClient.Resource(mapping.Resource).Namespace(unstructuredObj.GetNamespace())
	} else {
		dri = dynamicClient.Resource(mapping.Resource)
	}

	if serverSide {
		klog.V(2).Infof("Using server-side apply")
		if _, ok := unstructuredObj.GetAnnotations()[corev1.LastAppliedConfigAnnotation]; ok {
			annotations := unstructuredObj.GetAnnotations()
			delete(annotations, corev1.LastAppliedConfigAnnotation)
			unstructuredObj.SetAnnotations(annotations)
		}
		unstructuredObj.SetManagedFields(nil)
		klog.V(4).Infof("Need remove managedFields before apply, %#v", unstructuredObj)

		force := true
		opts := metav1.PatchOptions{FieldManager: "k8sutil", Force: &force}
		if _, err := dri.Patch(ctx, unstructuredObj.GetName(), types.ApplyPatchType, b, opts); err != nil {
			if isIncompatibleServerError(err) {
				err = fmt.Errorf("server-side apply not available on the server: (%v)", err)
			}
			return nil, err
		}
		return nil, nil
	}

	modified, err := util.GetModifiedConfiguration(obj, true, unstructured.UnstructuredJSONScheme)
	if err != nil {
		return nil, fmt.Errorf("retrieving modified configuration from:\n%s\nfor:%v", unstructuredObj.GetName(), err)
	}

	currentUnstr, err := dri.Get(ctx, unstructuredObj.GetName(), metav1.GetOptions{})
	if err != nil {
		if !apierrors.IsNotFound(err) {
			return nil, fmt.Errorf("retrieving current configuration of:\n%s\nfrom server for:%v", unstructuredObj.GetName(), err)
		}

		klog.V(2).Infof("The resource %s creating", unstructuredObj.GetName())
		// Create the resource if it doesn't exist
		// First, update the annotation such as kubectl apply
		if err := util.CreateApplyAnnotation(&unstructuredObj, unstructured.UnstructuredJSONScheme); err != nil {
			return nil, fmt.Errorf("creating %s error: %v", unstructuredObj.GetName(), err)
		}

		return dri.Create(ctx, &unstructuredObj, metav1.CreateOptions{})
	}

	klog.V(2).Infof("The resource %s apply", unstructuredObj.GetName())
	metadata, _ := meta.Accessor(currentUnstr)
	annotationMap := metadata.GetAnnotations()
	if _, ok := annotationMap[corev1.LastAppliedConfigAnnotation]; !ok {
		klog.Warningf("[%s] apply should be used on resource created by either kubectl create --save-config or apply", metadata.GetName())
	}

	patchBytes, patchType, err := Patch(currentUnstr, modified, unstructuredObj.GetName(), *gvk)
	if err != nil {
		return nil, err
	}
	return dri.Patch(ctx, unstructuredObj.GetName(), patchType, patchBytes, metav1.PatchOptions{})
}

func Patch(currentUnstr *unstructured.Unstructured, modified []byte, name string, gvk schema.GroupVersionKind) ([]byte, types.PatchType, error) {
	current, err := currentUnstr.MarshalJSON()
	if err != nil {
		return nil, "", fmt.Errorf("serializing current configuration from: %v, %v", currentUnstr, err)
	}

	original, err := util.GetOriginalConfiguration(currentUnstr)
	if err != nil {
		return nil, "", fmt.Errorf("retrieving original configuration from: %s, %v", name, err)
	}

	var patchType types.PatchType
	var patch []byte

	versionedObject, err := Scheme.New(gvk)
	switch {
	case runtime.IsNotRegisteredError(err):
		patchType = types.MergePatchType
		preconditions := []mergepatch.PreconditionFunc{
			mergepatch.RequireKeyUnchanged("apiVersion"),
			mergepatch.RequireKeyUnchanged("kind"),
			mergepatch.RequireKeyUnchanged("name"),
		}
		patch, err = jsonmergepatch.CreateThreeWayJSONMergePatch(original, modified, current, preconditions...)
		if err != nil {
			if mergepatch.IsPreconditionFailed(err) {
				return nil, "", fmt.Errorf("At least one of apiVersion, kind and name was changed")
			}
			return nil, "", fmt.Errorf("unable to apply patch, %v", err)
		}
	case err == nil:
		patchType = types.StrategicMergePatchType
		lookupPatchMeta, err := strategicpatch.NewPatchMetaFromStruct(versionedObject)
		if err != nil {
			return nil, "", err
		}
		patch, err = strategicpatch.CreateThreeWayMergePatch(original, modified, current, lookupPatchMeta, true)
		if err != nil {
			return nil, "", err
		}
	case err != nil:
		return nil, "", fmt.Errorf("getting instance of versioned object %v for: %v", gvk, err)
	}

	return patch, patchType, nil
}

func isIncompatibleServerError(err error) bool {
	if _, ok := err.(*apierrors.StatusError); !ok {
		return false
	}
	// 415 说明服务端不支持server-side-apply
	return err.(*apierrors.StatusError).Status().Code == http.StatusUnsupportedMediaType
}

var Scheme = runtime.NewScheme()

func init() {
	utilruntime.Must(scheme.AddToScheme(Scheme))
}
