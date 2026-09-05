import { z } from "zod";

const createSubstationValidationSchema = z.object({
	name: z
		.string()
		.min(2, "Substation name must be at least 2 characters")
		.max(100, "Substation name cannot exceed 100 characters"),

	powerZoneId: z.string().min(1, "Power zone ID is required"),
});

const updateSubstationValidationSchema = z
	.object({
		name: z
			.string()
			.min(2, "Substation name must be at least 2 characters")
			.max(100, "Substation name cannot exceed 100 characters")
			.optional(),

		powerZoneId: z.string().min(1, "Power zone ID is required").optional(),
	})
	.refine((data) => Object.keys(data).length > 0, {
		message: "At least one field is required for update",
	});

export const SubstationValidation = {
	createSubstationValidationSchema,
	updateSubstationValidationSchema,
};
