const express = require('express');
const router = express.Router();
const { createAnimal, updateAnimal, deleteAnimal, listAnimals, getAnimalById } = require('../controllers/animalController');
const { authMiddleware } = require('../middleware/auth');

router.get('/', listAnimals);
router.get('/:id', getAnimalById);
router.post('/', authMiddleware, createAnimal);
router.put('/:id', authMiddleware, updateAnimal);
router.delete('/:id', authMiddleware, deleteAnimal);


module.exports = router;
