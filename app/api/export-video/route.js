// app/api/export-video/route.js
import { NextResponse } from "next/server";
import ffmpeg from "fluent-ffmpeg";
import path from "path";
import fs from "fs/promises";
import { v4 as uuidv4 } from "uuid";
import fetch from "node-fetch";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

async function downloadFile(url, destPath) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to download ${url}: ${res.statusText}`);
  const buffer = await res.buffer();
  await fs.writeFile(destPath, buffer);
  return destPath;
}

function escapeFFmpegText(text) {
  return String(text || "")
    .replace(/\\/g, "\\\\")
    .replace(/:/g, "\\:")
    .replace(/'/g, "\\'")
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "");
}

export async function POST(req) {
  try {
    const { imageList, audioFileUrl, script } = await req.json();

    if (
      !Array.isArray(imageList) ||
      imageList.length === 0 ||
      !audioFileUrl ||
      !script
    ) {
      return NextResponse.json({ error: "Invalid input data" }, { status: 400 });
    }

    const tempDir = path.join("/tmp", uuidv4());
    await fs.mkdir(tempDir, { recursive: true });

    const imageFiles = [];
    for (let i = 0; i < imageList.length; i++) {
      const ext = path.extname(new URL(imageList[i]).pathname) || ".jpg";
      const filePath = path.join(tempDir, `image_${i}${ext}`);
      await downloadFile(imageList[i], filePath);
      imageFiles.push(filePath);
    }

    const audioExt = path.extname(new URL(audioFileUrl).pathname) || ".mp3";
    const audioFilePath = path.join(tempDir, `audio${audioExt}`);
    await downloadFile(audioFileUrl, audioFilePath);

    const fontPath = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf";
    const durationPerImage = 5;
    const videoSegments = [];

    for (let i = 0; i < imageFiles.length; i++) {
      const image = imageFiles[i];
      const text = escapeFFmpegText(script[i]?.ContentText || "");
      const outputVideo = path.join(tempDir, `video_${i}.mp4`);

      await new Promise((resolve, reject) => {
        ffmpeg()
          .input(image)
          .loop(durationPerImage)
          .videoFilter(
            `drawtext=fontfile='${fontPath}':text='${text}':fontcolor=white:fontsize=24:box=1:boxcolor=0x00000099:boxborderw=5:x=(w-text_w)/2:y=h-60`
          )
          .outputOptions(["-t", `${durationPerImage}`, "-r 30", "-pix_fmt yuv420p"])
          .save(outputVideo)
          .on("end", resolve)
          .on("error", reject);
      });

      videoSegments.push(outputVideo);
    }

    const filelistPath = path.join(tempDir, "filelist.txt");
    const concatText = videoSegments.map((v) => `file '${v}'`).join("\n");
    await fs.writeFile(filelistPath, concatText);

    const tempConcatPath = path.join(tempDir, `concat_${uuidv4()}.mp4`);
    const finalOutputPath = path.join(tempDir, `output_${uuidv4()}.mp4`);

    await new Promise((resolve, reject) => {
      ffmpeg()
        .input(filelistPath)
        .inputOptions(["-f concat", "-safe 0"])
        .videoCodec("libx264")
        .outputOptions(["-pix_fmt yuv420p", "-r 30"])
        .save(tempConcatPath)
        .on("end", resolve)
        .on("error", reject);
    });

    await new Promise((resolve, reject) => {
      ffmpeg()
        .input(tempConcatPath)
        .input(audioFilePath)
        .outputOptions(["-c:v copy", "-c:a aac", "-shortest"])
        .save(finalOutputPath)
        .on("end", resolve)
        .on("error", reject);
    });

    const fileBuffer = await fs.readFile(finalOutputPath);
    const base64 = fileBuffer.toString("base64");
    await fs.rm(tempDir, { recursive: true, force: true });

    return NextResponse.json({ result: `data:video/mp4;base64,${base64}` });
  } catch (error) {
    console.error("Export video error:", error);
    return NextResponse.json({ error: "Export failed", details: error.message }, { status: 500 });
  }
}
