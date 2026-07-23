import { TagRepository } from "../../repositories/notes/tag.repository";
import { BadRequestError, NotFoundError } from "../../lib/errors";

export class TagService {
  private tagRepo = new TagRepository();

  async getTags(userId: string) {
    return this.tagRepo.findManyByUser(userId);
  }

  async getTagById(tagId: string, userId: string) {
    const tag = await this.tagRepo.findById(tagId, userId);
    if (!tag) throw new NotFoundError("Tag not found");
    return tag;
  }

  async createTag(userId: string, name: string) {
    // Check if tag already exists
    const existing = await this.tagRepo.findByName(userId, name.trim());
    if (existing) throw new BadRequestError("Tag already exists");

    return this.tagRepo.create(userId, name.trim());
  }

  async deleteTag(tagId: string, userId: string) {
    await this.getTagById(tagId, userId);
    return this.tagRepo.delete(tagId, userId);
  }
}
