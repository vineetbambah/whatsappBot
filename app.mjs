import express from 'express';
import axios from 'axios';
import twilio from 'twilio';
import dotenv from 'dotenv';
import vcard from 'vcard-parser';
import { PrismaClient } from '@prisma/client';
dotenv.config();
const port = process.env.PORT;
let contact0;
const dbUrl = process.env.DATABASE_URL;
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
let userState = 'unregistered';
let registeredCase = 'vcfNotSent';
const client = twilio(accountSid, authToken);
const prisma = new PrismaClient(
    {datasourceUrl: dbUrl}
);

const app = express();
app.use(express.json());
const checkContact = async (requ,user) => {
    try {
        // Fetch the vCard data
        const resp = await axios({
            method: 'get',
            url: requ.body.MediaUrl0,
            auth: {
                username: accountSid,
                password: authToken,
            },
        });

        // Parse the vCard data
        const card = vcard.parse(resp.data);
        const phoneNumbers = card.tel.map((number) => number.value);

        // Check each phone number in the database
        const contacts = await Promise.all(
            phoneNumbers.map(async (number) => {
                const contact = await prisma.contacts.findFirst({
                    where: {
                        number: {
                            has: number,
                        },
                    },
                });
                return contact; // Return the contact for each number
            })
        );
        if(contacts.indexOf(null) !== -1){
           contact0= await prisma.contacts.create({
                data:{
                    name:card.fn[0].value,
                    number:phoneNumbers,
                    user:{
                        connect:{
                            uid:user.uid
                        }
                    }
                }
            })
            registeredCase = 'askForContext';
            console.log('Contact created');
        }else{
            console.log('Contact already exists');
            message(requ.body.From,`Contact already exists`);
        }
    } catch (error) {
        console.error("Error in checkContact:", error);
    }
};



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
});

app.post('/spiderman', async (req, res) => {
    const sender = req.body.From.replace('whatsapp:','');
    const user = await prisma.users.findFirst({
        where:{number:sender},
    })
    if(!user){
        userState = 'onboarding1';
    }else if(user && userState === 'onboarding1'){
        userState = 'onboarding2';
    }else{
        userState = 'registered';
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
            message(req.body.From,`Hello! I see it's your first time here. Please enter your name.`);
            break;
        case 'onboarding2':
            console.log('Updating name');
            await prisma.users.update({
                where:{
                    uid:user.uid
                },
                data:{
                    name:req.body.Body
                }
            });
            message(req.body.From,`Welcome ${req.body.Body}! Please send a VCF file to get started`);
            break;
        case 'registered':
            console.log('User is registered');
            if(registeredCase !== 'askForContext' && registeredCase !== 'askForFrequency'){
                if(req.body.MediaContentType0 !== 'text/vcard'){
                    message(req.body.From,`Please send a vcf file to get started`);
                    registeredCase = 'vcfNotSent';
                    break;
                }else{
                    registeredCase = 'vcfSent';
                }
            }
            switch(registeredCase){
                case 'vcfSent':
                    console.log('Vcf Sent');
                    checkContact(req,user);
                    message(req.body.From,`Thank you! How do you know this contact? Provide a little context`);
                    break;
                case 'askForContext':
                    console.log(`Asking for context`);
                    console.log(contact0);
                    prisma.contacts.update({
                        where:{
                            id:contact0.id
                        },
                        data:{
                            context:req.body.Body
                        }
                    })
                    console.log(prisma.contacts.update({
                        where:{
                            id:contact0.id
                        },
                        data:{
                            context:req.body.Body
                        }
                    }));
                    console.log(contact0);
                    message(req.body.From,`Thank you! How often would you like to be reminded?(enter integer in days)`);
                    registeredCase = 'askForFrequency';
                    break;
                case 'askForFrequency':
                    console.log('Asking for frequency');
                    message(req.body.From,`Thank you! You will be reminded every ${req.body.Body} days`);
                    prisma.contacts.update({
                        where:{
                            id:contact0.id
                        },
                        data:{
                            frequency:req.body.Body
                        }
                    })
                    registeredCase='vcfNotSent'
                    break;
                case 'vcfNotSent':
                    break;
            }
    }
})

app.listen(3000, () => { console.log(`Server is running on port ${port}`) });