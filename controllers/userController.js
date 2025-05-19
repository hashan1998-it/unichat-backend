const User = require("../models/User");
const mongoose = require("mongoose");
const { uploadToCloudinary } = require("../utils/imageUpload");
const redis = require("redis");

const client = redis.createClient({ url: process.env.REDIS_URL });
client.on("error", (err) => console.log("Redis Client Error", err));
(async () => {
  await client.connect();
})();

exports.getProfile = async (req, res) => {
  try {
    const cacheKey = `profile:${req.params.id}`;
    const cached = await client.get(cacheKey);
    if (cached) {
      return res.json(JSON.parse(cached));
    }
    const user = await User.findById(req.params.id)
      .select("-password")
      .populate("followers", "username profilePicture")
      .populate("following", "username profilePicture");

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    await client.setEx(cacheKey, 3600, JSON.stringify(user)); 

    res.json(user);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.updateProfile = async (req, res) => {
  try {
    const { firstName, lastName, bio } = req.body;

    const user = await User.findByIdAndUpdate(
      req.user,
      { firstName, lastName, bio },
      { new: true }
    ).select("-password");

    res.json(user);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.followUser = async (req, res) => {
  try {
    const { userId } = req.params;

    if (userId === req.user) {
      return res.status(400).json({ message: "Cannot follow yourself" });
    }

    // Update current user's following list
    const currentUser = await User.findById(req.user);
    if (!currentUser.following.includes(userId)) {
      currentUser.following.push(userId);
      await currentUser.save();
    }

    // Update target user's followers list
    const targetUser = await User.findById(userId);
    if (!targetUser.followers.includes(req.user)) {
      targetUser.followers.push(req.user);
      await targetUser.save();
    }

    // Return the updated target user with populated followers
    const updatedTargetUser = await User.findById(userId)
      .populate("followers", "username profilePicture")
      .populate("following", "username profilePicture");

    res.json(updatedTargetUser);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.unfollowUser = async (req, res) => {
  try {
    const { userId } = req.params;

    // Update current user's following list
    const currentUser = await User.findById(req.user);
    currentUser.following = currentUser.following.filter(
      (id) => id.toString() !== userId
    );
    await currentUser.save();

    // Update target user's followers list
    const targetUser = await User.findById(userId);
    targetUser.followers = targetUser.followers.filter(
      (id) => id.toString() !== req.user
    );
    await targetUser.save();

    // Return the updated target user with populated followers
    const updatedTargetUser = await User.findById(userId)
      .populate("followers", "username profilePicture")
      .populate("following", "username profilePicture");

    res.json(updatedTargetUser);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.uploadProfilePicture = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    const imageUrl = await uploadToCloudinary(req.file, "profile-pictures");

    const user = await User.findByIdAndUpdate(
      req.user,
      { profilePicture: imageUrl },
      { new: true }
    ).select("-password");

    res.json(user);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
