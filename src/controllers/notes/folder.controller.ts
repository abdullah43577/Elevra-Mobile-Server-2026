import { type Response } from "express";
import type { IUserRequest } from "../../interface";
import { handleErrors } from "../../lib/handle-errors";
import { createFolderSchema, updateFolderSchema } from "../../schemas/notes";
import { FolderService } from "../../services/notes/folder.service";

export class FolderController {
  private folderService = new FolderService();

  async getFolders(req: IUserRequest, res: Response) {
    try {
      const { userId } = req;
      const folders = await this.folderService.getFolders(userId!);
      res.status(200).json({ message: "Folders fetched successfully!", data: folders });
    } catch (error) {
      handleErrors({ res, error });
    }
  }

  async getFolderById(req: IUserRequest, res: Response) {
    try {
      const { userId } = req;
      const { id } = req.params;

      const folder = await this.folderService.getFolderById(id as string, userId!);
      res.status(200).json({ message: "Folder retrieved successfully", data: folder });
    } catch (error) {
      handleErrors({ res, error });
    }
  }

  async createFolder(req: IUserRequest, res: Response) {
    try {
      const { userId } = req;
      const { name, color } = createFolderSchema.parse(req.body);

      const folder = await this.folderService.createFolder(userId!, name, color);
      res.status(201).json({ message: "Folder created successfully", data: folder });
    } catch (error) {
      handleErrors({ res, error });
    }
  }

  async updateFolder(req: IUserRequest, res: Response) {
    try {
      const { userId } = req;
      const { id } = req.params;
      const { name, color } = updateFolderSchema.parse(req.body);

      const updateData: { name?: string; color?: string } = {
        ...(name && { name }),
        ...(color !== undefined && { color }),
      };

      const folder = await this.folderService.updateFolder(id as string, userId!, updateData);
      res.status(200).json({ message: "Folder updated successfully", data: folder });
    } catch (error) {
      handleErrors({ res, error });
    }
  }

  async deleteFolder(req: IUserRequest, res: Response) {
    try {
      const { userId } = req;
      const { id } = req.params;

      await this.folderService.deleteFolder(id as string, userId!);
      res.status(204).json({ message: "Folder deleted successfully!" });
    } catch (error) {
      handleErrors({ res, error });
    }
  }
}
