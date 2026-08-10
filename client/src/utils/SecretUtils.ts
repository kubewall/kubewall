type DockerCredential = {
  registry: string;
  username: string;
  password: string;
  email: string;
};

type JwtSummary = {
  algorithm: string;
  issuer: string;
  subject: string;
  audience: string;
  issuedAt: Date | null;
  expiresAt: Date | null;
  namespace: string;
  serviceAccount: string;
  pod: string;
};

type HelmRelease = {
  name: string;
  namespace: string;
  revision: string;
  status: string;
  chart: string;
  appVersion: string;
  updated: Date | null;
  description: string;
};

type DockerAuthEntry = {
  username?: string;
  password?: string;
  email?: string;
  auth?: string;
};

type JwtPayload = {
  iss?: string;
  sub?: string;
  aud?: string | string[];
  iat?: number;
  exp?: number;
  'kubernetes.io'?: {
    namespace?: string;
    pod?: { name?: string };
    serviceaccount?: { name?: string };
  };
  // Legacy service-account tokens carry the same facts as flat claims.
  'kubernetes.io/serviceaccount/namespace'?: string;
  'kubernetes.io/serviceaccount/service-account.name'?: string;
};

type HelmReleasePayload = {
  name?: string;
  namespace?: string;
  version?: number;
  info?: { status?: string, description?: string, last_deployed?: string };
  chart?: { metadata?: { name?: string, version?: string, appVersion?: string } };
};

const JWT_PATTERN = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]*$/;

/** `.dockercfg` is the legacy shape - the same map without the `auths` wrapper. */
const parseDockerConfig = (value: string): DockerCredential[] => {
  try {
    const config = JSON.parse(value) as { auths?: Record<string, DockerAuthEntry> } & Record<string, DockerAuthEntry>;
    const auths = config.auths ?? config;

    return Object.entries(auths).map(([registry, entry]) => {
      const [user, secret] = entry.auth ? atob(entry.auth).split(/:(.*)/s) : [];
      return {
        registry,
        username: entry.username || user || '',
        password: entry.password || secret || '',
        email: entry.email || ''
      };
    });
  } catch {
    return [];
  }
};

const decodeJwtSegment = (segment: string) => {
  const base64 = segment.replace(/-/g, '+').replace(/_/g, '/');
  return JSON.parse(atob(base64.padEnd(base64.length + (4 - base64.length % 4) % 4, '=')));
};

const parseJwt = (token: string): JwtSummary | null => {
  const trimmed = token.trim();
  if (!JWT_PATTERN.test(trimmed)) {
    return null;
  }

  try {
    const [header, payload] = trimmed.split('.');
    const { alg } = decodeJwtSegment(header) as { alg?: string };
    const claims = decodeJwtSegment(payload) as JwtPayload;
    if (!alg) {
      return null;
    }

    return {
      algorithm: alg,
      issuer: claims.iss || '',
      subject: claims.sub || '',
      audience: [claims.aud].flat().filter(Boolean).join(', '),
      issuedAt: claims.iat ? new Date(claims.iat * 1000) : null,
      expiresAt: claims.exp ? new Date(claims.exp * 1000) : null,
      namespace: claims['kubernetes.io']?.namespace || claims['kubernetes.io/serviceaccount/namespace'] || '',
      serviceAccount: claims['kubernetes.io']?.serviceaccount?.name || claims['kubernetes.io/serviceaccount/service-account.name'] || '',
      pod: claims['kubernetes.io']?.pod?.name || ''
    };
  } catch {
    return null;
  }
};

/** Helm stores the release as base64(gzip(json)), which k8s then base64s again. */
const parseHelmRelease = async (value: string): Promise<HelmRelease | null> => {
  try {
    const gzipped = Uint8Array.from(atob(atob(value)), (char) => char.charCodeAt(0));
    const stream = new Blob([gzipped]).stream().pipeThrough(new DecompressionStream('gzip'));
    const release = JSON.parse(await new Response(stream).text()) as HelmReleasePayload;
    const chart = release.chart?.metadata;

    return {
      name: release.name || '',
      namespace: release.namespace || '',
      revision: release.version ? String(release.version) : '',
      status: release.info?.status || '',
      chart: chart?.name ? `${chart.name}-${chart.version ?? ''}` : '',
      appVersion: chart?.appVersion || '',
      updated: release.info?.last_deployed ? new Date(release.info.last_deployed) : null,
      description: release.info?.description || ''
    };
  } catch {
    return null;
  }
};

export type { DockerCredential, HelmRelease, JwtSummary };

export {
  parseDockerConfig,
  parseHelmRelease,
  parseJwt
};
