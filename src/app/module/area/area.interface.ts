export interface ICreateAreaPayload {
	name: string;
	feederId: string;
}

export interface IUpdateAreaPayload {
	name?: string;
	feederId?: string;
}

export interface IGetAllAreasQuery {
	page?: number;
	limit?: number;
	search?: string;
	feederId?: string;
	sortBy?: string;
	sortOrder?: "asc" | "desc";
}
