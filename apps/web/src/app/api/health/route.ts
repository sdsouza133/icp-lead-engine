// Railway's healthcheck hits this before routing traffic to a new deploy.
export const dynamic = "force-dynamic";

export function GET() {
  return Response.json({ status: "ok" });
}
