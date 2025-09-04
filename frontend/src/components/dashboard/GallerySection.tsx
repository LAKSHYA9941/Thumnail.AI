import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Image as ImageIcon, Settings, Download, Copy, Trash2, Plus } from "lucide-react";

interface Thumbnail {
  _id: string;
  prompt: string;
  imageUrl: string;
  originalImageUrl?: string;
  queryRewrite?: string;
  createdAt: string;
}

interface Props {
  thumbnails: Thumbnail[];
  setActiveChat: () => void;
  downloadImage: (url: string, prompt: string) => void | Promise<void>;
  copyToClipboard: (text: string) => void;
  deleteThumbnail: (id: string) => void | Promise<void>;
}

export default function GallerySection({ thumbnails, setActiveChat, downloadImage, copyToClipboard, deleteThumbnail }: Props) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {thumbnails.length === 0 ? (
          <div className="col-span-full text-center py-12">
            <ImageIcon className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No thumbnails yet</h3>
            <p className="text-gray-500 mb-4">Generate your first thumbnail to see it here</p>
            <Button onClick={setActiveChat}>
              <Plus className="w-4 h-4 mr-2" />
              Start Chatting
            </Button>
          </div>
        ) : (
          thumbnails.map((thumbnail) => (
            <motion.div key={thumbnail._id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="group">
              <Card className="overflow-hidden hover:shadow-lg transition-shadow">
                <div className="relative">
                  <img src={`${thumbnail.imageUrl}`} alt="YT-thumbnail" className="w-full h-48 object-cover" />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
                  <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button size="sm" variant="secondary">
                          <Settings className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent>
                        <DropdownMenuItem onClick={() => downloadImage(thumbnail.imageUrl, thumbnail.prompt)}>
                          <Download className="w-4 h-4 mr-2" />
                          Download
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => copyToClipboard(thumbnail.prompt)}>
                          <Copy className="w-4 h-4 mr-2" />
                          Copy Prompt
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => deleteThumbnail(thumbnail._id)}>
                          <Trash2 className="w-4 h-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
                <CardContent className="p-4">
                  <p className="text-sm text-gray-600 line-clamp-2">{thumbnail.prompt}</p>
                  <div className="flex items-center justify-between mt-2">
                    <p className="text-xs text-gray-400">{new Date(thumbnail.createdAt).toLocaleDateString()}</p>
                    {thumbnail.queryRewrite && (
                      <Badge variant="secondary" className="text-xs">Enhanced</Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))
        )}
      </div>
    </div>
  );
}


