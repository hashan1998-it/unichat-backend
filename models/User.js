const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    username : {
        type: String,
        unique: true,
        required: true,
    },
    email : {
        type: String,
        required: true,
        unique: true
    },
    password : {
        type: String,
        required: true
    },
    firstName : {
        type: String,
    },
    lastName : {
        type: String,
    },
    profilePicture : {
        type: String,
    },
    bio : {
        type: String,
    },
    followers : [
        {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        }
    ],
    following : [
        {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        }
    ],
    posts : [
        {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Post'
        }
    ],
    createdAt : {
        type: Date,
        default: Date.now
    }
})

module.exports = mongoose.model('User', userSchema);