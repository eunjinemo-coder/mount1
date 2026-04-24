export const dynamic = 'force-dynamic';

export function GET() {
  return Response.json({
    status: 'ok',
    app: 'driver',
    version: process.env.NEXT_PUBLIC_APP_VERSION ?? 'dev',
    timestamp: new Date().toISOString(),
  });
}
