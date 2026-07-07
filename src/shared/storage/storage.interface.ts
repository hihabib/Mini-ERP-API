export interface StorageAdapter {
  saveImage(file: Express.Multer.File): Promise<string>;
  deleteImage(imageUrl: string): Promise<void>;
}
