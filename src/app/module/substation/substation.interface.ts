export interface ICreateSubstationPayload {
	name: string;
	powerZoneId: string;
}

export interface IGetAllSubstationsQuery {
	page?: number;
	limit?: number;
	search?: string;
	powerZoneId?: string;
	sortBy?: "name" | "createdAt" | "updatedAt";
	sortOrder?: "asc" | "desc";
}

export interface IUpdateSubstationPayload {
	name?: string;
	powerZoneId?: string;
}
