import { neon } from "@neondatabase/serverless";

export async function POST(request: Request) {
  try {
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) {
      return Response.json({ success: true, message: "Mock user saved" }, { status: 200 });
    }

    const sql = neon(dbUrl);
    const { name, email, clerkId } = await request.json();

    if (!name || !email || !clerkId) {
      return Response.json(
        { error: "Missing required fields" },
        { status: 400 },
      );
    }

    const publicId = `VORA-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

    const response = await sql`
      INSERT INTO users (
        id,
        public_id,
        name, 
        email,
        role,
        verification_status
      ) 
      VALUES (
        ${clerkId},
        ${publicId},
        ${name}, 
        ${email},
        'PASSENGER',
        'verified'
      )
      ON CONFLICT (id) DO UPDATE
      SET name = EXCLUDED.name, email = EXCLUDED.email;`;

    return new Response(JSON.stringify({ data: response }), {
      status: 201,
    });
  } catch (error) {
    console.error("Error creating user:", error);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
