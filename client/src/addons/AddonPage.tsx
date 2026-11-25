import { useParams, useSearch } from '@tanstack/react-router';
import type { AddonRoute } from './types';

// Renders the component of an addon route with the route's params and search.
export const AddonPage = ({ route: { component: Page } }: { route: AddonRoute }) => {
  const params = useParams({ strict: false }) as Record<string, string>;
  const search = useSearch({ strict: false }) as Record<string, unknown>;
  return Page ? <Page params={params} search={search} /> : null;
};
