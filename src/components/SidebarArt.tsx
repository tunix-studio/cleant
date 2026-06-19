import { BlobArt } from "./BlobArt";

/** The blob motif behind the sidebar (anchored to the top-right). */
export function SidebarArt() {
  return <BlobArt className="pointer-events-none absolute inset-0 h-full w-full" />;
}
