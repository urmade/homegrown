import { ImageResponse } from "next/og";

const SIZES = [192, 512];

export function generateStaticParams() {
  return SIZES.map((size) => ({ size: String(size) }));
}

export async function GET(_: Request, { params }: { params: Promise<{ size: string }> }) {
  const size = Number((await params).size);
  if (!SIZES.includes(size)) return new Response("not found", { status: 404 });
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#3f7d4e" }}>
        <div style={{ width: "46%", height: "46%", borderRadius: "50% 0", background: "#f7f6f1", transform: "rotate(45deg)" }} />
      </div>
    ),
    { width: size, height: size },
  );
}
