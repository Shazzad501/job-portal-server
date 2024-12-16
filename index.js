const express = require('express');
const cors = require('cors');
const jwt = require("jsonwebtoken");
const cookieParser = require('cookie-parser');
const app = express();
require('dotenv').config()
const port = process.env.PORT || 5000;
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');


// middle ware
// app.options("*", cors())
app.use(cors({
  origin: [
    "http://localhost:5173",
    "https://job-portal-cb309.web.app",
    "https://job-portal-cb309.firebaseapp.com"
  ],
  credentials: true
}));
app.use(cookieParser());
app.use(express.json());


// jwt token verify middle ware
const verifyToken = (req, res, next)=>{
  const token = req?.cookies?.token;

  if(!token){
    return res.status(401).send({message: "Unauthorized access"})
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, decoded)=>{
    if(err){
      return res.status(401).send({message: "Unauthorized access"})
    }
    req.user = decoded;
    next()
  })
}

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.wlddb.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();
    // Send a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 });
    // console.log("Pinged your deployment. You successfully connected to MongoDB!");

    // job related api
    const jobsCollection = client.db('jobPortal').collection('jobs')
    const jobsAppliCollection = client.db('jobPortal').collection('job_applications')


    // Auth related api  cookie
    app.post('/jwt', async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.JWT_SECRET, { expiresIn: '1h' });
      res.cookie("token", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
      });
      res.send({ success: true });
    });

    // clear cookie
    app.post('/logout', (req, res)=>{
      res
        .clearCookie('token', {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
        })
        .send({success: true})
    })

    // get all job from db
    app.get('/jobs', async(req, res)=>{
      const email = req.query.email;
      let query = {};
      if(email){
        query = {hr_email: email}
      }
      const cursor = jobsCollection.find(query);
      const result = await cursor.toArray();
      res.send(result);
    })

    // get one job by id
    app.get('/jobs/:id', async(req, res)=>{
      const id = req.params.id;
      const query = {_id: new ObjectId(id)};
      const result = await jobsCollection.findOne(query);
      res.send(result);
    })

    // post a new job into the db
    app.post('/jobs', async(req, res)=>{
      const newJob = req.body;
      const result = await jobsCollection.insertOne(newJob);
      res.send(result)
    })

    // job application related api
    app.post('/job-applications', async(req, res)=>{
      const application = req.body;
      const result = await jobsAppliCollection.insertOne(application);

      // application count set not the best way bast way(agriget)
      const id = application.job_id;
      const query = {_id: new ObjectId(id)};
      const job = await jobsCollection.findOne(query);
      let newCount = 0;
      if(job.application_count){
        newCount = job.application_count + 1;
      }
      else{
        newCount = 1;
      }

      // now update doc
      const filter = {_id: new ObjectId(id)};
      const updatedDoc = {
        $set: {
          application_count: newCount,
        }
      }
      const updatedResult = await jobsCollection.updateOne(filter, updatedDoc)

      res.send(result);
    })
    
    // get a one spacific job application
    app.get('/job-applications/jobs/:job_id', async(req, res)=>{
      const jobId = req.params.job_id;
      const query = {job_id: jobId};
      const result = await jobsAppliCollection.find(query).toArray();
      res.send(result)
    })

    // get application data by user email matching
    app.get('/job-applications',verifyToken, async(req, res)=>{
      const email = req.query.email;
      const query = {applicant_email: email};
      const result = await jobsAppliCollection.find(query).toArray();

      if(req?.user?.email !== req?.query?.email){
        return res.status(403).send({message: "Forbidden access"});
      }

      // fokira way te data load
      for(const application of result){
        const jobQuery = {_id: new ObjectId(application.job_id)};
        const job = await jobsCollection.findOne(jobQuery);
        if(job){
          application.title = job.title;
          application.location = job.location;
          application.jobType = job.jobType;
          application.company = job.company;
          application.category = job.category;
          application.company_logo = job.company_logo;
        }
      }
      res.send(result);
    })
    
    // update a job application status
    app.patch('/job-applications/:id', async(req, res)=>{
      const id = req.params.id;
      const data = req.body;
      const filter = {_id: new ObjectId(id)};
      const updatedDoc = {
        $set: {
          status: data.status,
        }
      }
      const result = await jobsAppliCollection.updateOne(filter, updatedDoc);
      res.send(result);
    })


  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);


app.get('/', (req, res)=>{
  res.send("Job is falling from the sky 🤣🤣")
})

app.listen(port,()=>{
  console.log(`Job is wating at: ${port}`)
})