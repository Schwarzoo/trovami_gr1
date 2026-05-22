const express = require('express');
const router = express.Router();
const { createAnimal, updateAnimal, deleteAnimal } = require('../controllers/animalController');
const { authMiddleware } = require('../middleware/auth');

router.post('/', createAnimal);
router.put('/:id', authMiddleware, updateAnimal);
router.delete("/:id", authMiddleware, deleteAnimal);


module.exports = router;
