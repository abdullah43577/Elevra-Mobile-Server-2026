import { type Response } from "express";
import type { IUserRequest } from "../interface";
import { handleErrors } from "../lib/handle-errors";
import { searchQuerySchema } from "../schemas/search";
import { SearchService } from "../services/search.service";

export class SearchController {
  private searchService = new SearchService();

  async search(req: IUserRequest, res: Response) {
    try {
      const { userId } = req;
      const { q, limit } = searchQuerySchema.parse(req.query);

      const results = await this.searchService.search(userId!, {
        query: q,
        ...(limit && { limit }),
      });

      res.status(200).json({
        message: "Search results fetched successfully!",
        data: results,
      });
    } catch (error) {
      handleErrors({ res, error });
    }
  }
}
