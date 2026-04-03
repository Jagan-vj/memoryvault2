const Memory = require('../models/Memory');
const Notification = require('../models/Notification');
const { useCloudinary } = require('../config/cloudinary');

// POST /api/memories
exports.createMemory = async (req, res) => {
  try {
    const { title, content, memoryDate, tags, privacy, sharedWith, category, reminder } = req.body;

    const media = [];
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        const isVideo = file.mimetype && file.mimetype.startsWith('video');
        media.push({
          url: useCloudinary ? file.path : `/uploads/${file.filename}`,
          type: isVideo ? 'video' : 'image',
          publicId: useCloudinary ? file.filename : '',
        });
      }
    }

    const memory = await Memory.create({
      user: req.user._id,
      title: title || '',
      content: content || '',
      media,
      memoryDate: memoryDate || Date.now(),
      tags: tags ? JSON.parse(tags) : [],
      privacy: privacy || 'private',
      sharedWith: sharedWith ? JSON.parse(sharedWith) : [],
      category: category || 'general',
      reminder: reminder ? JSON.parse(reminder) : { enabled: false },
    });

    await memory.populate('user', 'name email avatar');

    res.status(201).json({ memory });
  } catch (error) {
    res.status(500).json({ message: 'Failed to create memory', error: error.message });
  }
};

