import { neon } from "@neondatabase/serverless";

const DEFAULT_DRIVERS = [
  {
    id: "1",
    first_name: "Grégoire",
    last_name: "Legrand",
    profile_image_url: "https://ucarecdn.com/dae9be8a-fc66-43c0-988b-b37e1f7d1788/-/preview/1000x1000/",
    car_image_url: "https://ucarecdn.com/a2dc52b2-8bf7-4e19-9a70-388147d3e696/-/preview/465x466/",
    car_seats: 4,
    rating: "4.90",
  },
  {
    id: "2",
    first_name: "Amassoka",
    last_name: "Michelle",
    profile_image_url: "https://ucarecdn.com/684fb6a2-f8b4-4672-986e-b1441582217c/-/preview/1000x1000/",
    car_image_url: "https://ucarecdn.com/dae9be8a-fc66-43c0-988b-b37e1f7d1788/-/preview/1000x1000/",
    car_seats: 4,
    rating: "4.85",
  },
];

export async function GET(request: Request) {
  try {
    if (process.env.DATABASE_URL && process.env.DATABASE_URL.includes("neon.tech")) {
      const sql = neon(`${process.env.DATABASE_URL}`);
      const response = await sql`SELECT * FROM drivers`;
      if (Array.isArray(response) && response.length > 0) {
        return Response.json({ data: response });
      }
    }
  } catch (error) {
    console.error("Using default VORA drivers:", error);
  }

  return Response.json({ data: DEFAULT_DRIVERS });
}
