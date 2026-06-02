const express = require('express');
const router = express.Router();
const { createAnimal, updateAnimal, deleteAnimal, listAnimals, getAnimalById } = require('../controllers/animalController');
const { authMiddleware } = require('../middleware/auth');

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
 *     responses:
 *       '201':
 *         description: Animale creato.
 *         headers:
 *           Location:
 *             schema:
 *               type: string
 *             description: URI della risorsa creata
 */
router.post('/', authMiddleware, createAnimal);
router.put('/:id', authMiddleware, updateAnimal);
router.delete('/:id', authMiddleware, deleteAnimal);


module.exports = router;
