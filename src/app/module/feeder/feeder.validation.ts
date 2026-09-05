import { z } from "zod";

const createFeederSchema = z.object({
	name: z.string({ message: "Feeder name is required" }).min(2),
	substationId: z.string({ message: "Substation id is required" }).min(1),
});

const updateFeederSchema = z.object({
	name: z.string().min(2).optional(),
	substationId: z.string().min(1).optional(),
});

export const FeederValidation = {
	createFeederSchema,
	updateFeederSchema,
};
