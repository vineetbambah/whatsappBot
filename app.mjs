import express from 'express';
import twilio from 'twilio';
import dotenv from'dotenv';
import axios from 'axios';
import fs from 'fs';
dotenv.config();
const port = process.env.PORT;
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const client = twilio(accountSid, authToken);


const app = express();
app.use(express.json());

app.use(express.urlencoded({ extended: true }));
app.get('/',(req,res)=>{
    res.send('Hello World');
});
app.post('/webhook', (req, res) => {
    const sender = req.body.From;
    const body = req.body.Body;
    res.status(200).send('Webhook received');
    console.log(`Message recieved from ${sender} : ${body} @ ${new Date()}`);
    
});

app.post('/checkContact', async (req, res) => {
    //check if the contact is on the list and if not then create a new contact
    });
  
app.listen(3000,()=>{console.log(`Server is running on port ${port}`)});