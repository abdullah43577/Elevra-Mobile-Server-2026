import { FolderRepository } from "../../repositories/notes/folder.repository";
import { NotFoundError, ConflictError } from "../../lib/errors";

export class FolderService {
  private folderRepo = new FolderRepository();

  async getFolders(userId: string) {
    try {
      return await this.folderRepo.findManyByUser(userId);
    } catch (error) {
      throw error;
    }
  }

  async getFolderById(folderId: string, userId: string) {
    try {
      const folder = await this.folderRepo.findById(folderId, userId);
      if (!folder) throw new NotFoundError("Folder not found");
      return folder;
    } catch (error) {
      throw error;
    }
  }

  async createFolder(userId: string, name: string, color?: string) {
    try {
      const existing = await this.folderRepo.findManyByUser(userId);
      if (existing.some(f => f.name.toLowerCase() === name.toLowerCase())) {
        throw new ConflictError("Folder with this name already exists");
      }

      const folderData: {
        userId: string;
        name: string;
        color?: string;
      } = {
        userId,
        name: name.trim(),
        ...(color && { color }),
      };

      return await this.folderRepo.create(folderData);
    } catch (error) {
      throw error;
    }
  }

  async updateFolder(
    folderId: string,
    userId: string,
    data: {
      name?: string;
      color?: string;
    },
  ) {
    try {
      await this.getFolderById(folderId, userId);

      if (data.name) {
        const existing = await this.folderRepo.findManyByUser(userId);
        const duplicate = existing.some(f => f.id !== folderId && f.name.toLowerCase() === data.name!.toLowerCase());
        if (duplicate) {
          throw new ConflictError("Folder with this name already exists");
        }
      }

      const updateData: {
        name?: string;
        color?: string;
      } = {
        ...(data.name && { name: data.name.trim() }),
        ...(data.color !== undefined && { color: data.color }),
      };

      return await this.folderRepo.update(folderId, userId, updateData);
    } catch (error) {
      throw error;
    }
  }

  async deleteFolder(folderId: string, userId: string) {
    try {
      await this.getFolderById(folderId, userId);

      const folder = await this.folderRepo.findById(folderId, userId);
      if (folder && folder._count?.notes > 0) {
        throw new ConflictError("Cannot delete folder with notes. Move or delete notes first.");
      }

      return await this.folderRepo.delete(folderId, userId);
    } catch (error) {
      throw error;
    }
  }

  async getFolderNotesCount(folderId: string, userId: string) {
    try {
      const folder = await this.folderRepo.findById(folderId, userId);
      if (!folder) throw new NotFoundError("Folder not found");
      return folder._count?.notes || 0;
    } catch (error) {
      throw error;
    }
  }
}
