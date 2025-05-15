const Post = require('../models/Post');
const User = require('../models/User');
const { uploadToCloudinary } = require('../utils/imageUpload');
const notificationController = require('./notificationController');

// Get the io object from the server
let io;
setTimeout(() => {
  io = require('../server').io;
}, 0);

exports.createPost = async (req, res) => {
  try {
    const { content, postType } = req.body;
    let imageUrl = null;
    
    console.log('Creating post - User ID:', req.user);
    console.log('Request body:', req.body);
    
    if (!req.user) {
      return res.status(401).json({ message: 'User not authenticated' });
    }
    
    if (req.file) {
      imageUrl = await uploadToCloudinary(req.file, 'posts');
    }
    
    const post = new Post({
      user: req.user,
      content,
      image: imageUrl,
      postType: postType || 'general'
    });
    
    await post.save();
    
    // Populate user data
    await post.populate('user', 'username profilePicture');
    
    // Add post to user
    await User.findByIdAndUpdate(req.user, { $push: { posts: post._id } });
    
    // Emit socket event if io is available
    if (io) {
      io.emit('newPost', post);
    }
    
    res.status(201).json(post);
  } catch (error) {
    console.error('Error creating post:', error);
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
      .populate('likes', 'username profilePicture') 
      .populate('comments.user', 'username profilePicture')
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
      .populate('likes', 'username profilePicture')
      .populate('comments.user', 'username profilePicture');
    
    res.json(posts);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.likePost = async (req, res) => {
  try {
    const { postId } = req.params;
    const userId = req.user._id || req.user;
    
    const post = await Post.findById(postId).populate('user');
    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }
    
    const userIdString = userId.toString();
    const likeIndex = post.likes.findIndex(like => like.toString() === userIdString);
    let isLiked = false;
    
    if (likeIndex > -1) {
      // Unlike
      post.likes.splice(likeIndex, 1);
    } else {
      // Like
      post.likes.push(userId);
      isLiked = true;
      
      // Create notification if it's not the user's own post
      if (post.user._id.toString() !== userIdString) {
        try {
          const liker = await User.findById(userId);
          if (liker) {
            await notificationController.createNotification(
              post.user._id,
              userId,
              'post_like',
              `${liker.username} liked your post`,
              `/post/${postId}`
            );
          }
        } catch (notificationError) {
          console.error('Error creating notification:', notificationError);
          // Continue even if notification fails
        }
      }
    }
    
    await post.save();
    
    // Populate the post for response
    await post.populate('user', 'username profilePicture');
    await post.populate('likes', 'username profilePicture');
    await post.populate('comments.user', 'username profilePicture');
    
    // Emit socket event if io is available
    if (io) {
      io.emit('postUpdated', post);
    }
    
    res.json(post);
  } catch (error) {
    console.error('Error liking post:', error);
    res.status(500).json({ message: error.message });
  }
};

exports.addComment = async (req, res) => {
  try {
    const { postId } = req.params;
    const { content } = req.body;
    
    const post = await Post.findById(postId).populate('user');
    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }
    
    const userId = req.user._id || req.user;
    const commenter = await User.findById(userId);
    
    if (!commenter) {
      return res.status(404).json({ message: 'Commenter not found' });
    }
    
    const comment = {
      user: userId,
      content,
      createdAt: new Date()
    };
    
    post.comments.push(comment);
    await post.save();
    
    // Get the saved comment with populated user data
    const savedPost = await Post.findById(postId)
      .populate('user', 'username profilePicture')
      .populate('comments.user', 'username profilePicture');
    
    const savedComment = savedPost.comments[savedPost.comments.length - 1];
    
    // Create notification if it's not the user's own post
    if (post.user._id.toString() !== userId.toString()) {
      try {
        await notificationController.createNotification(
          post.user._id,
          userId,
          'post_comment',
          `${commenter.username} commented on your post`,
          `/post/${postId}`
        );
      } catch (notificationError) {
        console.error('Error creating notification:', notificationError);
        // Continue even if notification fails
      }
    }
    
    // Emit socket event with the populated comment if io is available
    if (io) {
      io.emit('newComment', { 
        postId, 
        comment: savedComment 
      });
    }
    
    res.json(savedPost);
  } catch (error) {
    console.error('Error adding comment:', error);
    res.status(500).json({ message: error.message });
  }
};