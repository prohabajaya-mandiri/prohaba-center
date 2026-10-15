// Database initialization must never be exposed as a destructive HTTP endpoint.
export async function GET() {
  return Response.json({ error: 'HTTP seeding dinonaktifkan.' }, { status: 410 });
}
