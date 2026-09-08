import { neon } from "@neondatabase/serverless";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      origin_address,
      destination_address,
      origin_latitude,
      origin_longitude,
      destination_latitude,
      destination_longitude,
      ride_time,
      fare_price,
      payment_status,
      driver_id,
      user_id,
    } = body;

    if (
      !origin_address ||
      !destination_address ||
      !origin_latitude ||
      !origin_longitude ||
      !destination_latitude ||
      !destination_longitude ||
      !fare_price ||
      !user_id
    ) {
      return Response.json(
        { error: "Missing required fields" },
        { status: 400 },
      );
    }

    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) {
      return Response.json({ error: "DATABASE_URL not configured" }, { status: 500 });
    }

    const sql = neon(dbUrl);
    const rideId = `VORA-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    // Ensure user exists in users table to satisfy foreign key constraint
    await sql`
      INSERT INTO users (id, name, email, role, verification_status)
      VALUES (${user_id}, 'Passager VORA', ${user_id + '@vora.cm'}, 'PASSENGER', 'verified')
      ON CONFLICT (id) DO NOTHING;
    `;

    const response = await sql`
      INSERT INTO rides ( 
          id,
          rider_id,
          driver_id,
          origin_address, 
          destination_address, 
          origin_lat, 
          origin_lng, 
          dest_lat, 
          dest_lng, 
          fare_fcfa, 
          payment_status,
          vehicle_type,
          status
      ) VALUES (
          ${rideId},
          ${user_id},
          ${driver_id ? parseInt(driver_id, 10) : null},
          ${origin_address},
          ${destination_address},
          ${origin_latitude},
          ${origin_longitude},
          ${destination_latitude},
          ${destination_longitude},
          ${Math.round(fare_price)},
          ${payment_status || "PAID"},
          'taxi',
          'ACCEPTED'
      )
      RETURNING *;
    `;

    return Response.json({ data: response[0] }, { status: 201 });
  } catch (error) {
    console.error("Error inserting data into rides:", error);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
