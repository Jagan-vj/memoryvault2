const mongoose = require('mongoose');

const commentSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  text: {
    type: String,
    required: true,
    maxlength: 500,
  },
}, { timestamps: true });

const memorySchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  title: {
    type: String,
    default: '',
    maxlength: 150,
  },
  content: {
    type: String,
    default: '',
    maxlength: 5000,
  },
  media: [{
    url: { type: String, required: true },
    type: { type: String, enum: ['image', 'video'], default: 'image' },
    publicId: { type: String, default: '' },
  }],
  memoryDate: {
    type: Date,
    default: Date.now,
  },
  tags: [{
    type: String,
    trim: true,
    lowercase: true,
  }],
  isFavorite: {
    type: Boolean,
    default: false,
  },
  privacy: {
    type: String,
    enum: ['private', 'shared', 'public'],
    default: 'private',
  },
  sharedWith: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  }],
  likes: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  }],
  comments: [commentSchema],
  category: {
    type: String,
    enum: ['general', 'birthday', 'anniversary', 'holiday', 'travel', 'milestone', 'note'],
    default: 'general',
  },
  reminder: {
    enabled: { type: Boolean, default: false },
    date: { type: Date },
    message: { type: String, default: '' },
  },
}, {
  timestamps: true,
});

// Index for search and filtering
memorySchema.index({ user: 1, memoryDate: -1 });
memorySchema.index({ tags: 1 });
memorySchema.index({ content: 'text', title: 'text' });

module.exports = mongoose.model('Memory', memorySchema);
