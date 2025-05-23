const mongoose = require('mongoose');

const postSchema = new mongoose.Schema({
    user : {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    postType : {
        type: String,
        enum: ['general', 'academic', 'event'],
        default: 'general'
    },
    content : {
        type: String,
        required: true
    },
    image : {
        type: String,
    },
    likes : [
        {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        }
    ],
    comments : [
        {
            user: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'User',
                required: true
            },
            content: {
                type: String,
                required: true
            },
            createdAt: {
                type: Date,
                default: Date.now
            }
        }
    ],
    createdAt : {
        type: Date,
        default: Date.now
    }

})

module.exports = mongoose.model('Post', postSchema);