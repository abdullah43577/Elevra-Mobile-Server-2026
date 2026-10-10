import { streamText } from "../../lib/ai";
import { assertAiQuota, consumeAiQuota } from "../../lib/ai-quota";
import { assertPro, PRO_FEATURES } from "../../lib/entitlements";
import { BadRequestError, NotFoundError } from "../../lib/errors";
import { FolderRepository } from "../../repositories/notes/folder.repository";
import { NoteRepository } from "../../repositories/notes/note.repository";
import { TagRepository } from "../../repositories/notes/tag.repository";

const SUMMARY_SYSTEM_PROMPT = [
  "You summarise a person's own notes for them.",
  "Write 2-3 plain sentences covering the main topic and the key takeaways, in the note's language.",
  "No preamble, no headings, no markdown, no bullet points.",
].join(" ");

// Far beyond any normal note; keeps one pasted book from eating a provider's
// per-minute token budget for everyone.
const MAX_SUMMARY_INPUT_CHARS = 40_000;

export class NoteService {
  private noteRepo = new NoteRepository();
  private folderRepo = new FolderRepository();
  private tagRepo = new TagRepository();

  async getNotes(userId: string, options?: { folderId?: string; search?: string }) {
    // Build options with conditional spreading to avoid undefined values
    const repoOptions: { folderId?: string; search?: string } = {
      ...(options?.folderId && { folderId: options.folderId }),
      ...(options?.search && { search: options.search }),
    };

    return this.noteRepo.findManyByUser(userId, {
      ...repoOptions,
      isArchived: false,
    });
  }

  async getArchivedNotes(userId: string) {
    try {
      return this.noteRepo.findManyByUser(userId, {
        isArchived: true,
      });
    } catch (error) {
      throw error;
    }
  }

  async getNoteById(noteId: string, userId: string) {
    try {
      const note = await this.noteRepo.findById(noteId, userId);

      if (!note) throw new BadRequestError("Note not found!");

      return note;
    } catch (error) {
      throw error;
    }
  }

  async createNote(data: { userId: string; title: string; content?: string; folderId?: string; tagNames?: string[] }) {
    // Validate folder exists if provided
    if (data.folderId) {
      const folder = await this.folderRepo.findById(data.folderId, data.userId);
      if (!folder) throw new NotFoundError("Folder not found");
    }

    // Process tags - upsert if they don't exist
    let tagIds: string[] = [];
    if (data.tagNames?.length) {
      const tags = await Promise.all(data.tagNames.map(name => this.tagRepo.upsert(data.userId, name.trim())));
      tagIds = tags.map(tag => tag.id);
    }

    // Build repository data with conditional spreading
    const repoData: {
      userId: string;
      title: string;
      content?: string;
      folderId?: string;
      tagIds?: string[];
    } = {
      userId: data.userId,
      title: data.title,
      ...(data.content && { content: data.content }),
      ...(data.folderId && { folderId: data.folderId }),
      ...(tagIds.length && { tagIds }),
    };

    return this.noteRepo.create(repoData);
  }

  async updateNote(
    noteId: string,
    userId: string,
    data: {
      title?: string;
      content?: string;
      folderId?: string | null;
      isArchived?: boolean;
      isPinned?: boolean;
    },
  ) {
    // Verify note exists
    await this.getNoteById(noteId, userId);

    // Validate folder if provided
    if (data.folderId) {
      const folder = await this.folderRepo.findById(data.folderId, userId);
      if (!folder) {
        throw new NotFoundError("Folder not found");
      }
    }

    return this.noteRepo.update(noteId, userId, data);
  }

  async deleteNote(noteId: string, userId: string) {
    // Verify note exists
    await this.getNoteById(noteId, userId);
    return this.noteRepo.delete(noteId, userId);
  }

  async toggleArchive(noteId: string, userId: string) {
    const note = await this.getNoteById(noteId, userId);
    return this.noteRepo.update(noteId, userId, {
      isArchived: !note.isArchived,
    });
  }

  async togglePin(noteId: string, userId: string) {
    const note = await this.getNoteById(noteId, userId);
    return this.noteRepo.update(noteId, userId, {
      isPinned: !note.isPinned,
    });
  }

  // Read-only pre-check for the controller, which must refuse before the SSE
  // headers go out or the status code is fixed at 200.
  async assertCanSummarize(userId: string) {
    await assertPro(userId, PRO_FEATURES.AI_NOTE_SUMMARY);
    await assertAiQuota(userId);
  }

  /*
    Takes userId purely so the entitlement and quota checks live here rather
    than in the controller. A controller-only guard is bypassed the moment a
    second route points at this method.
  */
  async streamSummary(userId: string, text: string, onChunk: (chunk: string) => void): Promise<string> {
    await assertPro(userId, PRO_FEATURES.AI_NOTE_SUMMARY);
    await consumeAiQuota(userId);

    const { text: summary } = await streamText({
      system: SUMMARY_SYSTEM_PROMPT,
      prompt: text.slice(0, MAX_SUMMARY_INPUT_CHARS),
      temperature: 0.3,
      reasoningEffort: "low",
      maxTokens: 2048,
      onChunk,
    });

    return summary.trim();
  }

  /**
   * Save summary to database
   */
  async saveSummary(noteId: string, userId: string, summary: string) {
    await this.noteRepo.updateSummary(noteId, userId, summary);
  }
}
