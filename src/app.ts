/** biome-ignore-all assist/source/organizeImports: <explanation> */
import cookieParser from "cookie-parser";
import cors from "cors";
import express, {
	type Application,
	type Request,
	type Response,
} from "express";
import httpStatus from "http-status";
import config from "./app/config";
import { globalErrorHandler } from "./app/middleware/globalErrorHandler";
import { notFound } from "./app/middleware/notFound";
import { AuthRoutes } from "./app/module/auth/auth.route";
import { ZoneRoutes } from "./app/module/zone/zone.route";
import { SubstationRoutes } from "./app/module/substation/substation.route";
import { FeederRoutes } from "./app/module/feeder/feeder.route";
import { AreaRoutes } from "./app/module/feeder/area/area.route";
// import { AuthRoutes } from './app/module/auth/auth.route'

const app: Application = express();

app.use(
	cors({
		origin: config.frontend_url,
		credentials: true,
	}),
);

// Enable URL-encoded form data parsing
app.use(express.urlencoded({ extended: true }));

// Middleware to parse JSON bodies
app.use(express.json());
app.use(cookieParser());

app.use("/api/v1/auth", AuthRoutes);
app.use("/api/v1/zone", ZoneRoutes);
app.use("/api/v1/substation", SubstationRoutes);
app.use("/api/v1/feeder", FeederRoutes);
app.use("/api/v1/area", AreaRoutes);

// Basic route
app.get("/", async (req: Request, res: Response) => {
	res.status(httpStatus.OK).json({
		success: true,
		message: "Welcome to GridFlow Backend",
	});
});

app.use(globalErrorHandler);
app.use(notFound);

export default app;
