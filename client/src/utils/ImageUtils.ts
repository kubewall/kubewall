type NodeImage = {
  names?: (string | null)[] | null;
  sizeBytes?: number | null;
} | null;

type ImageSummary = {
  /** Last path segment - what a human calls the image, e.g. "n8n". */
  name: string;
  /** Everything before it, e.g. "docker.n8n.io/n8nio/". */
  prefix: string;
  tags: string[];
  digest: string;
  sizeBytes: number;
  names: string[];
};

const SIZE_UNITS = ['B', 'KB', 'MB', 'GB', 'TB'];

const formatBytes = (bytes: number) => {
  if (!bytes) {
    return '0 B';
  }
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), SIZE_UNITS.length - 1);
  const value = bytes / 1024 ** exponent;

  return `${value.toFixed(exponent && value < 100 ? 2 : 0)} ${SIZE_UNITS[exponent]}`;
};

/** Splits `[registry/]repository[:tag][@digest]` into its parts. */
const parseImageReference = (reference: string) => {
  const [pathAndTag, digest = ''] = reference.split('@');
  const lastSlash = pathAndTag.lastIndexOf('/');
  const lastColon = pathAndTag.lastIndexOf(':');
  const hasTag = lastColon > lastSlash;
  const repository = hasTag ? pathAndTag.slice(0, lastColon) : pathAndTag;

  return {
    repository,
    tag: hasTag ? pathAndTag.slice(lastColon + 1) : '',
    digest,
    name: repository.slice(repository.lastIndexOf('/') + 1),
    prefix: repository.slice(0, repository.lastIndexOf('/') + 1)
  };
};

/**
 * A node reports the same image once per name it is known by - the digest form
 * and the tagged form - so they are folded into a single entry, largest first.
 */
const summarizeNodeImages = (images: (NodeImage | undefined)[]): ImageSummary[] => images
  .flatMap((image) => {
    const names = (image?.names ?? []).filter((name): name is string => !!name);
    if (!names.length) {
      return [];
    }
    const parsed = names.map(parseImageReference);
    const tagged = parsed.find(({ tag }) => tag) ?? parsed[0];

    return [{
      name: tagged.name,
      prefix: tagged.prefix,
      tags: [...new Set(parsed.map(({ tag }) => tag).filter(Boolean))],
      digest: parsed.find(({ digest }) => digest)?.digest ?? '',
      sizeBytes: image?.sizeBytes ?? 0,
      names
    }];
  })
  .sort((a, b) => b.sizeBytes - a.sizeBytes);

export type { ImageSummary, NodeImage };

export {
  formatBytes,
  parseImageReference,
  summarizeNodeImages
};
