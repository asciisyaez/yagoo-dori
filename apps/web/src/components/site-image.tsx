import NextImage, { type ImageProps } from "next/image";

import { sitePath } from "@/lib/site-path";

type SiteImageProps = ImageProps & {
  preview?: boolean;
};

function previewPath(src: string) {
  return /^\/game\/illustrations\/[^/?#]+\.webp$/.test(src)
    ? src.replace("/game/illustrations/", "/game/previews/")
    : src;
}

export function SiteImage({ preview = false, src, ...props }: SiteImageProps) {
  const selectedSource = preview && typeof src === "string" ? previewPath(src) : src;
  return (
    <NextImage
      {...props}
      src={typeof selectedSource === "string" ? sitePath(selectedSource) : selectedSource}
    />
  );
}