// GET /api/memories
exports.getMemories = async (req, res) => {
  try {
    const { page = 1, limit = 20, search, category, startDate, endDate, sort = '-memoryDate' } = req.query;

    const query = {
      $or: [
        { user: req.user._id },
        { sharedWith: req.user._id, privacy: 'shared' },
        { privacy: 'public' },
      ],
    };

    if (search) {
      query.$text = { $search: search };
    }

    if (category && category !== 'all') {
      query.category = category;
    }

    if (startDate || endDate) {
      query.memoryDate = {};
      if (startDate) query.memoryDate.$gte = new Date(startDate);
      if (endDate) query.memoryDate.$lte = new Date(endDate);
    }

    const memories = await Memory.find(query)
      .populate('user', 'name email avatar')
      .populate('comments.user', 'name avatar')
      .populate('likes', 'name')
      .sort(sort)
      .limit(Number(limit))
      .skip((Number(page) - 1) * Number(limit));

    const total = await Memory.countDocuments(query);

    res.json({
      memories,
      totalPages: Math.ceil(total / Number(limit)),
      currentPage: Number(page),
      total,
    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch memories', error: error.message });
  }
};

// GET /api/memories/favorites
exports.getFavorites = async (req, res) => {
  try {
    const memories = await Memory.find({ user: req.user._id, isFavorite: true })
      .populate('user', 'name email avatar')
      .sort('-memoryDate');

    res.json({ memories });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch favorites', error: error.message });
  }
};

// GET /api/memories/:id
exports.getMemory = async (req, res) => {
  try {
    const memory = await Memory.findById(req.params.id)
      .populate('user', 'name email avatar')
      .populate('comments.user', 'name avatar')
      .populate('sharedWith', 'name email');

    if (!memory) {
      return res.status(404).json({ message: 'Memory not found' });
    }

    // Check access
    const isOwner = memory.user._id.toString() === req.user._id.toString();
    const isSharedWith = memory.sharedWith.some(u => u._id.toString() === req.user._id.toString());
    if (!isOwner && !isSharedWith && memory.privacy !== 'public') {
      return res.status(403).json({ message: 'Access denied' });
    }

    res.json({ memory });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch memory', error: error.message });
  }
};

// PUT /api/memories/:id
exports.updateMemory = async (req, res) => {
  try {
    const memory = await Memory.findById(req.params.id);
    if (!memory) {
      return res.status(404).json({ message: 'Memory not found' });
    }
    if (memory.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    const { title, content, memoryDate, tags, privacy, sharedWith, category, isFavorite, reminder } = req.body;

    if (title !== undefined) memory.title = title;
    if (content !== undefined) memory.content = content;
    if (memoryDate) memory.memoryDate = memoryDate;
    if (tags) memory.tags = typeof tags === 'string' ? JSON.parse(tags) : tags;
    if (privacy) memory.privacy = privacy;
    if (sharedWith) memory.sharedWith = typeof sharedWith === 'string' ? JSON.parse(sharedWith) : sharedWith;
    if (category) memory.category = category;
    if (isFavorite !== undefined) memory.isFavorite = isFavorite;
    if (reminder) memory.reminder = typeof reminder === 'string' ? JSON.parse(reminder) : reminder;

    // Handle new file uploads
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        const isVideo = file.mimetype && file.mimetype.startsWith('video');
        memory.media.push({
          url: useCloudinary ? file.path : `/uploads/${file.filename}`,
          type: isVideo ? 'video' : 'image',
          publicId: useCloudinary ? file.filename : '',
        });
      }
    }

    await memory.save();
    await memory.populate('user', 'name email avatar');

    res.json({ memory });
  } catch (error) {
    res.status(500).json({ message: 'Failed to update memory', error: error.message });
  }
};

// DELETE /api/memories/:id
exports.deleteMemory = async (req, res) => {
  try {
    const memory = await Memory.findById(req.params.id);
    if (!memory) {
      return res.status(404).json({ message: 'Memory not found' });
    }
    if (memory.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    await Memory.findByIdAndDelete(req.params.id);
    res.json({ message: 'Memory deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to delete memory', error: error.message });
  }
};

// PUT /api/memories/:id/like
exports.toggleLike = async (req, res) => {
  try {
    const memory = await Memory.findById(req.params.id);
    if (!memory) {
      return res.status(404).json({ message: 'Memory not found' });
    }

    const likeIndex = memory.likes.indexOf(req.user._id);
    if (likeIndex > -1) {
      memory.likes.splice(likeIndex, 1);
    } else {
      memory.likes.push(req.user._id);

      // Create notification if it's not the owner liking their own memory
      if (memory.user.toString() !== req.user._id.toString()) {
        await Notification.create({
          recipient: memory.user,
          sender: req.user._id,
          type: 'like',
          memory: memory._id,
          message: `${req.user.name} liked your memory`,
        });
      }
    }

    await memory.save();
    res.json({ likes: memory.likes, liked: likeIndex === -1 });
  } catch (error) {
    res.status(500).json({ message: 'Failed to toggle like', error: error.message });
  }
};

// POST /api/memories/:id/comment
exports.addComment = async (req, res) => {
  try {
    const { text } = req.body;
    if (!text) {
      return res.status(400).json({ message: 'Comment text is required' });
    }

    const memory = await Memory.findById(req.params.id);
    if (!memory) {
      return res.status(404).json({ message: 'Memory not found' });
    }

    memory.comments.push({ user: req.user._id, text });
    await memory.save();
    await memory.populate('comments.user', 'name avatar');

    // Create notification
    if (memory.user.toString() !== req.user._id.toString()) {
      await Notification.create({
        recipient: memory.user,
        sender: req.user._id,
        type: 'comment',
        memory: memory._id,
        message: `${req.user.name} commented on your memory`,
      });
    }

    res.json({ comments: memory.comments });
  } catch (error) {
    res.status(500).json({ message: 'Failed to add comment', error: error.message });
  }
};

// PUT /api/memories/:id/favorite
exports.toggleFavorite = async (req, res) => {
  try {
    const memory = await Memory.findById(req.params.id);
    if (!memory) {
      return res.status(404).json({ message: 'Memory not found' });
    }
    if (memory.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    memory.isFavorite = !memory.isFavorite;
    await memory.save();

    res.json({ isFavorite: memory.isFavorite });
  } catch (error) {
    res.status(500).json({ message: 'Failed to toggle favorite', error: error.message });
  }
};
