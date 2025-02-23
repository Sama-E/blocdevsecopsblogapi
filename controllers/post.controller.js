import ImageKit from "imagekit";
import dotenv from 'dotenv';

import Post from "../models/post.model.js";
import User from "../models/user.model.js";

dotenv.config();

//GetPosts
export const getPosts = async (req, res) => {
  //Limits - page and count
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 2;

  //Search Query 
  const query = {};


  //Search type
  const cat = req.query.cat;
  const author = req.query.author;
  const searchQuery = req.query.search;
  const sortQuery = req.query.sort;
  const featured = req.query.featured;

  //Query category
  if (cat) {
    query.category = cat;
  }

  //Query search regardless of uppercase or lowercase
  if (searchQuery) {
    query.title = { $regex: searchQuery, $options: "i" };
  }

  //Query author
  if (author) {
    const user = await User.findOne({ username: author }).select("_id");

    if (!user) {
      return res.status(404).json("No post found!");
    }

    query.user = user._id;
  }

  let sortObj = { createdAt: -1 };

  //Sort Newest, Oldest, Popular, Trending
  if (sortQuery) {
    switch (sortQuery) {
      case "newest":
        sortObj = { createdAt: -1 };
        break;
      case "oldest":
        sortObj = { createdAt: 1 };
        break;
      case "popular":
        sortObj = { visit: -1 };
        break;
      case "trending":
        sortObj = { visit: -1 };
        query.createdAt = {
          $gte: new Date(new Date().getTime() - 7 * 24 * 60 * 60 * 1000),
        };
        break;
      default:
        break;
    }
  }

  //Query featured
  if (featured) {
    query.isFeatured = true;
  }

  //Find Posts
  const posts = await Post.find(query)
    .populate("user", "username")
    .sort(sortObj)
    .limit(limit)
    .skip((page - 1) * limit);

  //Count posts
  const totalPosts = await Post.countDocuments();
  const hasMore = page * limit < totalPosts;

  res.status(200).json({ posts, hasMore });
};

//Get Post
export const getPost = async (req, res) => {
  //With user and profile pic
  const post = await Post.findOne({ slug: req.params.slug }).populate(
    "user",
    "img username"
  );
  // const post = await Post.findOne({ slug: req.params.slug });
  res.status(200).json(post);
};

//Create Post
export const createPost = async (req, res) => {
  const clerkUserId = req.auth.userId;
  
  if (!clerkUserId) {
    return res.status(401).json("Not authenticated!");
  }
  //Grab Author
  const user = await User.findOne({ clerkUserId });
  
  if (!user) {
    return res.status(404).json("User not found!");
  }
  
  //Make slug (check if slug exists)
  let slug = req.body.title.replace(/ /g, "-").toLowerCase();
  
  let existingPost = await Post.findOne({ slug });
  
  let counter = 2;
  
  while (existingPost) {
    slug = `${slug}-${counter}`;
    existingPost = await Post.findOne({ slug });
    counter++;
  }
  //Create Post
  const newPost = new Post({ user: user._id, slug, ...req.body });
  
  //Save Post
  const post = await newPost.save();
  res.status(200).json(post);
};

//Delete Post
export const deletePost = async (req, res) => {
  const clerkUserId = req.auth.userId;

  if (!clerkUserId) {
    return res.status(401).json("Not authenticated!");
  }

  //Get role
  const role = req.auth.sessionClaims?.metadata?.role || "user";

  //If role is admin enable delete
  if (role === "admin") {
    await Post.findByIdAndDelete(req.params.id);
    return res.status(200).json("Post has been deleted");
  }

  const user = await User.findOne({ clerkUserId });

  const deletedPost = await Post.findOneAndDelete({
    _id: req.params.id,
    user: user._id,
  });

  if (!deletedPost) {
    return res.status(403).json("You can delete only your posts!");
}

res.status(200).json("Post has been deleted");
};

//Featured Posts
export const featurePost = async (req, res) => {
  const clerkUserId = req.auth.userId;
  const postId = req.body.postId;

  if (!clerkUserId) {
    return res.status(401).json("Not authenticated!");
  }

  //Get role
  const role = req.auth.sessionClaims?.metadata?.role || "user";

  //If not admin disable featured
  if (role !== "admin") {
    return res.status(403).json("You cannot feature posts!");
  }

  const post = await Post.findById(postId);

  if (!post) {
    return res.status(404).json("Post not found!");
  }

  const isFeatured = post.isFeatured;

  const updatedPost = await Post.findByIdAndUpdate(
    postId,
    {
      isFeatured: !isFeatured,
    },
    { new: true }
  );

  res.status(200).json(updatedPost);
};

//Process Imagekit - Authenticate with keys
const imagekit = new ImageKit({
  urlEndpoint: process.env.IK_URL_ENDPOINT,
  publicKey: process.env.IK_PUBLIC_KEY,
  privateKey: process.env.IK_PRIVATE_KEY,
});

//Upload files (video and picture)
export const uploadAuth = async (req, res) => {
  const result = imagekit.getAuthenticationParameters();
  res.send(result);
};