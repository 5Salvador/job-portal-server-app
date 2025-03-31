const express = require("express");
const app = express();
const cors = require("cors");
const router = express.Router();
const Application = require("./models/application");
const port = process.env.PORT || 5000;
require("dotenv").config();
console.log(process.env.DB_USER);
console.log(process.env.DB_PASSWORD);

// Middleware
app.use(express.json());
app.use(cors());

const { MongoClient, ObjectId, ServerApiVersion } = require("mongodb");

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
    // Connect to the MongoDB client
    await client.connect();

    // Create database and collection
    const db = client.db("mernJobPortal");
    const jobsCollections = db.collection("demoJobs");

    // Post a job
    app.post("/post-job", async (req, res) => {
      const body = req.body;
      body.createdAt = new Date();
      const result = await jobsCollections.insertOne(body);
      if (result.insertedId) {
        return res.status(200).send(result);
      } else {
        return res.status(404).send({
          message: "Cannot insert! Try again later.",
          status: false,
        });
      }
    });

    // Define a Schema & Model
    const subscribersCollection = db.collection("subscribers");

    //multer file Storage

    const multer = require("multer");
    const path = require("path");

    const storage = multer.diskStorage({
      destination: function (req, file, cb) {
        cb(null, "uploads/"); // Save files in the "uploads" folder
      },
      filename: function (req, file, cb) {
        cb(
          null,
          file.fieldname + "-" + Date.now() + path.extname(file.originalname)
        );
      },
    });

    const upload = multer({ storage: storage });

    // Get all jobs
    app.get("/api/all-jobs", async (req, res) => {
      const jobs = await jobsCollections.find().toArray();
      res.json(jobs);
    });

    // Get a single job by ID
    app.get("/all-jobs/:id", async (req, res) => {
      try {
        const id = req.params.id;

        // Validate ObjectId before using it
        if (!ObjectId.isValid(id)) {
          return res
            .status(400)
            .json({ message: "Invalid Job ID format", status: false });
        }

        const job = await jobsCollections.findOne({ _id: new ObjectId(id) });

        if (job) {
          res.json(job);
        } else {
          res.status(404).json({ message: "Cannot find job", status: false });
        }
      } catch (error) {
        console.error("Error fetching job:", error);
        res
          .status(500)
          .json({ message: "Internal Server Error", status: false });
      }
    });

    // Get jobs by user ID
    app.get("/myJobs/:email", async (req, res) => {
      const email = req.params.email;

      try {
        const jobs = await jobsCollections.find({ postedBy: email }).toArray();

        if (jobs.length > 0) {
          res.json({ status: true, jobs });
        } else {
          res
            .status(404)
            .json({ message: "No jobs found for this user", status: false });
        }
      } catch (error) {
        console.error("Error fetching jobs:", error);
        res
          .status(500)
          .json({ message: "Internal Server Error", status: false });
      }
    });

    // Delete a job
    app.delete("/job/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const result = await jobsCollections.deleteOne(filter);
      res.send(result);
    });

    // Update a job
    app.patch("/update-job/:id", async (req, res) => {
      const id = req.params.id;
      const { skills, ...otherJobData } = req.body; // Separate skills from other fields

      const filter = { _id: new ObjectId(id) };
      const options = { upsert: false }; // No upsert to avoid accidental job creation

      try {
        // Fetch the existing job
        const existingJob = await jobsCollections.findOne(filter);
        if (!existingJob) {
          return res.status(404).json({ message: "Job not found" });
        }

        // Process updates for `skills`
        let updatedSkills = existingJob.skills || [];

        if (Array.isArray(skills)) {
          updatedSkills = skills; // Replace existing skills with new ones
        }

        // Build update document
        const updateDoc = {
          $set: { ...otherJobData, skills: updatedSkills }, // Update other fields and skills
        };

        // Handle empty fields (delete them from DB if removed in form)
        Object.keys(updateDoc.$set).forEach((key) => {
          if (updateDoc.$set[key] === "" || updateDoc.$set[key] === null) {
            updateDoc.$unset = updateDoc.$unset || {}; // Initialize $unset if needed
            updateDoc.$unset[key] = ""; // Mark the field for removal
            delete updateDoc.$set[key]; // Remove it from $set
          }
        });

        // Update job in the database
        const result = await jobsCollections.updateOne(
          filter,
          updateDoc,
          options
        );

        res.json({
          acknowledged: result.acknowledged,
          message: "Job updated successfully",
        });
      } catch (error) {
        console.error("Error updating job:", error);
        res.status(500).json({ error: "Failed to update job" });
      }
    });

    //Store subscriber email
    // Store subscriber email using MongoDB driver
    app.post("/api/subscribe", async (req, res) => {
      const { email } = req.body;

      if (!email) {
        return res.status(400).json({ error: "Email is required" });
      }

      try {
        const db = client.db("mernJobPortal");
        const subscribersCollection = db.collection("subscribers");

        // Check if email already exists
        const existingSubscriber = await subscribersCollection.findOne({
          email,
        });
        if (existingSubscriber) {
          return res.status(400).json({ error: "Email is already subscribed" });
        }

        // Save subscriber to MongoDB
        const newSubscriber = {
          email,
          subscribedAt: new Date(),
        };

        await subscribersCollection.insertOne(newSubscriber);

        res.json({ message: "Subscribed successfully!" });
      } catch (error) {
        console.error("Error subscribing:", error);
        res.status(500).json({ error: "Server error" });
      }
    });

    //Api for CV uploads
    app.post("/api/upload-cv", upload.single("cv"), async (req, res) => {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      try {
        const db = client.db("mernJobPortal");
        const resumesCollection = db.collection("resumes");

        const newResume = {
          email: req.body.email, // Associate resume with user email
          fileName: req.file.filename, // Store file name
          filePath: req.file.path, // Store file path
          uploadedAt: new Date(),
        };

        await resumesCollection.insertOne(newResume);

        res.json({ message: "CV uploaded successfully!", file: req.file });
      } catch (error) {
        console.error("Error uploading CV:", error);
        res.status(500).json({ error: "Server error" });
      }
    });

    // POST: Submit a job application
    app.post("/apply", upload.single("cv"), async (req, res) => {
      try {
        console.log("Incoming request body:", req.body);
        console.log("Uploaded file info:", req.file);

        const { jobId, name, email, phone, address, describeYourself } =
          req.body;

        if (!req.file) {
          return res.status(400).json({ message: "CV file is required" });
        }

        const db = client.db("mernJobPortal");
        const applicationsCollection = db.collection("applications");

        const newApplication = {
          jobId,
          name,
          email,
          phone,
          cv: req.file.path,
          address,
          describeYourself,
          appliedAt: new Date(),
        };

        await applicationsCollection.insertOne(newApplication);
        res.status(201).json({ message: "Application submitted successfully" });
      } catch (error) {
        console.error("Error submitting application:", error.message);
        res
          .status(500)
          .json({ message: "Internal server error", error: error.message });
      }
    });

    // Assuming MongoDB client has already been connected and db has been set up correctly

    // Endpoint to fetch saved jobs for a user
    app.get("/api/savedJobs/:userId", async (req, res) => {
      const { userId } = req.params;

      try {
        const db = client.db("mernJobPortal");
        const savedJobsCollection = db.collection("savedJobs");
        const jobsCollection = db.collection("demoJobs");

        // Find all saved jobs for the user
        const savedJobs = await savedJobsCollection.find({ userId }).toArray();

        if (!savedJobs.length) {
          return res.status(404).json({
            message: "No saved jobs found for this user",
            status: false,
          });
        }

        // Fetch job details for each saved job
        const jobIds = savedJobs.map(
          (savedJob) => new ObjectId(savedJob.jobId)
        );
        const jobs = await jobsCollection
          .find({ _id: { $in: jobIds } })
          .toArray();

        res.status(200).json({ status: true, savedJobs: jobs });
      } catch (error) {
        console.error("Error fetching saved jobs:", error);
        res.status(500).json({ error: "Failed to fetch saved jobs" });
      }
    });

    // Endpoint to save a job

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } catch (err) {
    console.error(err);
  }
}

run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Hello Developer");
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
