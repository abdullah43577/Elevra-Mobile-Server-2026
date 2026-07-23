import { type Response } from "express";
import { NoteService } from "../../services/notes/note.service";
import type { IUserRequest } from "../../interface";
import { handleErrors } from "../../lib/handle-errors";
import { createNoteSchema, getNotesQuerySchema, updateNoteSchema } from "../../schemas/notes";

export class NoteController {
  private noteService = new NoteService();

  async getNotes(req: IUserRequest, res: Response) {
    try {
      const { userId } = req;
      const { folderId, search } = getNotesQuerySchema.parse(req.query);

      const notes = await this.noteService.getNotes(userId!, {
        folderId: folderId as string,
        search: search as string,
      });

      res.status(200).json({ message: "Note fetched successfully!", data: notes });
    } catch (error) {
      handleErrors({ res, error });
    }
  }

  async getArchivedNotes(req: IUserRequest, res: Response) {
    try {
      const { userId } = req;
      const notes = await this.noteService.getArchivedNotes(userId!);
      res.status(200).json({ message: "Archived note fetched successfully!", data: notes });
    } catch (error) {
      handleErrors({ res, error });
    }
  }

  async getNoteById(req: IUserRequest, res: Response) {
    try {
      const { userId } = req;
      const { id } = req.params;

      const note = await this.noteService.getNoteById(id as string, userId!);
      res.status(200).json({ message: "Note retrieved successfully", data: note });
    } catch (error) {
      handleErrors({ res, error });
    }
  }

  async createNote(req: IUserRequest, res: Response) {
    try {
      const { userId } = req;
      const { title, content, folderId, tagNames } = createNoteSchema.parse(req.body);

      // Build the data object with conditional spreading
      const noteData: {
        userId: string;
        title: string;
        content?: string;
        folderId?: string;
        tagNames?: string[];
      } = {
        userId: userId!,
        title,
        ...(content && { content }),
        ...(folderId && { folderId }),
        ...(tagNames?.length && { tagNames }),
      };

      const note = await this.noteService.createNote(noteData);

      res.status(201).json({ message: "Note Created Successfully", data: note });
    } catch (error) {
      handleErrors({ res, error });
    }
  }

  async updateNote(req: IUserRequest, res: Response) {
    try {
      const { userId } = req;
      const { id } = req.params;
      const { title, content, folderId, isArchived, isPinned } = updateNoteSchema.parse(req.body);

      // Build the data object with conditional spreading
      const updateData: {
        title?: string;
        content?: string;
        folderId?: string | null;
        isArchived?: boolean;
        isPinned?: boolean;
      } = {
        ...(title && { title }),
        // For content, use !== undefined so we can set it to null/empty
        ...(content !== undefined && { content }),
        // For folderId, use !== undefined so we can set it to null
        ...(folderId !== undefined && { folderId }),
        ...(isArchived !== undefined && { isArchived }),
        ...(isPinned !== undefined && { isPinned }),
      };

      const note = await this.noteService.updateNote(id as string, userId!, updateData);

      res.status(200).json({ message: "Note updated successfully", data: note });
    } catch (error) {
      handleErrors({ res, error });
    }
  }

  async deleteNote(req: IUserRequest, res: Response) {
    try {
      const { userId } = req;
      const { id } = req.params;

      await this.noteService.deleteNote(id as string, userId!);
      res.status(204).json({ message: "Note deleted successfully!" });
    } catch (error) {
      handleErrors({ res, error });
    }
  }

  async toggleArchive(req: IUserRequest, res: Response) {
    try {
      const { userId } = req;
      const { id } = req.params;

      const note = await this.noteService.toggleArchive(id as string, userId!);
      res.status(200).json({ message: "Archive toggled successfully!", data: note });
    } catch (error) {
      handleErrors({ res, error });
    }
  }

  async togglePin(req: IUserRequest, res: Response) {
    try {
      const { userId } = req;
      const { id } = req.params;

      const note = await this.noteService.togglePin(id as string, userId!);
      res.status(200).json({ message: "Pin toggled successfully", data: note });
    } catch (error) {
      handleErrors({ res, error });
    }
  }

  async generateSummary(req: IUserRequest, res: Response) {
    try {
      const { userId } = req;
      const { id } = req.params;

      const result = await this.noteService.generateSummary(id as string, userId!);
      res.status(200).json({ message: "Summary generated successfully", data: result });
    } catch (error) {
      handleErrors({ res, error });
    }
  }
}
