import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, Copy, Trash2, RefreshCw } from "lucide-react";

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
  downloadImage: (url: string, prompt: string) => void | Promise<void>;
  copyToClipboard: (text: string) => void;
  deleteThumbnail: (id: string) => void | Promise<void>;
}

export default function HistorySection({ thumbnails, downloadImage, copyToClipboard, deleteThumbnail }: Props) {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Generation History</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {thumbnails.length === 0 ? (
              <div className="text-center py-8">
                <RefreshCw className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500">No generation history yet</p>
              </div>
            ) : (
              thumbnails.map((thumbnail) => (
                <div key={thumbnail._id} className="flex items-center space-x-4 p-4 border rounded-lg hover:bg-gray-700">
                  <img src={`${thumbnail.imageUrl}`} alt='YT-thumbnail' className="w-16 h-16 object-cover rounded-lg" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-50 truncate">{thumbnail.prompt}</p>
                    <p className="text-xs text-gray-500">{new Date(thumbnail.createdAt).toLocaleString()}</p>
                    {thumbnail.queryRewrite && (
                      <p className="text-xs text-purple-600 mt-1">Enhanced prompt used</p>
                    )}
                  </div>
                  <div className="flex space-x-2">
                    <Button size="sm" variant="outline" onClick={() => downloadImage(thumbnail.imageUrl, thumbnail.prompt)}>
                      <Download className="w-4 h-4" />
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => copyToClipboard(thumbnail.prompt)}>
                      <Copy className="w-4 h-4" />
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => deleteThumbnail(thumbnail._id)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}


