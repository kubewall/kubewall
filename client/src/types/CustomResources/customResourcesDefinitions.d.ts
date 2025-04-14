import { CustomResourcesPrinterColumns } from "./customResourcesList";

type CustomResourcesDefinitionsResponse = {
  activeVersion: string;
  additionalPrinterColumns: CustomResourcesPrinterColumns[];
  age: string;
  hasUpdated: boolean;
  name: string;
  queryParam: string;
  scope: string;
  spec: {
      group: string;
      icon: string;
      names: {
          kind: string;
          listKind: string;
          plural: string;
          shortNames: string | null;
          singular: string
      };
      scope: string
  };
  versions: number;
  uid: string;
}

type CustomResourcesDefinitionsHeader = {
  name: string;
  resource: string;
  group: string;
  version: string;
  scope: string;
  age: string;
}

export {
  CustomResourcesDefinitionsHeader,
  CustomResourcesDefinitionsResponse
};
