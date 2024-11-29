require("dotenv").config();
const config = require("./config.json");
const mongoose = require("mongoose");

mongoose.connect(config.connectionString);

const jwt = require("jsonwebtoken");
const { authenticateToken } = require("./utilities");

const User = require("./models/user.model");
const Note = require("./models/note.modal");

const express = require("express");
const cors = require("cors");
const app = express();

app.use(express.json());

app.use(
  cors({
    origin: "*",
  })
);

app.get("/", (req, res) => {
  res.json({ data: "hello" });
});

//Create Account
app.post("/create-account", async (req, res) => {
  const { fullName, email, password } = req.body;

  if (!fullName) {
    return res
      .status(400)
      .json({ error: true, message: "Full name is Required" });
  }

  if (!email) {
    return res.status(400).json({ error: true, message: "Email is required" });
  }

  if (!password) {
    res.status(400).json({ error: true, message: "Password is required" });
  }

  const isUser = await User.findOne({ email: email });

  if (isUser) {
    return res.json({
      error: true,
      message: "User already exist",
    });
  }

  const user = new User({
    fullName,
    email,
    password,
  });

  await user.save();

  const accessToken = jwt.sign({ user }, process.env.ACCESS_TOKEN_SECRET, {
    expiresIn: "3600m",
    algorithm: "HS256",
  });

  return res.json({
    error: false,
    user,
    accessToken,
    message: "Registration Successfully",
  });
});

//Login
app.post("/login", async (req, res) => {
  const { email, password } = req.body;

  if (!email) {
    return res.status(400).json({ message: "Email is required" });
  }

  if (!password) {
    res.status(400).json({ message: "Password is required" });
  }

  const userInfo = await User.findOne({ email: email });

  if (!userInfo) {
    return res.status(400).json({ message: " User Not Found" });
  }

  if (userInfo.email == email && userInfo.password == password) {
    const user = { user: userInfo };
    const accessToken = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
      expiresIn: "3600m",
      algorithm: "HS256",
    });

    return res.json({
      error: false,
      message: "Login Success",
      email,
      accessToken,
    });
  } else {
    return res.json({
      error: true,
      message: "Invalid Credentials",
    });
  }
});

//Get user
app.get("/get-user", authenticateToken, async (req, res) => {
  const {user}= req.user;

  const isUser = await User.findOne({_id:user._id})

  if (!isUser) {
    return res.sendStatus(401);
  }

  return res.json({
    user:{
      fullName:isUser.fullName,
      email:isUser.email,
      _id:isUser._id,
      createdOn:isUser.createdOn
    },
    message:""
  })
})

//Add Note
app.post("/add-note", authenticateToken, async (req, res) => {
  const { title, content, tags } = req.body;
  const { user } = req.user;

  if (!title) {
    return res.status(400).json({ error: true, message: "Title is Required" });
  }

  if (!content) {
    return res
      .status(400)
      .json({ error: true, message: "Content is required" });
  }

  try {
    const note = new Note({
      title,
      content,
      tags: tags || [],
      userId: user._id,
    });

    await note.save();
    return res.json({
      error: false,
      note,
      message: "Note Added Successfully",
    });
  } catch (error) {
    return res.status(500).json({
      error: true,
      message: "Internal Server Error",
    });
  }
});

//Edit Note
app.put("/edit-note/:nodeId", authenticateToken, async (req, res) => {
  const nodeId = req.params.nodeId;
  const { title, content, tags, isPinned } = req.body;
  const { user } = req.user;

  if (!title && !content && !tags) {
    return res.status(400).json({
      error: false,
      message: "No changes provided",
    });
  }

  try {
    const note = await Note.findOne({ _id: nodeId, userId: user._id });

    if (!note) {
      return res.json({ error: true, message: "Note not Found" }).status(404);
    }

    if (title) note.title = title;
    if (content) note.content = content;
    if (tags) note.tags = tags;
    if (isPinned) note.isPinned = isPinned;

    await note.save();

    return res.json({
      error: false,
      note,
      message: "Note Updated Successfully",
    });
  } catch (error) {
    return res.status(500).json({
      error: true,
      message: "Internal Server Error",
    });
  }
});

//Get All Note
app.get("/get-all-notes/", authenticateToken, async (req, res) => {
  const { user } = req.user;

  try {
    const notes = await Note.find({ userId: user._id }).sort({
      isPinned: -1,
    });

    return res.json({
      error: false,
      notes,
      message: "All notes Retrived",
    });
  } catch (error) {
    return res.status(500).json({
      error: true,
      message: "Internal Server Error",
    });
  }
});

//Delete Note
app.delete("/delete-note/:nodeId", authenticateToken, async (req, res) => {
    const nodeId = req.params.nodeId;
    const { user } = req.user;
  
    
    try {
      const note = await Note.findOne({ _id: nodeId, userId: user._id });
  
      if (!note) {
        return res.json({ error: true, message: "Note not Found" }).status(404);
      }
  
      await note.deleteOne({_id: nodeId, userId: user._id})
     
      return res.json({
        error: false,
        note,
        message: "Note Deleted Successfully",
      });
    } catch (error) {
      return res.status(500).json({
        error: true,
        message: "Internal Server Error",
      });
    }
  });

//Update isPinned
app.put("/update-note-pinned/:nodeId", authenticateToken, async (req, res) => {
  const nodeId = req.params.nodeId;
  const { isPinned } = req.body;
  const { user } = req.user;

  

  try {
    const note = await Note.findOne({ _id: nodeId, userId: user._id });

    if (!note) {
      return res.json({ error: true, message: "Note not Found" }).status(404);
    }

    
     note.isPinned = isPinned;

    await note.save();

    return res.json({
      error: false,
      note,
      message: "Note Updated Successfully",
    });
  } catch (error) {
    return res.status(500).json({
      error: true,
      message: "Internal Server Error",
    });
  }
})

//Search  API
app.get("/search-notes/", authenticateToken, async (req, res) => {
  const {user} = req.user;
  const { query } = req.query

  if (!query) {
    return res.status(401).json({error:true, message:'Serach query is required'})
  }

  try {
    const matchingNote = await Note.find({
      userId: user._id,
      $or:[
        { title: {$regex: new RegExp(query,"i")} },
        { content: {$regex: new RegExp(query,"i")}}
      ]
    })
    return res.json({
      error: false,  
      message:"Note Found",
      notes:matchingNote
    })
  } catch (error) {
    res.status(500).json({
      error:true,
      message:'Internal Server Error'
    })
  }
})
// const url = "https://backend-mmol.onrender.com"

app.listen(8000);

module.exports = app;
