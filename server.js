import express from "express";
import cors from "cors";
import fs from "fs";
import os from "os";
import path from "path";
import 'dotenv/config';

//// Express App
const app = express();

//// Middlewares
app.use(cors({
  origin: process.env.FRONTEND_URL,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH"], 
})); 
app.use(express.json());

//// Constants
const PORT = process.env.PORT || 5000;
const EVERY_AYAH_BASE_URL = "https://everyayah.com/data";
const verseCounts = [
  7, 286, 200, 176, 120, 165, 206, 75, 129, 109,
  123, 111, 43, 52, 99, 128, 111, 110, 98, 135,
  112, 78, 118, 64, 77, 227, 93, 88, 69, 60,
  34, 30, 73, 54, 45, 83, 182, 88, 75, 85,
  54, 53, 89, 59, 37, 35, 38, 29, 18, 45, 60, 
  49, 62, 55, 78, 96, 29, 22, 24, 13, 14, 11, 11, 
  18, 12, 12, 30, 52, 52, 44, 28, 28, 20, 56, 40, 
  31, 50, 40, 46, 42, 29, 19, 36, 25, 22, 17, 19, 26,
  30, 20, 15, 21, 11, 8, 8, 19, 5, 8, 8, 11, 11, 
  8, 3, 9, 5, 4, 7, 3, 6, 3, 5, 4, 5, 6
]; // Number of verses in each surah in order


//// Helper functions

/* 
  Convert:
  surah = 1, ayah = 4
  into:
  001004.mp3
*/
function getFileName(surah, ayah) {
  return (
    String(surah).padStart(3, "0") +
    String(ayah).padStart(3, "0") +
    ".mp3"
  );
}

function getVerses(range) {
  const verses = [];

  let surah = range.startSurah;
  let ayah = range.startAyah;

  // Add Bismillah before the first ayah of next surah (ماعدا سورة التوبة و الفاتحة)
  if(!((surah === 1 && ayah === 1) || (surah === 9 && ayah === 1))){
    verses.push({
      surah: 1,
      ayah: 1,
    });
  }

  while (true) {
    verses.push({
      surah,
      ayah,
    });

    // We reached the requested ending verse
    if (surah === range.endSurah && ayah === range.endAyah) {
      break;
    }

    // Move to next ayah
    ayah++;

    // If we reached the end of this surah,
    // move to the first ayah of the next surah
    if (ayah > verseCounts[surah - 1]) {
      surah++;
      ayah = 1;
      
      // Add Bismillah before the first ayah of next surah (ماعدا سورة التوبة)
      if(surah !== 9){
        verses.push({
          surah: 1,
          ayah: 1,
        });
      }

    }

    // Safety check
    if (surah > 114) {
      throw new Error("Invalid Quran verse range");
    }
  }

  return verses;
}


//// Generate MP3 endpoint
app.post("/generate", async (req, res) => {
  try {
    const { ranges, reciter } = req.body;

    if (!ranges || ranges.length === 0) {
      return res.status(400).json({
        message: "No ranges provided",
      });
    }

    // const filePath = path.join(process.cwd(), `quran-${Date.now()}.mp3`);
    const filePath = path.join(os.tmpdir(), `quran-${Date.now()}.mp3`);

    // Create empty file
    fs.writeFileSync(filePath, "");

    // Process ranges IN ORDER
    for (const range of ranges) {
      const verses = getVerses(range);

      // Repeat this range
      for (let repeat = 0; repeat < range.repeat; repeat++) {
        // Process verses IN ORDER
        for (const verse of verses) {
          const fileName = getFileName(
            verse.surah,
            verse.ayah
          );

          const url = `${EVERY_AYAH_BASE_URL}/${reciter}/${fileName}`;

          console.log("Downloading:", url);

          const response = await fetch(url);

          if (!response.ok) {
            throw new Error(
              `Could not download ${fileName}`
            );
          }

          const buffer = Buffer.from(
            await response.arrayBuffer()
          );

          // Append this verse to our final MP3
          fs.appendFileSync(filePath, buffer);
        }
      }
    }

    console.log("Finished!");

    // Send MP3 to user
    res.download(
      filePath,
      "quran-custom.mp3",
      (error) => {
        // Delete temporary file after download
        fs.unlink(filePath, () => {});

        if (error) {
          console.error(error);
        }
      }
    );

  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: "Something went wrong",
      error: error.message,
    });
  }
});


//// Server entry point
app.listen(PORT, () => {
  console.log(`Server running on port: ${PORT}`);
});