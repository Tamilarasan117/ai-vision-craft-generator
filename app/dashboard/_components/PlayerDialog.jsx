import React, { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Player } from "@remotion/player";
import RemotionVideo from "./RemotionVideo";
import { Button } from "@/components/ui/button";
import { db } from "@/configs/db";
import { VideoData } from "@/configs/schema";
import { eq } from "drizzle-orm";
import { useRouter } from "next/navigation";

function PlayerDialog({ playVideo, videoId }) {
  const [openDialog, setOpenDialog] = useState(false);
  const [videoData, setVideoData] = useState();
  const [durationInFrame, setDurationInFrame] = useState(100);
  const [loadingExport, setLoadingExport] = useState(false);
  const [exportError, setExportError] = useState(null);
  const router = useRouter();

  useEffect(() => {
    if (videoId) {
      setOpenDialog(true);
      GetVideoData();
    }
  }, [playVideo, videoId]);

  const GetVideoData = async () => {
    try {
      const result = await db
        .select()
        .from(VideoData)
        .where(eq(VideoData.id, videoId));
      setVideoData(result[0]);
    } catch (error) {
      console.error("Failed to fetch video data", error);
    }
  };

  const downloadVideo = async (videoData) => {
    try {
      setLoadingExport(true);
      setExportError(null);

      const response = await fetch("http://localhost:4000/export-video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(videoData),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Export failed: ${errorText}`);
      }

      const data = await response.json();

      if (!data?.result) {
        throw new Error(data?.error || "Unknown export error");
      }

      const link = document.createElement("a");
      link.href = data.result;
      link.download = `video-${videoId}.mp4`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error("Export failed:", error);
      setExportError(error.message || "Export failed");
    } finally {
      setLoadingExport(false);
    }
  };

  return (
    <Dialog open={openDialog} onOpenChange={setOpenDialog}>
      <DialogContent className="bg-white flex flex-col items-center">
        <DialogHeader>
          <DialogTitle className="text-3xl font-bold my-5">
            Your video is ready
          </DialogTitle>
          <DialogDescription>
            Watch the preview or export the video.
          </DialogDescription>
        </DialogHeader>

        {videoData && (
          <Player
            component={RemotionVideo}
            durationInFrames={Number(durationInFrame.toFixed(0)) + 100}
            compositionWidth={320}
            compositionHeight={450}
            fps={30}
            controls={true}
            inputProps={{
              ...videoData,
              setDurationInFrame: (frameValue) =>
                setDurationInFrame(frameValue),
              isPreview: false,
            }}
          />
        )}
        <div className="flex gap-10 mt-10">
          <Button
            variant="ghost"
            onClick={() => {
              router.replace("/dashboard");
              setOpenDialog(false);
            }}
            disabled={loadingExport}
          >
            Close
          </Button>
          {exportError && (
            <div className="text-red-600 mt-4">{exportError}</div>
          )}
          <Button
            onClick={() => downloadVideo(videoData)}
            disabled={loadingExport || !videoData}
          >
            {loadingExport ? "Exporting..." : "Export"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default PlayerDialog;
