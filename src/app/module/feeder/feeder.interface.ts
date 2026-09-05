export interface ICreateFeederPayload {
  name: string;
  substationId: string;
}

export interface IUpdateFeederPayload {
  name?: string;
  substationId?: string;
}

export interface IGetAllFeedersQuery {
  page?: number;
  limit?: number;
  search?: string;
  substationId?: string;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}