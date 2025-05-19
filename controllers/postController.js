const Post = require('../models/Post');
const User = require('../models/User');
const { uploadToCloudinary } = require('../utils/imageUpload');
const { populateUserFields } = require('../utils/db');
const io = require('../server').io;
const logger = require('../utils/logger');

exports.createPost = async (req, res) => {
  try {
    const { content } = req.body;
    if (!content) {
      throw Object.assign(new Error('Content is required'), { status: 400 });
    }

    let imageUrl = null;
    if (req.file) {
      imageUrl = await uploadToCloudinary(req.file, 'posts');
    }
    
    const post = new Post({
      user: req.user,
      content,
      image: imageUrl
    });
    
    await post.save();
    
    await populateUserFields(post);
    
    await User.findByIdAndUpdate(req.user, { $push: { posts: post._id } });
    
    io.emit('newPost', post);
    
    res.status(201).json(post);
  } catch (error) {
    logger.error('Create post error', { error: error.message });
    throw error;
  }
};

exports.getFeed = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const user = await User.findById(req.user);
    if (!user) {
      throw Object.assign(new Error('User not found'), { status: 404 });
    }
    const followingIds = user.following.concat(req.user);
    
    const posts = await populateUserFields(
      Post.find({ user: { $in: followingIds } })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
    );
    
    res.json(posts);
  } catch (error) {
    logger.error('Get feed error', { error: error.message });
    throw error;
  }
};

exports.getUserPosts = async (req, res) => {
  try {
    const { userId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const posts = await populateUserFields(
      Post.find({ user: userId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
    );

    res.json(posts);
  } catch (error) {
    logger.error('Get user posts error', { error: error.message });
    throw error;
  }
};

exports.likePost = async (req, res) => {
  try {
    const { postId } = req.params;
    const userId = req.user;

    const post = await Post.findById(postId);
    if (!post) {
      throw Object.assign(new Error('Post not found'), { status: 404 });
    }

    const hasLiked = post.likes.includes(userId);
    if (hasLiked) {
      post.likes = post.likes.filter(id => id.toString() !== userId.toString());
    } else {
      post.likes.push(userId);
    }

    await post.save();
    await populateUserFields(post);

    io.emit('postUpdated', post);

    res.json(post);
  } catch (error) {
    logger.error('Like post error', { error: error.message });
    throw error;
  }
};

exports.addComment = async (req, res) => {
  try {
    const { postId } = req.params;
    const { content } = req.body;
    const userId = req.user;

    if (!content) {
      throw Object.assign(new Error('Comment content is required'), { status: 400 });
    }

    const post = await Post.findById(postId);
    if (!post) {
      throw Object.assign(new Error('Post not found'), { status: 404 });
    }

    post.comments.push({ user: userId, content });
    await post.save();
    await populateUserFields(post);

    io.emit('postUpdated', post);

    res.json(post);
  } catch (error) {
    logger.error('Add comment error', { error: error.message });
    throw error;
  }
};
