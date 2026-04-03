const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { upload } = require('../config/cloudinary');
const {
  createMemory,
  getMemories,
  getMemory,
  updateMemory,
  deleteMemory,
  toggleLike,
  addComment,
  toggleFavorite,
  getFavorites,
} = require('../controllers/memoryController');

router.get('/', auth, getMemories);
router.get('/favorites', auth, getFavorites);
router.get('/:id', auth, getMemory);
router.post('/', auth, upload.array('media', 10), createMemory);
router.put('/:id', auth, upload.array('media', 10), updateMemory);
router.delete('/:id', auth, deleteMemory);
router.put('/:id/like', auth, toggleLike);
router.post('/:id/comment', auth, addComment);
router.put('/:id/favorite', auth, toggleFavorite);

module.exports = router;
