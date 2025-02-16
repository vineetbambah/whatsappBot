import express from 'express';
import axios from 'axios';
import twilio from 'twilio';
import dotenv from 'dotenv';
import vcard from 'vcard-parser';
import { PrismaClient } from '@prisma/client';
dotenv.config();
const port = process.env.PORT;
const dbUrl = process.env.DATABASE_URL;
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
let userState = 'unregistered';
let registeredCase = 'vcfFileNotSent';
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

const checkIfVcf = (requ) => {
    if(requ.body.MediaContentType0 !== 'text/vcard'){
        registeredCase = 'vcfFileNotSent';
    }
}

const checkContact = (requ) =>{
    if(requ.body.MediaContentType0 === 'text/vcard'){
        axios({
            method: 'get',
            url: requ.body.MediaUrl0,
            auth: {
                username: accountSid,
                password: authToken,
            }
        }).then(async function (resp){
            let card = vcard.parse(resp.data);
            let phoneNumbers= await card.tel.map((number)=>number.value);
            phoneNumbers.map(async(number)=>{
                let contact = await prisma.contact.findFirst({
                    where:{
                        phoneNumber:number
                    }
                });
                if(contact){
                    console.log(`Contact ${contact.name} already exists`);
                }else{
                    console.log(`Contact does not exist, creating new contact`);
                    await prisma.contact.create({
                        data:{
                            name:card.fn,
                            phoneNumber:card.tel.map((number)=>number.value),
                        }
                    });
                    message(requ.body.From,`How do you know this contact? Provide a little context`);
                    registeredCase = 'askForContext';
                }
        })
    })
}
}

app.use(express.urlencoded({ extended: true }));
app.get('/', (req, res) => {
    res.send('Hello World');
});

app.post('/webhook', (req, res) => {
    const sender = req.body.From;
    const body = req.body.Body;
    res.status(200).send('Webhook received');
    console.log(req);

});

app.post('/spiderman', async (req, res) => {
    const sender = req.body.From.replace('whatsapp:','');
    const check = await prisma.users.findFirst({
        where:{number:sender}
    })
    
    if(check){
        userState = 'registered';
    }else{
        userState = 'onboarding1';
    }
    switch(userState){
        case 'onboarding1':
            console.log('Creating new user');
            try {
                const newUser = await prisma.users.create({
                  data: {
                    name:'Being Set',
                    number: sender,
                  },
                });
                console.log("User created:", newUser);
              } catch (error) {
                console.error("Error creating user:", error);
              }
            userState = 'onboarding2';
            message(req.body.From,`Hello! I see it's your first time here. Please enter your name.`);
            break;
        case 'onboarding2':
            console.log('Updating name');
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
            switch(registeredCase){
                case 'firstTimeSent':
                    checkContact(req);
                    break;
                case 'askForContext':
                    prisma.contact.update({
                        where:{
                            name:card.fn,
                            phoneNumber:card.tel.map((number)=>number.value),
                        },
                        data:{
                            context:req.body.Body
                        }
                    })
                    message(req.body.From,`Thank you! How often would you like to be reminded?`);
                    registeredCase = 'askForFrequency';
                    break;
                case 'askForFrequency':
                    prisma.users.update({
                        where:{
                            name:card.fn,
                            phoneNumber:card.tel.map((number)=>number.value),
                        },
                        data:{
                            frequency:req.body.Body
                        }
                    });
                    message(req.body.From,`Thank you! You will be reminded every ${req.body.Body} days`);
                    break;
                case 'vcfFileNotSent':
                    message(req.body.From,`Please send a vcf file to get started`);
                    break;
            }
    }
})

app.listen(3000, () => { console.log(`Server is running on port ${port}`) });