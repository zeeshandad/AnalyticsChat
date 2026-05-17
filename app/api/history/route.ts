import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const dbMessages = await prisma.message.findMany({
      orderBy: { createdAt: 'asc' },
    });

    // Map each SQLite message into the format expected by Vercel AI SDK on the client side
    const messages = dbMessages.map((msg) => {
      let toolInvocations = undefined;
      
      if (msg.toolInvocations) {
        try {
          const parsed = JSON.parse(msg.toolInvocations);
          if (Array.isArray(parsed)) {
            toolInvocations = parsed;
          }
        } catch (err) {
          console.error('Failed to parse toolInvocations from DB:', err);
        }
      }

      return {
        id: msg.id,
        role: msg.role,
        content: msg.content,
        createdAt: msg.createdAt,
        toolInvocations,
      };
    });

    return Response.json(messages);
  } catch (error: any) {
    console.error('GET History Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    const deleted = await prisma.message.deleteMany();
    return Response.json({ success: true, count: deleted.count });
  } catch (error: any) {
    console.error('DELETE History Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
