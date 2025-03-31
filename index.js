const express = require("express");
const cors = require("cors");
const multer = require("multer");
const path = require("path");
const { MongoClient, ObjectId, ServerApiVersion } = require("mongodb");
require("dotenv").config();

const app = express();
const port = process.env.PORT || 5000;

// Middleware
app.use(express.json());
app.use(cors());

// MongoDB connection
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@job-portal.fbdrv.mongodb.net/?retryWrites=true&w=majority&appName=job-portal`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    await client.connect();
    console.log("Connected to MongoDB!");

    const db = client.db("mernJobPortal");
    const jobsCollections = db.collection("demoJobs");
    const subscribersCollection = db.collection("subscribers");
    const applicationsCollection = db.collection("applications");
    const resumesCollection = db.collection("resumes");
    const savedJobsCollection = db.collection("savedJobs");

    // Multer Storage Configuration
    const storage = multer.diskStorage({
      destination: (req, file, cb) => cb(null, "uploads/"),
      filename: (req, file, cb) =>
        cb(null, file.fieldname + "-" + Date.now() + path.extname(file.originalname)),
    });
    const upload = multer({ storage });

    // Routes

    app.get("/", (req, res) => res.send("Job Portal API Running 🚀"));

    // Post a job
    app.post("/api/post-job", async (req, res) => {
      const body = { ...req.body, createdAt: new Date() };
      const result = await jobsCollections.insertOne(body);
      result.insertedId
        ? res.status(200).send(result)
        : res.status(500).send({ message: "Cannot insert! Try again later." });
    });

    // Get all jobs
    app.get("/api/all-jobs", async (req, res) => {
      const jobs = await jobsCollections.find().toArray();
      res.json(jobs);
    });

    // Get a single job by ID
    app.get("/api/all-jobs/:id", async (req, res) => {
      try {
        const id = req.params.id;
        if (!ObjectId.isValid(id)) return res.status(400).json({ message: "Invalid Job ID format" });

        const job = await jobsCollections.findOne({ _id: new ObjectId(id) });
        job ? res.json(job) : res.status(404).json({ message: "Job not found" });
      } catch (error) {
        console.error("Error fetching job:", error);
        res.status(500).json({ message: "Internal Server Error" });
      }
    });

    // Get jobs by user ID
    app.get("/api/myJobs/:email", async (req, res) => {
      try {
        const jobs = await jobsCollections.find({ postedBy: req.params.email }).toArray();
        jobs.length
          ? res.json({ status: true, jobs })
          : res.status(404).json({ message: "No jobs found for this user" });
      } catch (error) {
        res.status(500).json({ message: "Internal Server Error" });
      }
    });

    // Delete a job
    app.delete("/api/job/:id", async (req, res) => {
      const result = await jobsCollections.deleteOne({ _id: new ObjectId(req.params.id) });
      res.send(result);
    });

    // Update a job
    app.patch("/api/update-job/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const { skills, ...otherJobData } = req.body;

        const existingJob = await jobsCollections.findOne({ _id: new ObjectId(id) });
        if (!existingJob) return res.status(404).json({ message: "Job not found" });

        const updateDoc = { $set: { ...otherJobData, skills: skills || existingJob.skills } };
        const result = await jobsCollections.updateOne({ _id: new ObjectId(id) }, updateDoc);
        res.json({ acknowledged: result.acknowledged, message: "Job updated successfully" });
      } catch (error) {
        res.status(500).json({ error: "Failed to update job" });
      }
    });

    // Store subscriber email
    app.post("/api/subscribe", async (req, res) => {
      const { email } = req.body;
      if (!email) return res.status(400).json({ error: "Email is required" });

      try {
        const existingSubscriber = await subscribersCollection.findOne({ email });
        if (existingSubscriber) return res.status(400).json({ error: "Email already subscribed" });

        await subscribersCollection.insertOne({ email, subscribedAt: new Date() });
        res.json({ message: "Subscribed successfully!" });
      } catch (error) {
        res.status(500).json({ error: "Server error" });
      }
    });

    // Upload CV
    app.post("/api/upload-cv", upload.single("cv"), async (req, res) => {
      if (!req.file) return res.status(400).json({ error: "No file uploaded" });

      try {
        await resumesCollection.insertOne({
          email: req.body.email,
          fileName: req.file.filename,
          filePath: req.file.path,
          uploadedAt: new Date(),
        });
        res.json({ message: "CV uploaded successfully!", file: req.file });
      } catch (error) {
        res.status(500).json({ error: "Server error" });
      }
    });

    // Apply for a job
    app.post("/api/apply", upload.single("cv"), async (req, res) => {
      try {
        const { jobId, name, email, phone, address, describeYourself } = req.body;
        if (!req.file) return res.status(400).json({ message: "CV file is required" });

        await applicationsCollection.insertOne({
          jobId,
          name,
          email,
          phone,
          cv: req.file.path,
          address,
          describeYourself,
          appliedAt: new Date(),
        });
        res.status(201).json({ message: "Application submitted successfully" });
      } catch (error) {
        res.status(500).json({ message: "Internal server error" });
      }
    });

    // Get saved jobs
    app.get("/api/savedJobs/:userId", async (req, res) => {
      try {
        const savedJobs = await savedJobsCollection.find({ userId: req.params.userId }).toArray();
        if (!savedJobs.length) return res.status(404).json({ message: "No saved jobs found" });

        const jobIds = savedJobs.map((job) => new ObjectId(job.jobId));
        const jobs = await jobsCollections.find({ _id: { $in: jobIds } }).toArray();
        res.status(200).json({ savedJobs: jobs });
      } catch (error) {
        res.status(500).json({ error: "Failed to fetch saved jobs" });
      }
    });
  } catch (err) {
    console.error(err);
  }
}

run().catch(console.dir);

module.exports = app;
