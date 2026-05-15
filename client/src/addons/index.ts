import { ADDON_API_VERSION, AddonRegistry } from './types';

// ─── Free / community build stub ─────────────────────────────────────────────
// When the enterprise-client submodule is absent, this file is used.
// Vite alias in vite.config.ts points @/addons at the submodule's index
// when the submodule is present, so this file is never bundled in premium builds.
//
// All addon slots in the app guard with `addons.terminal?.TerminalContainer`
// so rendering nothing here is safe and correct.

const addons: AddonRegistry = {};

export { ADDON_API_VERSION };
export default addons;
