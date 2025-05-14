const Post = require('../models/Post');
const User = require('../models/User');
const { uploadToCloudinary } = require('../utils/imageUpload');

// Get the io object from the server
const io = require('../server').io;

exports.createPost = async (req, res) => {
  try {
    const { content } = req.body;
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
    
    // Populate user data
    await post.populate('user', 'username profilePicture');
    
    // Add post to user
    await User.findByIdAndUpdate(req.user, { $push: { posts: post._id } });
    
    // Emit socket event
    io.emit('newPost', post);
    
    res.status(201).json(post);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getFeed = async (req, res) => {
  try {
    const user = await User.findById(req.user);
    const followingIds = user.following.concat(req.user);
    
    const posts = await Post.find({ user: { $in: followingIds } })
      .sort({ createdAt: -1 })
      .populate('user', 'username profilePicture')
      .populate('likes', 'username profilePicture') // Populate likes with user info
      .populate('comments.user', 'username profilePicture') // Populate comment user info
      .limit(20);
    
    res.json(posts);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getUserPosts = async (req, res) => {
  try {
    const { userId } = req.params;
    
    const posts = await Post.find({ user: userId })
      .sort({ createdAt: -1 })
      .populate('user', 'username profilePicture')
      .populate('likes', 'username profilePicture') // Populate likes with user info
      .populate('comments.user', 'username profilePicture'); // Populate comment user info
    
    res.json(posts);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.likePost = async (req, res) => {
  try {
    const { postId } = req.params;
    
    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }
    
    const likeIndex = post.likes.indexOf(req.user);
    if (likeIndex > -1) {
      post.likes.splice(likeIndex, 1);
    } else {
      post.likes.push(req.user);
    }
    
    await post.save();
    
    // Populate the post for response
    await post.populate('user', 'username profilePicture');
    await post.populate('likes', 'username profilePicture');
    await post.populate('comments.user', 'username profilePicture');
    
    // Emit socket event
    io.emit('postUpdated', post);
    
    res.json(post);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.addComment = async (req, res) => {
  try {
    const { postId } = req.params;
    const { content } = req.body;
    
    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }
    
    const comment = {
      user: req.user,
      content,
      createdAt: new Date()
    };
    
    post.comments.push(comment);
    await post.save();
    
    // Populate the post for response
    await post.populate('user', 'username profilePicture');
    await post.populate('comments.user', 'username profilePicture');
    
    // Emit socket event
    io.emit('newComment', { postId, comment });
    
    res.json(post);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
