import { neon } from "@neondatabase/serverless";

export async function GET(request: Request, { id }: { id: string }) {
  if (!id)
    return Response.json({ data: [] });

  try {
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) {
      return Response.json({ data: [] });
    }

    const sql = neon(dbUrl);
    const response = await sql`
        SELECT
            rides.id AS ride_id,
            rides.origin_address,
            rides.destination_address,
            rides.origin_lat AS origin_latitude,
            rides.origin_lng AS origin_longitude,
            rides.dest_lat AS destination_latitude,
            rides.dest_lng AS destination_longitude,
            COALESCE(EXTRACT(EPOCH FROM (COALESCE(rides.updated_at, rides.created_at) - rides.created_at))::int / 60, 12) AS ride_time,
            rides.fare_fcfa AS fare_price,
            rides.payment_status,
            rides.created_at,
            rides.status,
            rides.vehicle_type,
            json_build_object(
                'driver_id', drivers.id,
                'first_name', COALESCE(split_part(users.name, ' ', 1), 'Chauffeur'),
                'last_name', COALESCE(NULLIF(split_part(users.name, ' ', 2), ''), 'VORA'),
                'profile_image_url', COALESCE(users.avatar_url, 'https://ucarecdn.com/dae9be8a-fc66-43c0-988b-b37e1f7d1788/-/preview/1000x1000/'),
                'car_image_url', 'https://ucarecdn.com/a2dc52b2-8bf7-4e19-9a70-388147d3e696/-/preview/465x466/',
                'car_seats', CASE WHEN drivers.vehicle_type = 'moto' THEN 1 ELSE 4 END,
                'rating', COALESCE(drivers.rating, 5.0)
            ) AS driver 
        FROM 
            rides
        LEFT JOIN
            drivers ON rides.driver_id = drivers.id
        LEFT JOIN
            users ON drivers.user_id = users.id
        WHERE 
            rides.rider_id = ${id}
        ORDER BY 
            rides.created_at DESC;
    `;

    return Response.json({ data: response });
  } catch (error) {
    console.error("Error fetching recent rides:", error);
    return Response.json({ data: [] });
  }
}
