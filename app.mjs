import express from 'express';
import twilio from 'twilio';
import dotenv from'dotenv';
dotenv.config();
// const accountSid = process.env.TWILIO_ACCOUNT_SID;
// const authToken = process.env.TWILIO_AUTH_TOKEN;
const port = process.env.PORT;
// const client = twilio(accountSid, authToken);

const app = express();
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

app.listen(3000,()=>{console.log(`Server is running on port ${port}`)});