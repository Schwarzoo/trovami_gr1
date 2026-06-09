const express = require('express');
const router = express.Router();
const { createAnimal, updateAnimal, deleteAnimal, listAnimals, getAnimalById, getAnimalPhoto } = require('../controllers/animalController');
const { authMiddleware } = require('../middleware/auth');
const multer = require('multer');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

/**
 * @openapi
 * /api/v1/animals:
 *   get:
 *     summary: Lista animali
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *         description: Numero massimo di animali per pagina.
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *         description: Pagina dei risultati da restituire.
 *     responses:
 *       '200':
 *         description: Lista paginata degli animali.
 */
router.get('/', listAnimals);
router.get('/:id', getAnimalById);
/**
 * @openapi
 * /api/v1/animals:
 *   post:
 *     summary: Crea un animale
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               photo:
 *                 type: string
 *                 format: binary
 *     responses:
 *       '201':
 *         description: Animale creato.
 *         headers:
 *           Location:
 *             schema:
 *               type: string
 *             description: URI della risorsa creata
 */
router.post('/', upload.single('photo'), authMiddleware, createAnimal);
/**
 * @openapi
 * /api/v1/animals/{id}/photo:
 *   get:
 *     summary: Recupera la foto salvata nel documento animale
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       '200':
 *         description: Contenuto binario della foto animale.
 *         content:
 *           image/jpeg:
 *             schema:
 *               type: string
 *               format: binary
 *       '404':
 *         description: Foto animale non trovata.
 */
router.get('/:id/photo', getAnimalPhoto);
/**
 * @openapi
 * /api/v1/animals/{id}:
 *   put:
 *     summary: Aggiorna un animale
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               photo:
 *                 type: string
 *                 format: binary
 *     responses:
 *       '200':
 *         description: Animale aggiornato.
 */
router.put('/:id', upload.single('photo'), authMiddleware, updateAnimal);
router.delete('/:id', authMiddleware, deleteAnimal);


module.exports = router;
