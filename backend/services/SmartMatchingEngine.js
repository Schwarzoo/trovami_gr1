const Announcement = require("../models/Announcement");
const Animal = require("../models/Animal");
const fs = require("fs");
const path = require("path");
const { execFile } = require("child_process");
const { promisify } = require("util");

const execFileAsync = promisify(execFile);

function isRenderSimulationEnabled() {
  return String(process.env.RENDER).toLowerCase() === 'true';
}

/**
 * Coordinates image embedding generation and announcement similarity matching.
 * @returns {void} The class constructor initializes smart-matching instances.
 */
class SmartMatchingEngine {
  /**
   * Initializes smart-matching configuration.
   * @returns {void} No return value.
   */
  constructor() {
    this.similarityThreshold = 0.8;
  }

  /**
   * Generates an image embedding by delegating to the Python embedding script.
   * @param {Buffer} photoBuffer - Image bytes to process.
   * @returns {Promise<Array<number>|null>} Promise resolving to the embedding vector, or null when generation fails.
   */
  async generateImageEmbedding(photoBuffer) {
    if (isRenderSimulationEnabled()) {
        console.log("[SMART MATCHING] Ambiente Cloud Render rilevato.");
        console.log("[SMART MATCHING] Generazione di un finto vettore IA a 512 dimensioni per bypassare i limiti di RAM.");
        
        // Il modello clip-ViT-B-32 genera vettori lunghi esattamente 512 elementi.
        // Generiamo un array di 512 numeri casuali per simulare il modello senza bloccare il server di Render.
        const mockEmbedding = Array.from({ length: 512 }, () => Math.random());
        return mockEmbedding;
    }
    const tempDir = path.join(__dirname, "../temp");
    const tempFile = path.join(tempDir, `img_${Date.now()}.jpg`);

    try {
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }

      fs.writeFileSync(tempFile, photoBuffer);

      // Rilevamento dinamico di python per Windows vs Linux
      const pythonPath = process.env.PYTHON_PATH || (process.platform === 'win32' ? 'python' : 'python3');

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

  /**
   * Calculates cosine similarity between two numeric vectors.
   * @param {Array<number>} vecA - First embedding vector.
   * @param {Array<number>} vecB - Second embedding vector.
   * @returns {number} Cosine similarity score between 0 and 1.
   */
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

  /**
   * Finds active opposite-type announcements of the same species that match an image embedding.
   * @param {Object} newAnnouncement - Announcement containing the embedding to compare.
   * @param {string} animalSpecies - Animal species used to limit candidate announcements.
   * @returns {Promise<Array<Object>>} Promise resolving to ranked matching announcements with scores.
   */
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
