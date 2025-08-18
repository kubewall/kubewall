import { API_VERSION } from '@/constants';
import kwFetch from '@/data/kwFetch';

export interface YamlEditPermissionResult {
  allowed: boolean;
  permissions: {
    update: boolean;
    patch: boolean;
  };
  reason: string;
  group: string;
  resource: string;
  namespace?: string;
  name: string;
}

/**
 * Check if the user has permissions to edit YAML for a specific resource
 */
export async function checkYamlEditPermission(params: {
  config: string;
  cluster: string;
  resourcekind: string;
  namespace?: string;
  resourcename: string;
  group?: string;
  resource?: string;
}): Promise<YamlEditPermissionResult> {
  const { config, cluster, resourcekind, namespace, resourcename, group, resource } = params;
  
  const queryParams = new URLSearchParams({
    config,
    cluster,
    resourcekind,
    resourcename,
  });

  if (namespace) {
    queryParams.append('namespace', namespace);
  }

  if (resourcekind === 'customresources') {
    if (group) queryParams.append('group', group);
    if (resource) queryParams.append('resource', resource);
  }

  const url = `${API_VERSION}/permissions/yaml-edit?${queryParams.toString()}`;
  
  try {
    const response = await kwFetch(url, { method: 'GET' });
    return response as YamlEditPermissionResult;
  } catch (error) {
    // If permission check fails, assume no permissions
    return {
      allowed: false,
      permissions: {
        update: false,
        patch: false,
      },
      reason: 'Failed to check permissions',
      group: '',
      resource: resourcekind,
      namespace,
      name: resourcename,
    };
  }
}

/**
 * Get a user-friendly message for permission denial
 */
export function getPermissionDenialMessage(result: YamlEditPermissionResult): string {
  if (result.allowed) {
    return '';
  }

  const resourceDisplay = result.resource.charAt(0).toUpperCase() + result.resource.slice(1);
  const namespaceText = result.namespace ? ` in namespace ${result.namespace}` : '';
  
  if (!result.permissions.update && !result.permissions.patch) {
    return `You don't have permission to edit ${resourceDisplay}${namespaceText}. You need both update and patch permissions.`;
  } else if (!result.permissions.update) {
    return `You don't have update permission for ${resourceDisplay}${namespaceText}.`;
  } else if (!result.permissions.patch) {
    return `You don't have patch permission for ${resourceDisplay}${namespaceText}.`;
  }

  return `You don't have sufficient permissions to edit ${resourceDisplay}${namespaceText}.`;
}
