import mongoose, { Document, Schema } from "mongoose";

export interface IThumbnail extends Document {
  userId: mongoose.Types.ObjectId;
  prompt: string;
  imageUrl: string;
  originalImageUrl?: string;
  queryRewrite?: string;
  createdAt: Date;
}

const thumbnailSchema = new Schema<IThumbnail>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    prompt: { type: String, required: true },
    imageUrl: { type: String, required: true },
    originalImageUrl: { type: String },
    queryRewrite: { type: String },
  },
  { timestamps: true }
);

export const Thumbnail = mongoose.model<IThumbnail>("Thumbnail", thumbnailSchema);
