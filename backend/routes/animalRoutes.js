const express = require('express');
const router = express.Router();
const { createAnimal, updateAnimal } = require('../controllers/animalController');
const { authMiddleware } = require('../middleware/auth');

router.post('/', createAnimal);
router.put('/:id', authMiddleware, updateAnimal);

module.exports = router;
