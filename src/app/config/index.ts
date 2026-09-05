/** biome-ignore-all lint/style/noNonNullAssertion: <explanation> */
import bcrypt from "bcryptjs";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.join(process.cwd(), ".env") });

export default {
	port: process.env.PORT,
	node_env: process.env.NODE_ENV,
	database_url: process.env.DATABASE_URL,
	frontend_url: process.env.FRONTEND_URL,
	bcrypt_salt_rounds: process.env.BCRYPT_SALT_ROUNDS,
	app_url: process.env.APP_URL,
	jwt_access_secret: process.env.JWT_ACCESS_SECRET!,
	jwt_access_expires_in: process.env.JWT_ACCESS_EXPIRES_IN!,
	jwt_refresh_secret: process.env.JWT_REFRESH_SECRET!,
	jwt_refresh_expires_in: process.env.JWT_REFRESH_EXPIRES_IN!,
	google_client_id: process.env.GOOGLE_CLIENT_ID!,
	admin_name: process.env.ADMIN_NAME!,
	admin_email: process.env.ADMIN_EMAIL!,
	admin_password: process.env.ADMIN_PASSWORD!,
	zone_manager_name: process.env.ZONE_MANAGER_NAME!,
	zone_manager_email: process.env.ZONE_MANAGER_EMAIL!,
	zone_manager_password: process.env.ZONE_MANAGER_PASSWORD!,

	technician_one_name: process.env.TECHNICIAN_ONE_NAME!,
	technician_one_email: process.env.TECHNICIAN_ONE_EMAIL!,
	technician_one_password: process.env.TECHNICIAN_ONE_PASSWORD!,

	technician_two_name: process.env.TECHNICIAN_TWO_NAME!,
	technician_two_email: process.env.TECHNICIAN_TWO_EMAIL!,
	technician_two_password: process.env.TECHNICIAN_TWO_PASSWORD!,

	customer_name: process.env.CUSTOMER_NAME!,
	customer_email: process.env.CUSTOMER_EMAIL!,
	customer_password: process.env.CUSTOMER_PASSWORD!,

	redis_user: process.env.REDIS_USER!,
	redis_password: process.env.REDIS_PASSWORD!,
	redis_port: process.env.REDIS_PORT!,
	redis_host: process.env.REDIS_HOST!,

	smtp_user: process.env.SMTP_USER!,
	smtp_password: process.env.SMTP_PASSWORD!,
	email_sender: process.env.EMAIL_SENDER!,
};
