import express from 'express';
import twilio from 'twilio';
import dotenv from 'dotenv';
import vcard from 'vcard-parser';
import { checkContact } from './axiosDownloadVcf.mjs';
import { PrismaClient } from '@prisma/client';
dotenv.config();
const port = process.env.PORT;
const dbUrl = process.env.DATABASE_URL;
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
let userState = 'unregistered';
const client = twilio(accountSid, authToken);
const prisma = new PrismaClient(
    { datasourceUrl: dbUrl}
);

const app = express();
app.use(express.json());

const message = async (dest,msg) =>{
    client.messages.create(
        {
            from:'whatsapp:+14155238886',
            to: await dest,
            body:msg,
        }
    )
}

app.use(express.urlencoded({ extended: true }));
app.get('/', (req, res) => {
    res.send('Hello World');
});

app.post('/webhook', (req, res) => {
    const sender = req.body.From;
    const body = req.body.Body;
    res.status(200).send('Webhook received');
    console.log(`Message recieved from ${sender} : ${body} @ ${new Date()}`);

});

app.post('/spiderman', async (req, res) => {
    const sender = req.body.From.replace('whatsapp:','');
    console.log(sender)
    const check = await prisma.users.findFirst({
        where:{number:sender}
    })
    
    if(check && userState!='onboarding1'){
        userState = 'registered';
    }else{
        message(req.body.From,`Hello! I see it's your first time here. Please enter your name.`);
        userState = 'onboarding1';
    }
    switch(userState){
        case 'onboarding1':
            prisma.users.create({
                data:{
                    number:sender,
                }
            });
            userState = 'onboarding2';
            break;
        case 'onboarding2':
            prisma.users.update({
                where:{
                    number:sender
                },
                data:{
                    name:req.body.Body
                }
            });
            message(req.body.From,`Welcome ${req.body.Body}! Send a vcf file to get started`);
            break;
        case 'registered':
            message(req.body.From,`Hi ${check.name}! Send a vcf file to get started`);
    }
})


app.post('/checkContact', async (req, res) => {
    //check if the contact is on the list and if not then create a new contact
    let vcfUrl = req.body.MediaUrl0;
    checkContact(vcfUrl);
});

app.listen(3000, () => { console.log(`Server is running on port ${port}`) });