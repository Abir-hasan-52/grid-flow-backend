import { z } from "zod";

const createAreaSchema = z.object({
	name: z.string({ message: "Area name is required" }).min(2),
	feederId: z.string({ message: "Feeder id is required" }).min(1),
});

const updateAreaSchema = z.object({
	name: z.string().min(2).optional(),
	feederId: z.string().min(1).optional(),
});

export const AreaValidation = {
	createAreaSchema,
	updateAreaSchema,
};
