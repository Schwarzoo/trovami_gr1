const express = require('express');
const router = express.Router();
const { createAnimal, updateAnimal, deleteAnimal, listAnimals, getAnimalById, getAnimalPhoto } = require('../controllers/animalController');
const { authMiddleware } = require('../middleware/auth');
const multer = require('multer');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

router.get('/', listAnimals);
router.get('/:id', getAnimalById);
router.post('/', upload.single('photo'), authMiddleware, createAnimal);
router.get('/:id/photo', getAnimalPhoto);
router.put('/:id', upload.single('photo'), authMiddleware, updateAnimal);
router.delete('/:id', authMiddleware, deleteAnimal);


module.exports = router;
