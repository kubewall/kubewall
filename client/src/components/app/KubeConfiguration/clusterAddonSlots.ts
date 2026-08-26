import addons from '@/addons';
import capabilities from '@/capabilities';

// Shared between ConfigSection (table view) and ConfigCards (card view) so
// both render the same optional EOL/Tags slots without resolving them twice.
export const ClusterEOLBadge = addons.kubeEndOfLife?.ClusterEOLBadge ?? null;
export const eolEnabled = !!capabilities.kubeEndOfLife?.enabled && !!ClusterEOLBadge;

export const ClusterTagBadge = addons.clusterTags?.ClusterTagBadge ?? null;
export const tagsEnabled = !!capabilities.clusterTags?.enabled && !!ClusterTagBadge;
