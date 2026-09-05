import { DetailsCardLink } from "@/types";
import { Link } from "@tanstack/react-router";
import { RootState } from "@/redux/store";
import { kwDetails } from "@/routes";
import { toQueryParams } from "@/utils";
import { useAppSelector } from "@/redux/hooks";

type ResourceDetailsLinkProps = {
  link: DetailsCardLink;
  text: string;
};

function ResourceDetailsLink({ link, text }: ResourceDetailsLinkProps) {
  const { config } = kwDetails.useParams();
  const { cluster } = kwDetails.useSearch();
  const customResourcesNavigation = useAppSelector((state: RootState) => state.customResources.customResourcesNavigation);

  const { customResource } = link;
  const customResourceDefinition = customResource
    ? customResourcesNavigation[customResource.group]?.resources.find(({ name }) => name === customResource.kind)
    : undefined;

  if (customResource && !customResourceDefinition) {
    return <>{text}</>;
  }

  const namespace = customResourceDefinition && customResourceDefinition.scope !== 'Namespaced' ? '' : link.namespace;
  const queryParams = toQueryParams({
    cluster,
    resourcekind: link.resourcekind,
    resourcename: link.resourcename,
    ...(namespace ? { namespace } : {})
  });
  const customResourceParams = customResourceDefinition ? `&${customResourceDefinition.route}` : '';

  return (
    <Link to={`/${config}/details?${queryParams}${customResourceParams}`} className="text-blue-600 dark:text-blue-500 hover:underline">
      {text}
    </Link>
  );
}

export {
  ResourceDetailsLink
};
