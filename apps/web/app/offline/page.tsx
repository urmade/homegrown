import { EmptyState, PageHeader } from "@homegrown/ui";

export default function Offline() {
  return (
    <>
      <PageHeader title="Offline" />
      <EmptyState>Diese Seite ist offline nicht verfügbar. Sobald du wieder verbunden bist, lädt sie wieder.</EmptyState>
    </>
  );
}
