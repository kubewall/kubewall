import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ImageSummary, NodeImage, formatBytes, summarizeNodeImages } from "@/utils/ImageUtils";
import { memo, useMemo, useState } from "react";

import { CopyToClipboard } from "@/components/app/Common/CopyToClipboard";
import { Input } from "@/components/ui/input";

type NodeImagesProps = {
  images?: (NodeImage | undefined)[] | null;
};

const COLLAPSED_COUNT = 10;
const DIGEST_HEAD = 14;
const DIGEST_TAIL = 6;

const shortenDigest = (digest: string) => digest.length > DIGEST_HEAD + DIGEST_TAIL
  ? `${digest.slice(0, DIGEST_HEAD)}…${digest.slice(-DIGEST_TAIL)}`
  : digest;

const ImageRow = ({ image, widestBytes }: { image: ImageSummary, widestBytes: number }) => (
  <div className="group/item relative overflow-hidden rounded-md border border-dashed">
    {/* The row doubles as its own bar - relative size reads at a glance without costing height. */}
    <div
      className="absolute inset-y-0 left-0 bg-secondary"
      style={{ width: `${widestBytes ? (image.sizeBytes / widestBytes) * 100 : 0}%` }}
      aria-hidden
    />
    <div className="relative flex flex-row items-center gap-3 px-3 py-2">
      <div className="min-w-0 flex-1">
        <div className="flex flex-row flex-wrap items-baseline gap-x-1.5 gap-y-1">
          <span className="text-sm">
            <span className="text-muted-foreground">{image.prefix}</span>
            <span className="font-medium">{image.name}</span>
          </span>
          {
            image.tags.map((tag) => (
              <span key={tag} className="rounded bg-primary/10 px-1.5 py-0.5 font-mono text-xs">{tag}</span>
            ))
          }
        </div>
        {
          !!image.digest &&
          <div className="mt-0.5 font-mono text-xs text-muted-foreground">{shortenDigest(image.digest)}</div>
        }
      </div>
      <span className="shrink-0 text-sm tabular-nums">{formatBytes(image.sizeBytes)}</span>
      <span className="group/edit invisible shrink-0 group-hover/item:visible">
        <CopyToClipboard val={image.names.join('\n')} />
      </span>
    </div>
  </div>
);

const NodeImages = memo(function ({ images }: NodeImagesProps) {
  const [query, setQuery] = useState('');
  const [showAll, setShowAll] = useState(false);

  const summaries = useMemo(() => summarizeNodeImages(images ?? []), [images]);
  const matches = useMemo(() => {
    const term = query.trim().toLowerCase();
    return term ? summaries.filter(({ names }) => names.some((name) => name.toLowerCase().includes(term))) : summaries;
  }, [summaries, query]);

  if (!summaries.length) {
    return null;
  }

  const totalBytes = summaries.reduce((total, { sizeBytes }) => total + sizeBytes, 0);
  const visible = showAll ? matches : matches.slice(0, COLLAPSED_COUNT);

  return (
    <Card className="shadow-none rounded-lg">
      <CardHeader className="p-4">
        <CardTitle className="flex flex-row flex-wrap items-center gap-2 text-sm font-medium">
          <span>Images <span className="text-xs">({summaries.length})</span></span>
          <span className="text-xs font-normal text-muted-foreground">{formatBytes(totalBytes)} total</span>
          <Input
            type="search"
            value={query}
            placeholder="Filter images"
            onChange={(event) => setQuery(event.target.value)}
            className="ml-auto h-7 w-48 text-xs font-normal shadow-none"
          />
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4">
        <div className="grid items-start gap-1.5">
          {
            visible.map((image) => (
              <ImageRow key={image.names[0]} image={image} widestBytes={summaries[0].sizeBytes} />
            ))
          }
          {
            !matches.length &&
            <div className="py-2 text-sm text-muted-foreground">No images match “{query}”.</div>
          }
          {
            matches.length > COLLAPSED_COUNT &&
            <button
              className="justify-self-start text-xs text-blue-600 hover:underline dark:text-blue-500"
              onClick={() => setShowAll(!showAll)}
            >
              {showAll ? 'view less [-]' : `view all ${matches.length} [+]`}
            </button>
          }
        </div>
      </CardContent>
    </Card>
  );
});

export {
  NodeImages
};
