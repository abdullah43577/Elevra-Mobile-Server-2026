import { Readable } from "stream";
import { type UploadApiResponse } from "cloudinary";
import { Prisma } from "../generated/prisma/client";
import { UserRepository } from "../repositories/user.repository";
import cloudinary from "../lib/cloudinary-config";

export class CloudinaryService {
  private userRepo = new UserRepository();

  async uploadFile(userId: string, file: Express.Multer.File, type: "avatar" | "auto") {
    try {
      return await new Promise<UploadApiResponse>((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          {
            folder: `users/${userId}/${type}`,
            resource_type: type === "avatar" ? "image" : "auto",
          },

          async (error, result) => {
            if (error) return reject(error);

            if (result?.secure_url) return resolve(result);

            reject(new Error("Cloudinary upload failed!"));
          },
        );

        const bufferStream = new Readable();
        bufferStream.push(file.buffer);
        bufferStream.push(null);
        bufferStream.pipe(stream);
      });
    } catch (error) {
      throw error;
    }
  }

  async deleteFile({ userId, publicId, resource_type, nullifyFields }: { userId: string; publicId: string; resource_type: "avatar" | "auto"; nullifyFields?: (keyof Prisma.UserUpdateInput)[] }) {
    try {
      const nullifyData = nullifyFields?.length ? (Object.fromEntries(nullifyFields.map(f => [f, null])) as Prisma.UserUpdateInput) : {};

      await Promise.all([cloudinary.uploader.destroy(publicId, { resource_type }), this.userRepo.updateUser(userId, nullifyData)]);
    } catch (error) {
      throw error;
    }
  }
}
