import { type Response } from "express";
import { TagService } from "../../services/notes/tag.service";
import type { IUserRequest } from "../../interface";
import { handleErrors } from "../../lib/handle-errors";
import { createTagSchema } from "../../schemas/notes";

export class TagController {
  private tagService = new TagService();

  async getTags(req: IUserRequest, res: Response) {
    try {
      const { userId } = req;
      const tags = await this.tagService.getTags(userId!);
      res.status(200).json({ message: "Tags fetched successfully!", data: tags });
    } catch (error) {
      handleErrors({ res, error });
    }
  }

  async getTagById(req: IUserRequest, res: Response) {
    try {
      const { userId } = req;
      const { id } = req.params;

      const tag = await this.tagService.getTagById(id as string, userId!);
      res.status(200).json({ message: "Tag retrieved successfully", data: tag });
    } catch (error) {
      handleErrors({ res, error });
    }
  }

  async createTag(req: IUserRequest, res: Response) {
    try {
      const { userId } = req;
      const { name } = createTagSchema.parse(req.body);

      const tag = await this.tagService.createTag(userId!, name);
      res.status(201).json({ message: "Tag created successfully", data: tag });
    } catch (error) {
      handleErrors({ res, error });
    }
  }

  async deleteTag(req: IUserRequest, res: Response) {
    try {
      const { userId } = req;
      const { id } = req.params;

      await this.tagService.deleteTag(id as string, userId!);
      res.status(204).json({ message: "Tag deleted successfully!" });
    } catch (error) {
      handleErrors({ res, error });
    }
  }
}
