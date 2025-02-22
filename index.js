require("dotenv").config();
const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const jwt = require("jsonwebtoken");
const morgan = require("morgan");

const port = process.env.PORT || 5000;
const app = express();
// middleware
const corsOptions = {
  origin: ["http://localhost:5173", "https://task-management-app.surge.sh"],
  credentials: true,
  optionSuccessStatus: 200,
};
app.use(cors(corsOptions));

app.use(express.json());
app.use(cookieParser());
app.use(morgan("dev"));

const verifyToken = async (req, res, next) => {
  const token = req.cookies?.token;

  if (!token) {
    return res.status(401).send({ message: "unauthorized access" });
  }
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      console.log(err);
      return res.status(401).send({ message: "unauthorized access" });
    }
    req.user = decoded;
    next();
  });
};

// const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.hp21t.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.hwao6.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});
async function run() {
  try {
    const database = client.db("TaskAppDB");
    const usersCollection = database.collection("users");
    const tasksCollection = database.collection("Tasks");

    // save or update a user in db
    app.post("/users/:email", async (req, res) => {
      const email = req.params.email;
      const query = { email };
      const user = req.body;
      // check if user exists in db
      const isExist = await usersCollection.findOne(query);
      if (isExist) {
        return res.send(isExist);
      }
      const result = await usersCollection.insertOne({
        ...user,
        role: "user",
        timestamp: Date.now(),
      });
      res.send(result);
    });

    // Generate jwt token
    app.post("/jwt", async (req, res) => {
      const email = req.body;
      const token = jwt.sign(email, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "1d",
      });
      res
        .cookie("token", token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
        })
        .send({ success: true });
    });
    // Logout
    app.get("/logout", async (req, res) => {
      try {
        res
          .clearCookie("token", {
            maxAge: 0,
            secure: process.env.NODE_ENV === "production",
            sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
          })
          .send({ success: true });
      } catch (err) {
        res.status(500).send(err);
      }
    });

    // save a Task data in db
    app.post("/tasks", verifyToken, async (req, res) => {
      const task = req.body;
      const result = await tasksCollection.insertOne({
        ...task,
        timestamp: Date.now(),
      });
      res.send(result);
    });

    // get all tasks from db
    app.get("/tasks", async (req, res) => {
      const result = await tasksCollection.find().toArray();
      res.send(result);
    });

    // Get All Users
    app.get("/users", async (req, res) => {
      const cursor = usersCollection.find();
      const result = await cursor.toArray();
      res.send(result);
    });

    // My To-Do Task get from database
    app.get("/tasks", async (req, res) => {
      try {
        const { email } = req.query;
        if (!email) {
          return res
            .status(400)
            .send({ error: "Email query parameter is required" });
        }
        const result = await tasksCollection
          .find({ "User.email": email })
          .toArray();

        res.send(result);
      } catch (error) {
        console.error(error);
        res.status(500).send({ error: "Failed to fetch classes" });
      }
    });

    // Delete Task From Database
    app.delete("/tasks/:id", async (req, res) => {
      const { id } = req.params;
      try {
        const result = await tasksCollection.deleteOne({
          _id: new ObjectId(id),
        });
        res.send(result);
      } catch (error) {
        console.error(error);
        res.status(500).send({ error: "Failed to delete class" });
      }
    });

    // Get Task Detail with ID
    app.get("/tasks/:id", async (req, res) => {
      const { id } = req.params;

      // Validate ID
      if (!ObjectId.isValid(id)) {
        return res
          .status(400)
          .send({ success: false, message: "Invalid class ID" });
      }

      try {
        const taskData = await tasksCollection.findOne({
          _id: new ObjectId(id),
        });

        if (!taskData) {
          return res
            .status(404)
            .send({ success: false, message: "Class not found" });
        }

        res.send(taskData);
      } catch (error) {
        console.error("Error fetching class data:", error);
        res
          .status(500)
          .send({ success: false, message: "Failed to fetch class" });
      }
    });

    // Update Task From Database
    // app.put("/tasks/:id", async (req, res) => {
    //   const id = req.params.id;
    //   const updatedTask = req.body;

    //   try {
    //     const result = await tasksCollection.updateOne(
    //       { _id: new ObjectId(id) },
    //       { $set: updatedTask }
    //     );
    //     if (result.modifiedCount > 0) {
    //       res.send({ success: true, message: "Task updated successfully" });
    //     } else {
    //       res.status(404).send({ success: false, message: "Task not found" });
    //     }
    //   } catch (error) {
    //     console.error(error);
    //     res
    //       .status(500)
    //       .send({ success: false, message: "Failed to update Task" });
    //   }
    // });

    app.put("/tasks/:id", async (req, res) => {
      const { id } = req.params;
      const updatedTask = req.body;

      try {
        if (!ObjectId.isValid(id)) {
          return res
            .status(400)
            .send({ success: false, message: "Invalid ID format" });
        }

        const result = await tasksCollection.updateOne(
          { _id: new ObjectId(id) },
          { $set: updatedTask }
        );

        if (result.modifiedCount > 0) {
          res.send({ success: true, message: "Task updated successfully" });
        } else {
          res.status(404).send({
            success: false,
            message: "Task not found or no changes made",
          });
        }
      } catch (error) {
        console.error(error);
        res
          .status(500)
          .send({ success: false, message: "Failed to update task" });
      }
    });

    // Update Task order
    app.put("/tasks/update", async (req, res) => {
      try {
        const { updatedTasks } = req.body;

        // Update each task in database
        const bulkOperations = updatedTasks.flatMap((tasks, category) =>
          tasks.map((task, index) => ({
            updateOne: {
              filter: { _id: task._id },
              update: { category: category, order: index },
            },
          }))
        );

        await Task.bulkWrite(bulkOperations);

        res.status(200).json({ message: "Tasks updated successfully" });
      } catch (error) {
        console.error("Error updating tasks:", error);
        res.status(500).json({ message: "Internal server error" });
      }
    });

    // Send a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Hello from Hans Aeggy Art Server Server..");
});

app.listen(port, () => {
  console.log(`The Task Management App is running on port ${port}`);
});
