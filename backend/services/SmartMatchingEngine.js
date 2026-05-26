const Announcement = require("../models/Announcement");
const Animal = require("../models/Animal");
const fs = require("fs");
const path = require("path");
const { execFile } = require("child_process");
const { promisify } = require("util");

const execFileAsync = promisify(execFile);

class SmartMatchingEngine {
  constructor() {
    this.similarityThreshold = 0.8;
  }

  async generateImageEmbedding(photoBuffer) {
    const tempDir = path.join(__dirname, "../temp");
    const tempFile = path.join(tempDir, `img_${Date.now()}.jpg`);

    try {
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }

      fs.writeFileSync(tempFile, photoBuffer);

      const pythonPath = process.env.PYTHON_PATH || "python";

      const { stdout, stderr } = await execFileAsync(
        pythonPath,
        [path.join(__dirname, "../scripts/generate_embedding.py"), tempFile],
        { env: process.env }
      );

      if (stderr) {
        console.warn("Python warning:", stderr);
      }

      const cleanOutput = stdout.trim();
      const result = JSON.parse(cleanOutput);

      if (result.error) {
        console.error("Errore Python:", result.error);
        return null;
      }

      if (!result.embedding || !Array.isArray(result.embedding)) {
        console.error("Embedding non valido restituito dallo script Python");
        return null;
      }

      return result.embedding;
    } catch (err) {
      console.error("Errore embedding:", err.message);
      return null;
    } finally {
      if (fs.existsSync(tempFile)) {
        fs.unlinkSync(tempFile);
      }
    }
  }

  calculateCosineSimilarity(vecA, vecB) {
    if (!vecA || !vecB || vecA.length !== vecB.length) return 0;

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < vecA.length; i++) {
      dotProduct += vecA[i] * vecB[i];
      normA += vecA[i] * vecA[i];
      normB += vecB[i] * vecB[i];
    }

    if (normA === 0 || normB === 0) return 0;

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  async findMatches(newAnnouncement, animalSpecies) {
    if (!newAnnouncement.imageEmbedding) return [];

    const oppositeType =
      newAnnouncement.type === "LostAnimal" ? "Sighting" : "LostAnimal";

    const sameSpeciesAnimals = await Animal.find({
      species: { $regex: new RegExp(`^${animalSpecies}$`, "i") },
    }).select("_id");

    const validAnimalIds = sameSpeciesAnimals.map((a) => a._id);

    const candidates = await Announcement.find({
      type: oppositeType,
      status: "ACTIVE",
      animalId: { $in: validAnimalIds },
      imageEmbedding: { $ne: null },
    })
      .select("-photo -comments")
      .populate("publisherId")
      .populate("animalId");

    return candidates
      .map((c) => ({
        announcement: c,
        score: this.calculateCosineSimilarity(
          newAnnouncement.imageEmbedding,
          c.imageEmbedding
        ),
      }))
      .filter((m) => m.score >= this.similarityThreshold)
      .sort((a, b) => b.score - a.score);
  }
}

module.exports = new SmartMatchingEngine();