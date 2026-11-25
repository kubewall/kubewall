import { ComponentType, Fragment, ReactNode, createElement } from 'react';
import { NAVIGATION_ROUTE } from '@/constants';
import addons from '@/addons';
import type { DeniedCheck, SsoAddonDefinition } from './types';

// Extension points of the optional addon, with defaults for builds without it:
// everything allowed, nothing hidden, no extra pages. Hooks are picked once at
// load, so their call order never changes.
const addon = addons.sso;

const allowAll: DeniedCheck = () => null;
const showAll = { navigation: NAVIGATION_ROUTE, isCustomResourceVisible: () => true };
const passThrough = ({ children }: { children: ReactNode }) => createElement(Fragment, null, children);

const addonRoutes = addon?.routes ?? [];
const useIsAdmin = addon?.useIsAdmin ?? (() => true);
const useDenied = addon?.useDenied ?? (() => allowAll);
const useVisibleNavigation = addon?.useVisibleNavigation ?? (() => showAll);
const AppProvider: NonNullable<SsoAddonDefinition['AppProvider']> = addon?.AppProvider ?? passThrough;
const AccountButton: NonNullable<SsoAddonDefinition['AccountButton']> = addon?.AccountButton ?? (() => null);
const PermissionGate: NonNullable<SsoAddonDefinition['PermissionGate']> = addon?.PermissionGate ?? passThrough;
const ClusterGate: NonNullable<SsoAddonDefinition['ClusterGate']> = addon?.ClusterGate ?? passThrough;

// Adds a `deniedReason` prop to a control: given one, the control is switched
// off and shows the reason; without one it renders as it was.
const withPermissionGate = <P extends object>(Component: ComponentType<P>) =>
  ({ deniedReason, ...props }: P & { deniedReason?: string | null }) =>
    createElement(PermissionGate, { deniedReason, children: createElement(Component, props as unknown as P) });

export { AccountButton, AppProvider, ClusterGate, PermissionGate, addonRoutes, useDenied, useIsAdmin, useVisibleNavigation, withPermissionGate };
